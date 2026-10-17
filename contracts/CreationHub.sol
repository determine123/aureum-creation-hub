// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Public creations and voluntary test-token support. Content is public, never paywalled.
contract CreationHub is ReentrancyGuard {
    using SafeERC20 for IERC20;
    struct Creation {
        uint256 id;
        address author;
        string title;
        string summary;
        string body;
        string link;
        uint8 category;
        uint64 createdAt;
        uint256 support;
        uint256 saves;
        bool archived;
    }
    IERC20 public immutable token;
    Creation[] private creations;
    mapping(uint256 => mapping(address => bool)) public saved;
    mapping(address => uint256) public received;
    mapping(address => uint256) public contributed;
    uint256 public totalSupport;
    event Published(uint256 indexed id, address indexed author, uint8 category);
    event Supported(uint256 indexed id, address indexed supporter, uint256 amount);
    event BookmarkChanged(uint256 indexed id, address indexed account, bool value);
    event ArchiveChanged(uint256 indexed id, bool value);

    constructor(address currency) {
        require(currency.code.length > 0, "Invalid token");
        token = IERC20(currency);
    }
    function publish(string calldata title, string calldata summary, string calldata body, string calldata link, uint8 category) external {
        require(bytes(title).length > 0 && bytes(title).length <= 120, "Invalid title");
        require(bytes(summary).length > 0 && bytes(summary).length <= 480, "Invalid summary");
        require(bytes(body).length > 0 && bytes(body).length <= 6000 && bytes(link).length <= 300 && category < 5, "Invalid content");
        uint256 id = creations.length;
        creations.push(Creation(id, msg.sender, title, summary, body, link, category, uint64(block.timestamp), 0, 0, false));
        emit Published(id, msg.sender, category);
    }
    function support(uint256 id, uint256 amount) external nonReentrant {
        Creation storage c = creations[id];
        require(!c.archived && c.author != msg.sender && amount > 0, "Invalid support");
        c.support += amount;
        received[c.author] += amount;
        totalSupport += amount;
        token.safeTransferFrom(msg.sender, c.author, amount);
        emit Supported(id, msg.sender, amount);
    }
    function setSaved(uint256 id, bool value) external {
        Creation storage c = creations[id];
        require(saved[id][msg.sender] != value, "Already set");
        saved[id][msg.sender] = value;
        if (value) { c.saves++; contributed[msg.sender]++; }
        else { c.saves--; contributed[msg.sender]--; }
        emit BookmarkChanged(id, msg.sender, value);
    }
    function setArchived(uint256 id, bool value) external {
        Creation storage c = creations[id];
        require(msg.sender == c.author && c.archived != value, "Forbidden");
        c.archived = value;
        emit ArchiveChanged(id, value);
    }
    function creationCount() external view returns (uint256) { return creations.length; }
    function getCreation(uint256 id) external view returns (Creation memory) { return creations[id]; }
    /// @notice Newest first, bounded read; full catalogue search is assembled from paginated calls.
    function listCreations(uint256 offset, uint256 limit) external view returns (Creation[] memory result) {
        require(limit > 0 && limit <= 20, "Invalid page");
        uint256 n = creations.length;
        if (offset >= n) return new Creation[](0);
        uint256 count = n - offset < limit ? n - offset : limit;
        result = new Creation[](count);
        for (uint256 i; i < count; i++) result[i] = creations[n - 1 - offset - i];
    }
}
