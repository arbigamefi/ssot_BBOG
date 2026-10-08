// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/Test.sol";
import "forge-std/StdInvariant.sol";
import {Bank} from "../../src/core/Bank.sol";
import {LiquidityVault} from "../../src/core/LiquidityVault.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {BankTestBase, TestRandomnessConsumer} from "../utils/BankTestBase.sol";

contract NftBankHandler is BankTestBase {
    Bank public immutable bank;
    LiquidityVault public immutable vault;
    MockERC20 public immutable asset;
    address[3] public owners = [address(0xA11), address(0xB22), address(0xC33)];

    struct Position {
        uint256 stake;
        uint256 reserve;
        bool open;
    }
    Position[] public positions;
    uint256 public held;
    uint256 public settled;
    uint256 public refunded;
    uint256 public withdrawals;
    uint256 public transferred;
    uint256 public paidToPlayers;
    uint256 public initialSupply;
    uint256 public bankDonation;
    uint256 public vaultDonation;

    constructor(Bank bank_, MockERC20 token) {
        bank = bank_;
        asset = token;
        vault = LiquidityVault(bank_.vault());
        token.approve(address(bank_), type(uint256).max);
        token.mint(address(this), 1_000_000e6);
        for (uint256 i; i < owners.length; ++i) {
            token.mint(owners[i], 1_000_000e6);
            vm.prank(owners[i]);
            token.approve(address(vault), type(uint256).max);
        }
        initialSupply = token.totalSupply();
    }

    function seed() external {
        for (uint256 i; i < owners.length; ++i) {
            vm.prank(owners[i]);
            vault.addDeposit(100_000e6);
        }
    }

    function action_deposit(uint256 who, uint256 raw) external {
        address owner = owners[who % 3];
        uint256 available = asset.balanceOf(owner);
        if (available == 0) return;
        uint256 amount = bound(raw, 1, available);
        vm.prank(owner);
        try vault.addDeposit(amount) {} catch {}
    }

    function action_hold(uint256 rawStake, uint256 rawReserve) external {
        if (asset.balanceOf(address(this)) == 0) return;
        uint256 stake = bound(rawStake, 1, min(asset.balanceOf(address(this)), 100e6));
        uint256 reserve = bound(rawReserve, stake, 500e6);
        uint256 id = positions.length + 1;
        try bank.holdBet(id, owners[id % 3], stake, reserve, bytes32(id), address(this)) {
            positions.push(Position(stake, reserve, true));
            held++;
        } catch {}
    }

    function action_settle(uint256 seed_, uint256 rawCost, uint256 rawFee) external {
        if (positions.length == 0) return;
        uint256 i = seed_ % positions.length;
        Position storage p = positions[i];
        if (!p.open) return;
        uint256 cost = bound(rawCost, 0, p.reserve);
        uint256 fee = bound(rawFee, 0, cost);
        SSOTTypes.XPAward[] memory awards = new SSOTTypes.XPAward[](0);
        bank.settleBet(i + 1, cost - fee, cost - fee, 0, fee, awards);
        p.open = false;
        settled++;
        paidToPlayers += cost - fee;
    }

    function action_refund(uint256 seed_) external {
        if (positions.length == 0) return;
        uint256 i = seed_ % positions.length;
        Position storage p = positions[i];
        if (!p.open) return;
        bank.refundBet(i + 1, p.stake);
        p.open = false;
        refunded++;
        paidToPlayers += p.stake;
    }

    function action_withdraw(uint256 rawId, uint256 rawPercent) external {
        uint256 supply = vault.totalSupply();
        if (supply == 0) return;
        uint48 id = uint48(vault.tokenByIndex(rawId % supply));
        address owner = vault.ownerOf(id);
        vm.prank(owner);
        try vault.withdrawDeposit(id, uint40(bound(rawPercent, 1, 1e12))) returns (uint128 amount) {
            withdrawals += amount;
        } catch {}
    }

    function action_transfer(uint256 rawId, uint256 who) external {
        uint256 supply = vault.totalSupply();
        if (supply == 0) return;
        uint256 id = vault.tokenByIndex(rawId % supply);
        address owner = vault.ownerOf(id);
        vm.prank(owner);
        vault.transferFrom(owner, owners[who % 3], id);
        transferred++;
    }

    function action_time(uint256 raw) external {
        vm.warp(block.timestamp + bound(raw, 0, 2 days));
    }

    function action_donate(uint256 raw, bool toVault) external {
        uint256 available = asset.balanceOf(address(this));
        if (available == 0) return;
        uint256 amount = bound(raw, 0, min(available, 10e6));
        asset.transfer(toVault ? address(vault) : address(bank), amount);
        if (toVault) vaultDonation += amount;
        else bankDonation += amount;
    }

    function mirrors() external view returns (uint256 p, uint256 r, uint256 count) {
        for (uint256 i; i < positions.length; ++i) {
            if (positions[i].open) {
                p += positions[i].stake;
                r += positions[i].reserve;
                count++;
            }
        }
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}

contract BankInvariants is StdInvariant, Test {
    MockERC20 internal asset;
    Bank internal bank;
    NftBankHandler internal handler;

    function setUp() external {
        asset = new MockERC20("USDC", "USDC", 6);
        bank = new Bank(address(asset), address(this), 1000, 6, 1);
        handler = new NftBankHandler(bank, asset);
        bank.setSettlementRouterOnce(address(handler));
        bank.setRandomnessConsumerOnce(address(new TestRandomnessConsumer(address(handler))));
        handler.seed();
        bytes4[] memory selectors = new bytes4[](8);
        selectors[0] = handler.action_deposit.selector;
        selectors[1] = handler.action_hold.selector;
        selectors[2] = handler.action_settle.selector;
        selectors[3] = handler.action_refund.selector;
        selectors[4] = handler.action_withdraw.selector;
        selectors[5] = handler.action_transfer.selector;
        selectors[6] = handler.action_time.selector;
        selectors[7] = handler.action_donate.selector;
        targetSelector(FuzzSelector(address(handler), selectors));
        targetContract(address(handler));
    }

    function invariant_twoCustodianAccountingAndPositionMirror() public view {
        SSOTTypes.SSOT memory s = bank.getSSOT();
        (uint256 p, uint256 r, uint256 count) = handler.mirrors();
        assertTrue(s.accountingValid);
        assertEq(s.P, p);
        assertEq(s.R, r);
        assertEq(s.K, r - p);
        assertEq(s.G, s.L + p);
        assertEq(bank.openHolds(), count);
        assertLe(count, bank.MAX_OPEN_HOLDS());
        assertLe(s.K, s.L);
        assertEq(s.bankCash, p + s.PF + s.XP + s.PP + handler.bankDonation());
        assertEq(s.vaultCash, s.L + handler.vaultDonation());
        assertEq(bank.totalBetsHeld(), handler.held());
        assertEq(bank.totalBetsSettled(), handler.settled());
        assertEq(bank.totalBetsRefunded(), handler.refunded());
        assertEq(handler.held() - handler.settled() - handler.refunded(), count);
    }

    function invariant_totalTokenConservation() public view {
        uint256 cash =
            asset.balanceOf(address(bank)) + asset.balanceOf(bank.vault()) + asset.balanceOf(address(handler));
        for (uint256 i; i < 3; ++i) {
            cash += asset.balanceOf(handler.owners(i));
        }
        assertEq(cash, handler.initialSupply());
        assertEq(asset.totalSupply(), handler.initialSupply());
    }

    /// Tree invariant I (every positive internal node has a positive child) keeps all root capital on live NFTs.
    /// The k > 0 allocation skips the vendor preview on that basis; a path booking value into an empty root breaks it.
    function invariant_rootCapitalIsHeldByLiveNfts() public view {
        LiquidityVault v = LiquidityVault(bank.vault());
        uint256 sum;
        uint256 n = v.totalSupply();
        for (uint256 i; i < n; ++i) {
            sum += v.nodeWithdrawView(uint48(v.tokenByIndex(i)));
        }
        assertEq(sum, v.getReserve());
    }

    /// P3, the premise of the vendor UNUSED_SUFFIX patch: nodes whose whole range lies after the last deposit
    /// hold nothing. Sums the same canonical cover of [nextNode, last leaf] as the tree's range query.
    function invariant_noValueAfterLastDeposit() public view {
        LiquidityVault v = LiquidityVault(bank.vault());
        uint48 l = v.nextNode();
        uint48 r = (uint48(1) << 41) - 1;
        uint256 sum;
        uint128 amount;
        while (l <= r) {
            if (l & 1 != 0) {
                (, amount) = v.treeNode(l++);
                sum += amount;
            }
            if (r & 1 == 0) {
                (, amount) = v.treeNode(r--);
                sum += amount;
            }
            l >>= 1;
            r >>= 1;
        }
        assertEq(sum, 0);
    }

    function test_nonVacuousDepositHoldSettleRefundWithdrawalTrace() external {
        handler.action_hold(10e6, 20e6);
        handler.action_hold(20e6, 80e6);
        handler.action_settle(0, 15e6, 1e6);
        handler.action_refund(1);
        handler.action_transfer(0, 1);
        assertEq(handler.transferred(), 1);
        handler.action_time(1 days);
        handler.action_withdraw(0, 1e12);
        assertEq(handler.held(), 2);
        assertEq(handler.settled(), 1);
        assertEq(handler.refunded(), 1);
        assertGt(handler.withdrawals(), 0);
        invariant_twoCustodianAccountingAndPositionMirror();
        invariant_totalTokenConservation();
        invariant_rootCapitalIsHeldByLiveNfts();
        invariant_noValueAfterLastDeposit();
    }
}
