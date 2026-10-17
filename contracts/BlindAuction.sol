// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./PriceHash.sol";

/// @notice Five-round sealed-price game. No offchain database or privileged operator.
/// @dev Currency must be the standard, non-rebasing DemoToken. Prices use token base units.
contract BlindAuction is ReentrancyGuard {
    using SafeERC20 for IERC20;
    uint256 public constant DEPOSIT = 100_000 ether;
    uint256 public constant WINDOW = 30;
    uint256 public constant SELLER_WINDOW = 120;
    uint256 public constant LOBBY_LIFETIME = 1 days;
    uint256 public constant MIN_BUYERS = 3;
    uint8 public constant MAX_ROUNDS = 5;
    IERC20 public immutable token;
    uint256 public auctionCount;

    enum Status { Open, AwaitSeller, Settled, Cancelled }
    enum Phase { Lobby, Countdown, Commit, Reveal, Compare, SellerReveal, Settled, Cancelled }
    struct Auction {
        address seller;
        string title;
        uint256 ceiling;
        bytes32 sellerCommitment;
        uint64 createdAt;
        uint64 roundStart;
        uint64 sellerDeadline;
        uint8 round;
        Status status;
        address winner;
        uint256 winningBid;
        uint256 actualPrice;
        bool sellerDefaulted;
        uint256 refundCursor;
    }
    struct Player { uint256 index; uint256 lastPrice; uint8 revealedRounds; }
    struct Bid { bytes32 commitment; uint256 price; bool revealed; }
    struct Ranking { address first; address second; uint256 firstPrice; uint256 secondPrice; uint256 count; }
    mapping(uint256 => Auction) private auctions;
    mapping(uint256 => address[]) private buyers;
    mapping(uint256 => mapping(address => Player)) public players;
    mapping(uint256 => mapping(uint8 => mapping(address => Bid))) public bids;
    mapping(uint256 => mapping(uint8 => Ranking)) public rankings;
    mapping(uint256 => mapping(address => mapping(bytes32 => bool))) private usedCommitments;
    mapping(uint256 => mapping(address => bool)) public refunded;

    error InvalidAuction(); error WrongPhase(); error InvalidAmount(); error InvalidCommitment();
    error NotParticipant(); error AlreadyDone(); error InvalidTitle(); error OutOfBounds();
    event AuctionCreated(uint256 indexed id, address indexed seller, string title, uint256 ceiling, bytes32 commitment);
    event Joined(uint256 indexed id, address indexed buyer, uint256 index);
    event CountdownStarted(uint256 indexed id, uint64 startAt);
    event Committed(uint256 indexed id, uint8 indexed round, address indexed buyer, bytes32 commitment);
    event Revealed(uint256 indexed id, uint8 indexed round, address indexed buyer, uint256 price);
    event Compared(uint256 indexed id, uint8 indexed round, address leader, uint256 price, bool finalRound);
    event NextRound(uint256 indexed id, uint8 round, uint64 startAt);
    event Settled(uint256 indexed id, address indexed winner, uint256 bid, uint256 actualPrice, bool sellerDefaulted);
    event Cancelled(uint256 indexed id);
    event Refunded(uint256 indexed id, address indexed account, uint256 amount);

    constructor(IERC20 currency) {
        if(address(currency).code.length==0) revert InvalidAmount();
        token=currency;
    }

    function priceHash(uint256 price, address account, string memory salt) public pure returns(bytes32) {
        return PriceHash.hash(price,account,salt);
    }

    function createAuction(string calldata title,uint256 ceiling,bytes32 commitment) external nonReentrant returns(uint256 id) {
        if(bytes(title).length==0 || bytes(title).length>120) revert InvalidTitle();
        if(ceiling==0 || ceiling>DEPOSIT) revert InvalidAmount();
        if(commitment==bytes32(0)) revert InvalidCommitment();
        id=++auctionCount;
        Auction storage a=auctions[id];
        a.seller=msg.sender;a.title=title;a.ceiling=ceiling;a.sellerCommitment=commitment;
        a.createdAt=uint64(block.timestamp);a.round=1;
        token.safeTransferFrom(msg.sender,address(this),DEPOSIT);
        emit AuctionCreated(id,msg.sender,title,ceiling,commitment);
    }

    function join(uint256 id) external nonReentrant {
        Auction storage a=_auction(id);
        Phase phase=getPhase(id);
        if((phase!=Phase.Lobby && phase!=Phase.Countdown) || block.timestamp>=a.createdAt+LOBBY_LIFETIME) revert WrongPhase();
        if(msg.sender==a.seller || players[id][msg.sender].index!=0) revert AlreadyDone();
        buyers[id].push(msg.sender);
        players[id][msg.sender].index=buyers[id].length;
        token.safeTransferFrom(msg.sender,address(this),DEPOSIT);
        emit Joined(id,msg.sender,buyers[id].length);
        if(buyers[id].length==MIN_BUYERS){
            a.roundStart=uint64(block.timestamp+WINDOW);
            emit CountdownStarted(id,a.roundStart);
        }
    }

    function commitBid(uint256 id,bytes32 commitment) external {
        Auction storage a=_auction(id);
        if(getPhase(id)!=Phase.Commit) revert WrongPhase();
        Player storage p=players[id][msg.sender];
        if(p.index==0 || p.revealedRounds!=a.round-1) revert NotParticipant();
        Bid storage b=bids[id][a.round][msg.sender];
        if(b.commitment!=bytes32(0)) revert AlreadyDone();
        if(commitment==bytes32(0) || usedCommitments[id][msg.sender][commitment]) revert InvalidCommitment();
        b.commitment=commitment;usedCommitments[id][msg.sender][commitment]=true;
        emit Committed(id,a.round,msg.sender,commitment);
    }

    function revealBid(uint256 id,uint256 price,string calldata salt) external {
        Auction storage a=_auction(id);
        if(getPhase(id)!=Phase.Reveal) revert WrongPhase();
        Player storage p=players[id][msg.sender];
        if(p.index==0 || p.revealedRounds!=a.round-1) revert NotParticipant();
        Bid storage b=bids[id][a.round][msg.sender];
        if(b.revealed) revert AlreadyDone();
        if(b.commitment==bytes32(0) || b.commitment!=priceHash(price,msg.sender,salt)) revert InvalidCommitment();
        if(price>a.ceiling || price<p.lastPrice) revert InvalidAmount();
        b.price=price;b.revealed=true;p.lastPrice=price;p.revealedRounds=a.round;
        _rank(id,a.round,msg.sender,price);
        emit Revealed(id,a.round,msg.sender,price);
    }

    /// @dev Ranking is O(1); ties use registration order, never reveal ordering.
    function _rank(uint256 id,uint8 round,address account,uint256 price) private {
        Ranking storage r=rankings[id][round];++r.count;
        if(r.first==address(0) || _ahead(id,account,price,r.first,r.firstPrice)){
            r.second=r.first;r.secondPrice=r.firstPrice;r.first=account;r.firstPrice=price;
        }else if(r.second==address(0) || _ahead(id,account,price,r.second,r.secondPrice)){
            r.second=account;r.secondPrice=price;
        }
    }
    function _ahead(uint256 id,address a,uint256 pa,address b,uint256 pb) private view returns(bool){
        return pa>pb || (pa==pb && players[id][a].index<players[id][b].index);
    }

    /// @notice Anyone may compare after the full reveal window. A tx is required.
    function compare(uint256 id) external nonReentrant {
        Auction storage a=_auction(id);
        if(getPhase(id)!=Phase.Compare) revert WrongPhase();
        Ranking storage r=rankings[id][a.round];
        bool finish=(a.round==MAX_ROUNDS) || (r.count>=2 && r.firstPrice>2*r.secondPrice);
        emit Compared(id,a.round,r.first,r.firstPrice,finish);
        if(r.count==0){
            a.status=Status.Cancelled;emit Cancelled(id);_refundBatch(id,20);
        }else if(finish){
            a.winner=r.first;a.winningBid=r.firstPrice;a.status=Status.AwaitSeller;
            a.sellerDeadline=uint64(block.timestamp+SELLER_WINDOW);
        }else{
            ++a.round;a.roundStart=uint64(block.timestamp);
            emit NextRound(id,a.round,a.roundStart);
        }
    }

    function revealSeller(uint256 id,uint256 price,string calldata salt) external nonReentrant {
        Auction storage a=_auction(id);
        if(a.status!=Status.AwaitSeller || block.timestamp>=a.sellerDeadline) revert WrongPhase();
        if(msg.sender!=a.seller) revert NotParticipant();
        if(price>a.ceiling) revert InvalidAmount();
        if(priceHash(price,msg.sender,salt)!=a.sellerCommitment) revert InvalidCommitment();
        a.actualPrice=price;a.status=Status.Settled;
        emit Settled(id,a.winner,a.winningBid,price,false);
        _refundBatch(id,20);
    }

    /// @notice A seller cannot lock deposits forever by refusing to reveal.
    /// @dev Default forfeits the seller's full deposit to the winner.
    function finalizeSellerTimeout(uint256 id) external nonReentrant {
        Auction storage a=_auction(id);
        if(a.status!=Status.AwaitSeller || block.timestamp<a.sellerDeadline) revert WrongPhase();
        a.sellerDefaulted=true;a.status=Status.Settled;
        emit Settled(id,a.winner,a.winningBid,0,true);
        _refundBatch(id,20);
    }

    /// @notice Seller may cancel an unfilled lobby; anyone may cancel it after a day.
    function cancelLobby(uint256 id) external nonReentrant {
        Auction storage a=_auction(id);
        if(a.status!=Status.Open || a.roundStart!=0) revert WrongPhase();
        if(msg.sender!=a.seller && block.timestamp<a.createdAt+LOBBY_LIFETIME) revert NotParticipant();
        a.status=Status.Cancelled;emit Cancelled(id);_refundBatch(id,20);
    }

    function refundBatch(uint256 id,uint256 limit) external nonReentrant {
        _auction(id);if(limit==0 || limit>50) revert OutOfBounds();_refundBatch(id,limit);
    }
    function _refundBatch(uint256 id,uint256 limit) private {
        Auction storage a=auctions[id];
        if(a.status!=Status.Settled && a.status!=Status.Cancelled) revert WrongPhase();
        uint256 total=buyers[id].length+1;uint256 end=a.refundCursor+limit;if(end>total)end=total;
        for(uint256 i=a.refundCursor;i<end;++i){
            address account=i==0?a.seller:buyers[id][i-1];
            _refund(id,account);
        }
        a.refundCursor=end;
    }
    /// @notice Anyone can send a participant their refund; recipient is immutable.
    function refundFor(uint256 id,address account) external nonReentrant {
        _auction(id);
        if(account!=auctions[id].seller && players[id][account].index==0) revert NotParticipant();
        if(auctions[id].status!=Status.Settled && auctions[id].status!=Status.Cancelled) revert WrongPhase();
        _refund(id,account);
    }
    function _refund(uint256 id,address account) private {
        if(refunded[id][account])return;
        uint256 amount=claimable(id,account);
        refunded[id][account]=true;
        if(amount!=0)token.safeTransfer(account,amount);
        emit Refunded(id,account,amount);
    }

    function claimable(uint256 id,address account) public view returns(uint256){
        Auction storage a=_auction(id);
        if(refunded[id][account] || (account!=a.seller && players[id][account].index==0))return 0;
        if(a.status!=Status.Settled && a.status!=Status.Cancelled)return 0;
        if(a.status==Status.Cancelled || (account!=a.seller && account!=a.winner))return DEPOSIT;
        if(a.sellerDefaulted)return account==a.winner?2*DEPOSIT:0;
        if(a.winningBid>=a.actualPrice){
            uint256 d=a.winningBid-a.actualPrice;return account==a.seller?DEPOSIT+d:DEPOSIT-d;
        }
        uint256 shortfall=a.actualPrice-a.winningBid;return account==a.seller?DEPOSIT-shortfall:DEPOSIT+shortfall;
    }

    function getPhase(uint256 id) public view returns(Phase){
        Auction storage a=_auction(id);
        if(a.status==Status.Settled)return Phase.Settled;
        if(a.status==Status.Cancelled)return Phase.Cancelled;
        if(a.status==Status.AwaitSeller)return Phase.SellerReveal;
        if(a.roundStart==0)return Phase.Lobby;
        if(block.timestamp<a.roundStart)return Phase.Countdown;
        if(block.timestamp<a.roundStart+WINDOW)return Phase.Commit;
        if(block.timestamp<a.roundStart+2*WINDOW)return Phase.Reveal;
        return Phase.Compare;
    }
    function getAuction(uint256 id) external view returns(Auction memory){return _auction(id);}
    function buyerCount(uint256 id) external view returns(uint256){_auction(id);return buyers[id].length;}
    function getBuyers(uint256 id,uint256 offset,uint256 limit) external view returns(address[] memory result){
        _auction(id);if(limit>100)revert OutOfBounds();uint256 n=buyers[id].length;
        if(offset>=n)return new address[](0);uint256 end=offset+limit;if(end>n)end=n;
        result=new address[](end-offset);for(uint256 i=offset;i<end;++i)result[i-offset]=buyers[id][i];
    }
    function _auction(uint256 id) private view returns(Auction storage a){
        if(id==0 || id>auctionCount) revert InvalidAuction();a=auctions[id];
    }
}
