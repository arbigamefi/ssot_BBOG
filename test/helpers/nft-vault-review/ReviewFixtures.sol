// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {LiquidityVault} from "../../../src/core/LiquidityVault.sol";
import {ILiquidityVaultBank} from "../../../src/core/interfaces/ILiquidityVaultBank.sol";

/// @dev Local failure/reentrancy model, not a claim about production USDC behavior.
contract ReviewToken is ERC20, IERC721Receiver {
    mapping(address => bool) public blocked;
    bool public shortPay;
    address public hookFrom;
    address public hookTarget;
    bytes public hookData;
    bool public hookAttempted;
    bool public hookSucceeded;
    bytes public hookResult;
    bool private inHook;

    constructor() ERC20("Review asset", "REV") {}

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function mint(address who, uint256 amount) external {
        _mint(who, amount);
    }

    function burn(address who, uint256 amount) external {
        _burn(who, amount);
    }

    function setBlocked(address who, bool value) external {
        blocked[who] = value;
    }

    function setShortPay(bool value) external {
        shortPay = value;
    }

    function setHook(address from, address target, bytes calldata data) external {
        hookFrom = from;
        hookTarget = target;
        hookData = data;
        hookAttempted = false;
        hookSucceeded = false;
        delete hookResult;
    }

    function _update(address from, address to, uint256 amount) internal override {
        require(!blocked[from] && !blocked[to], "review: blocked");
        if (shortPay && from != address(0) && to != address(0) && amount != 0) {
            super._update(from, to, amount - 1);
            super._update(from, address(0), 1);
        } else {
            super._update(from, to, amount);
        }
        if (!inHook && from == hookFrom && hookTarget != address(0)) {
            inHook = true;
            hookAttempted = true;
            (hookSucceeded, hookResult) = hookTarget.call(hookData);
            inHook = false;
        }
    }
}

/// @dev Dependency fixture only. Its fake hold/terminal calls do not validate Router or real Bank logic.
contract ReviewBank is ILiquidityVaultBank {
    ReviewToken public immutable token;
    LiquidityVault public immutable vault;
    uint256 public pending;
    uint256 public reserved;
    uint256 public playerPayable;
    uint256 public protocolCapital;
    LPStatus public status;
    bool public readFails;

    constructor(ReviewToken token_) {
        token = token_;
        vault = new LiquidityVault(address(token_), address(this));
        token_.approve(address(vault), type(uint256).max);
    }

    function lpAccounting() external view returns (uint256, uint256, LPStatus) {
        require(!readFails, "review: unavailable");
        return (pending, reserved, status);
    }

    function setStatus(LPStatus value) external {
        status = value;
    }

    function setReadFails(bool value) external {
        readFails = value;
    }

    function setAccounting(uint256 p, uint256 r) external {
        pending = p;
        reserved = r;
    }

    function hold(uint128 stake, uint128 reserve) external {
        require(reserve >= stake, "review: reserve");
        token.mint(address(this), stake);
        pending += stake;
        reserved += reserve;
        vault.lockLiquidity(reserve - stake);
    }

    function rawLock(uint128 value) external {
        vault.lockLiquidity(value);
    }

    function rawApply(uint48 cutoff, uint128 released, uint128 stake, uint128 cost) external returns (uint128) {
        return vault.applySettlement(cutoff, released, stake, cost);
    }

    function settleToPayable(uint48 cutoff, uint128 stake, uint128 reserve, uint128 cost)
        external
        returns (uint128 capital)
    {
        capital = vault.applySettlement(cutoff, reserve - stake, stake, cost);
        pending -= stake;
        reserved -= reserve;
        playerPayable += cost;
        protocolCapital += capital;
    }

    function payDebt(address player) external {
        uint256 amount = playerPayable;
        playerPayable = 0;
        require(token.transfer(player, amount));
    }
}

contract ReviewNFTReceiver is IERC721Receiver {
    LiquidityVault public immutable vault;
    address public callbackTarget;
    bytes public callbackData;
    bool public reject;
    bool public attempted;
    bool public succeeded;
    bytes public result;
    uint48 public seenId;
    address public seenOwner;
    uint128 public seenAssets;
    uint64 public seenDeadline;
    ILiquidityVaultBank.LPStatus public seenStatus;
    address public transferTo;

    constructor(LiquidityVault vault_) {
        vault = vault_;
    }

    function configure(address target, bytes calldata data, bool reject_, address transferTo_) external {
        callbackTarget = target;
        callbackData = data;
        reject = reject_;
        transferTo = transferTo_;
    }

    function onERC721Received(address, address, uint256 id, bytes calldata) external returns (bytes4) {
        require(msg.sender == address(vault), "review: wrong NFT");
        seenId = uint48(id);
        LiquidityVault.DepositState memory state = vault.depositState(uint48(id));
        seenOwner = state.owner;
        seenAssets = state.assets;
        seenDeadline = state.withdrawAfter;
        seenStatus = state.status;
        if (callbackTarget != address(0)) {
            attempted = true;
            (succeeded, result) = callbackTarget.call(callbackData);
        }
        if (transferTo != address(0)) vault.transferFrom(address(this), transferTo, id);
        require(!reject, "review: rejected NFT");
        return IERC721Receiver.onERC721Received.selector;
    }
}
