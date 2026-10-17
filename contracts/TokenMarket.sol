// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
contract TokenMarket is ReentrancyGuard {
 using SafeERC20 for IERC20;
 struct Listing {uint256 id;address seller;address buyer;string title;uint256 amount;uint256 price;uint8 status;}
 IERC20 public immutable asset; IERC20 public immutable currency;
 Listing[] private items;
 event Listed(uint256 indexed id,address indexed seller);
 event Purchased(uint256 indexed id,address indexed buyer);
 event Cancelled(uint256 indexed id);
 constructor(address a,address c){require(a!=c&&a.code.length>0&&c.code.length>0,"Invalid tokens");asset=IERC20(a);currency=IERC20(c);}
 function createListing(string calldata title,uint256 amount,uint256 price) external nonReentrant {
 require(bytes(title).length>0&&bytes(title).length<=120&&amount>0&&price>0,"Invalid listing");
 uint256 beforeBalance=asset.balanceOf(address(this));asset.safeTransferFrom(msg.sender,address(this),amount);
 require(asset.balanceOf(address(this))-beforeBalance==amount,"Unsupported fee");
 uint256 id=items.length;items.push(Listing(id,msg.sender,address(0),title,amount,price,0));emit Listed(id,msg.sender);
 }
 function buy(uint256 id) external nonReentrant {Listing storage l=items[id];require(l.status==0&&msg.sender!=l.seller,"Unavailable");l.status=1;l.buyer=msg.sender;currency.safeTransferFrom(msg.sender,l.seller,l.price);asset.safeTransfer(msg.sender,l.amount);emit Purchased(id,msg.sender);}
 function cancel(uint256 id) external nonReentrant {Listing storage l=items[id];require(l.status==0&&msg.sender==l.seller,"Unavailable");l.status=2;asset.safeTransfer(l.seller,l.amount);emit Cancelled(id);}
 function listingCount() external view returns(uint256){return items.length;}
 function listListings(uint256 offset,uint256 limit) external view returns(Listing[] memory result){require(limit<=50,"Page too large");uint256 n=items.length;if(offset>=n)return new Listing[](0);uint256 count=n-offset<limit?n-offset:limit;result=new Listing[](count);for(uint256 i;i<count;++i)result[i]=items[n-1-offset-i];}
}