// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "forge-std/StdInvariant.sol";

import {Bank} from "../../src/core/Bank.sol";
import {PoolRegistry} from "../../src/core/PoolRegistry.sol";
import {SettlementRouter} from "../../src/core/SettlementRouter.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {HouseEdgeLib} from "../../src/libs/HouseEdgeLib.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";

contract SettlementRouterHandler is Test {
    MockERC20 public asset;
    Bank public casinoBank;
    Bank public sportsBank;
    PoolRegistry public poolRegistry;
    SettlementRouter public router;

    address public gov;
    address public casinoHub;
    address public sportsHub;
    address public attackerHub;

    address[] public players;
    uint256[] public positionIds;
    uint256[] public heldPositionIds;

    uint256 public openReservedCasino;
    uint256 public openReservedSports;
    uint256 public openedCount;

    uint256 public vUnauthorizedSettlement;
    uint256 public vBankBypass;
    uint256 public vWrongPoolOpen;
    uint256 public vAllocationAboveCap;
    uint256 public vEdgeAboveMax;
    uint256 public settledWithinCap;

    struct Mirror {
        address ownerHub;
        uint64 poolId;
        address bank;
        address player;
        uint256 stake;
        uint256 reserved;
        bytes32 snapshotHash;
        uint16 edgeBps;
        SSOTTypes.PositionState state;
    }

    mapping(uint256 => Mirror) public mirrors;
    mapping(uint256 => uint256) internal heldIndexPlusOne;

    constructor(
        MockERC20 asset_,
        Bank casinoBank_,
        Bank sportsBank_,
        PoolRegistry poolRegistry_,
        SettlementRouter router_,
        address gov_,
        address casinoHub_,
        address sportsHub_,
        address attackerHub_
    ) {
        asset = asset_;
        casinoBank = casinoBank_;
        sportsBank = sportsBank_;
        poolRegistry = poolRegistry_;
        router = router_;
        gov = gov_;
        casinoHub = casinoHub_;
        sportsHub = sportsHub_;
        attackerHub = attackerHub_;

        for (uint256 i = 0; i < 8; ++i) {
            address player = address(uint160(uint256(keccak256(abi.encode("router-player", i + 1)))));
            players.push(player);
            asset.mint(player, 250_000e6);
            vm.startPrank(player);
            asset.approve(address(casinoBank), type(uint256).max);
            asset.approve(address(sportsBank), type(uint256).max);
            vm.stopPrank();
        }
    }

    function positionIdsLength() external view returns (uint256) {
        return positionIds.length;
    }

    function action_openPosition(uint256 seed, uint256 stakeRaw, uint256 reserveRaw, uint16 edgeRaw) external {
        (uint64 poolId, address ownerHub, Bank bank) = _pickPool(seed);
        try poolRegistry.isPoolActive(poolId) returns (bool active) {
            if (!active) return;
        } catch {
            return;
        }

        address player = players[seed % players.length];
        uint256 stake = bound(stakeRaw, 1e6, 5_000e6);
        uint256 reserved = bound(reserveRaw, stake, stake * 10);
        bytes32 snapshotHash = keccak256(abi.encode(poolId, ownerHub, player, stake, reserved, openedCount));
        // Casino hubs price with an edge up to the cap; sports hubs carry none.
        uint16 edgeBps = ownerHub == casinoHub ? uint16(bound(edgeRaw, 0, HouseEdgeLib.MAX_HOUSE_EDGE_BPS)) : 0;

        vm.prank(ownerHub);
        try router.openPosition(poolId, player, stake, reserved, snapshotHash, edgeBps) returns (uint256 positionId) {
            positionIds.push(positionId);
            heldPositionIds.push(positionId);
            heldIndexPlusOne[positionId] = heldPositionIds.length;
            ++openedCount;

            mirrors[positionId] = Mirror({
                ownerHub: ownerHub,
                poolId: poolId,
                bank: address(bank),
                player: player,
                stake: stake,
                reserved: reserved,
                snapshotHash: snapshotHash,
                edgeBps: edgeBps,
                state: SSOTTypes.PositionState.Held
            });

            if (bank == casinoBank) openReservedCasino += reserved;
            else openReservedSports += reserved;
        } catch {}
    }

    /// @dev Splits a claimed allocation between protocol fees and one XP award, and sometimes claims more than
    ///      the operator share of the recorded edge. The Router must accept exactly the claims within the cap.
    function action_settlePosition(
        uint256 seed,
        uint256 payoutRaw,
        uint256 refundRaw,
        uint16 feeBpsRaw,
        uint256 allocRaw,
        uint256 splitRaw
    ) external {
        uint256 positionId = _pickHeldPosition(seed);
        if (positionId == 0) return;

        Mirror storage m = mirrors[positionId];
        uint256 payoutGross = bound(payoutRaw, 0, m.reserved);
        uint256 refundMax = m.reserved - payoutGross;
        if (refundMax > m.stake) refundMax = m.stake;
        uint256 refundAmount = bound(refundRaw, 0, refundMax);

        uint16 feeBps = uint16(bound(uint256(feeBpsRaw), 0, 1_000));
        uint256 payoutNet = payoutGross - payoutGross * uint256(feeBps) / 10_000;

        uint256 cap = HouseEdgeLib.operatorShare(HouseEdgeLib.turnoverEdge(m.stake - refundAmount, m.edgeBps));
        uint256 allocated = bound(allocRaw, 0, cap + 2);
        uint256 xp = bound(splitRaw, 0, allocated);
        SSOTTypes.XPAward[] memory awards = new SSOTTypes.XPAward[](xp == 0 ? 0 : 1);
        if (xp > 0) {
            awards[0] = SSOTTypes.XPAward({
                payee: players[(seed >> 8) % players.length],
                sourcePlayer: m.player,
                accrued: xp / 2,
                locked: 0,
                holdback: xp - xp / 2,
                reason: bytes32("fuzz")
            });
        }

        vm.prank(m.ownerHub);
        try router.settlePosition(positionId, payoutGross, payoutNet, refundAmount, allocated - xp, awards) {
            if (allocated > cap) ++vAllocationAboveCap;
            else ++settledWithinCap;
            _terminalize(positionId, SSOTTypes.PositionState.Settled);
        } catch {}
    }

    function action_refundPosition(uint256 seed, uint256 refundRaw) external {
        uint256 positionId = _pickHeldPosition(seed);
        if (positionId == 0) return;

        Mirror storage m = mirrors[positionId];
        uint256 refundAmount = bound(refundRaw, 0, m.stake);

        vm.prank(m.ownerHub);
        try router.refundPosition(positionId, refundAmount) {
            _terminalize(positionId, SSOTTypes.PositionState.Refunded);
        } catch {}
    }

    function action_togglePoolActive(uint256 seed, bool active) external {
        (uint64 poolId,,) = _pickPool(seed);
        vm.prank(gov);
        try poolRegistry.setPoolActive(poolId, active) {} catch {}
    }

    function action_wrongOwnerCannotSettleOrRefund(uint256 seed, uint256 refundRaw) external {
        uint256 positionId = _pickHeldPosition(seed);
        if (positionId == 0) return;

        Mirror storage m = mirrors[positionId];
        address wrongHub = m.ownerHub == casinoHub ? sportsHub : casinoHub;
        uint256 refundAmount = bound(refundRaw, 0, m.stake);
        SSOTTypes.XPAward[] memory awards = new SSOTTypes.XPAward[](0);

        vm.prank(wrongHub);
        try router.settlePosition(positionId, 0, 0, 0, 0, awards) {
            ++vUnauthorizedSettlement;
        } catch {}

        vm.prank(wrongHub);
        try router.refundPosition(positionId, refundAmount) {
            ++vUnauthorizedSettlement;
        } catch {}
    }

    function action_edgeAboveMaxCannotOpen(uint256 seed, uint256 stakeRaw, uint16 edgeRaw) external {
        (uint64 poolId, address ownerHub,) = _pickPool(seed);
        address player = players[seed % players.length];
        uint256 stake = bound(stakeRaw, 1e6, 5_000e6);
        uint16 edgeBps = uint16(bound(edgeRaw, uint256(HouseEdgeLib.MAX_HOUSE_EDGE_BPS) + 1, type(uint16).max));

        vm.prank(ownerHub);
        try router.openPosition(poolId, player, stake, stake, keccak256("EDGE"), edgeBps) returns (uint256) {
            ++vEdgeAboveMax;
        } catch {}
    }

    function action_registeredHubCannotOpenWrongPool(uint256 seed, uint256 stakeRaw, uint256 reserveRaw) external {
        (uint64 poolId, address ownerHub,) = _pickPool(seed);
        address wrongHub = ownerHub == casinoHub ? sportsHub : casinoHub;
        address player = players[seed % players.length];
        uint256 stake = bound(stakeRaw, 1e6, 5_000e6);
        uint256 reserved = bound(reserveRaw, stake, stake * 10);

        vm.prank(wrongHub);
        try router.openPosition(poolId, player, stake, reserved, keccak256("WRONG_POOL"), 0) returns (uint256) {
            ++vWrongPoolOpen;
        } catch {}
    }

    function action_verticalHubCannotBypassRouter(uint256 seed) external {
        uint256 positionId = positionIds.length == 0 ? 1 : positionIds[seed % positionIds.length];
        (,, Bank bank) = _pickPool(seed);
        address player = players[seed % players.length];
        SSOTTypes.XPAward[] memory awards = new SSOTTypes.XPAward[](0);

        vm.prank(attackerHub);
        try bank.holdBet(positionId, player, 1e6, 2e6, keccak256("BYPASS")) {
            ++vBankBypass;
        } catch {}

        vm.prank(attackerHub);
        try bank.settleBet(positionId, 0, 0, 0, 0, awards) {
            ++vBankBypass;
        } catch {}

        vm.prank(attackerHub);
        try bank.refundBet(positionId, 0) {
            ++vBankBypass;
        } catch {}
    }

    function assertSampledPositions() external view {
        uint256 n = positionIds.length;
        if (n <= 32) {
            for (uint256 i = 0; i < n; ++i) {
                _assertPosition(positionIds[i]);
            }
            return;
        }

        for (uint256 i = 0; i < 16; ++i) {
            _assertPosition(positionIds[i]);
            _assertPosition(positionIds[n - 16 + i]);
        }
    }

    function _assertPosition(uint256 positionId) internal view {
        Mirror storage m = mirrors[positionId];
        SSOTTypes.Position memory pos = router.getPosition(positionId);

        assertEq(pos.positionId, positionId, "position id changed");
        assertEq(pos.ownerHub, m.ownerHub, "owner hub changed");
        assertEq(pos.poolId, m.poolId, "pool id changed");
        assertEq(pos.asset, address(asset), "asset changed");
        assertEq(pos.bank, m.bank, "bank changed");
        assertEq(pos.player, m.player, "player changed");
        assertEq(pos.stake, m.stake, "stake changed");
        assertEq(pos.reserved, m.reserved, "reserved changed");
        assertEq(pos.snapshotHash, m.snapshotHash, "snapshot changed");
        assertEq(pos.edgeBps, m.edgeBps, "edge changed");
        assertEq(uint256(pos.state), uint256(m.state), "position state changed unexpectedly");

        _assertBankHold(positionId, m);
    }

    function _assertBankHold(uint256 positionId, Mirror storage m) internal view {
        Bank rightBank = Bank(m.bank);
        Bank wrongBank = rightBank == casinoBank ? sportsBank : casinoBank;

        (address player, uint256 stake, uint256 reserved, bytes32 snapshotHash, bool open) = rightBank.holds(positionId);
        assertEq(player, m.player, "right bank player mismatch");
        assertEq(stake, m.stake, "right bank stake mismatch");
        assertEq(reserved, m.reserved, "right bank reserved mismatch");
        assertEq(snapshotHash, m.snapshotHash, "right bank snapshot mismatch");
        assertEq(open, m.state == SSOTTypes.PositionState.Held, "right bank open mismatch");

        (address wrongPlayer,,,, bool wrongOpen) = wrongBank.holds(positionId);
        assertEq(wrongPlayer, address(0), "wrong bank has position player");
        assertFalse(wrongOpen, "wrong bank has open position");
    }

    function _terminalize(uint256 positionId, SSOTTypes.PositionState terminalState) internal {
        Mirror storage m = mirrors[positionId];
        if (m.state != SSOTTypes.PositionState.Held) return;

        if (m.bank == address(casinoBank)) openReservedCasino -= m.reserved;
        else openReservedSports -= m.reserved;

        m.state = terminalState;
        _removeHeldPosition(positionId);
    }

    function _removeHeldPosition(uint256 positionId) internal {
        uint256 indexPlusOne = heldIndexPlusOne[positionId];
        if (indexPlusOne == 0) return;

        uint256 index = indexPlusOne - 1;
        uint256 lastIndex = heldPositionIds.length - 1;
        if (index != lastIndex) {
            uint256 movedPositionId = heldPositionIds[lastIndex];
            heldPositionIds[index] = movedPositionId;
            heldIndexPlusOne[movedPositionId] = index + 1;
        }

        heldPositionIds.pop();
        delete heldIndexPlusOne[positionId];
    }

    function _pickPool(uint256 seed) internal view returns (uint64 poolId, address ownerHub, Bank bank) {
        if (seed % 2 == 0) {
            return (1, casinoHub, casinoBank);
        }
        return (2, sportsHub, sportsBank);
    }

    function _pickHeldPosition(uint256 seed) internal view returns (uint256 positionId) {
        uint256 n = heldPositionIds.length;
        if (n == 0) return 0;
        return heldPositionIds[seed % n];
    }
}

contract SettlementRouterInvariants is StdInvariant, Test {
    MockERC20 internal usdc;
    Bank internal casinoBank;
    Bank internal sportsBank;
    PoolRegistry internal poolRegistry;
    SettlementRouter internal router;
    SettlementRouterHandler internal handler;

    address internal gov = address(0xA11CE);
    address internal casinoHub = address(0xCA51);
    address internal sportsHub = address(0x5B07);
    address internal attackerHub = address(0xBAD);

    function setUp() external {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        casinoBank = new Bank(address(usdc), gov, 0, "Casino LP USDC", "clpUSDC", 6);
        sportsBank = new Bank(address(usdc), gov, 0, "Sports LP USDC", "slpUSDC", 6);
        poolRegistry = new PoolRegistry(gov);
        router = new SettlementRouter(address(poolRegistry));

        vm.startPrank(gov);
        poolRegistry.registerPool(1, address(usdc), address(casinoBank), SSOTTypes.PoolDomain.Casino);
        poolRegistry.registerPool(2, address(usdc), address(sportsBank), SSOTTypes.PoolDomain.Sports);
        poolRegistry.setHubRegistered(casinoHub, true);
        poolRegistry.setHubRegistered(sportsHub, true);
        poolRegistry.setHubAllowedForPool(1, casinoHub, true);
        poolRegistry.setHubAllowedForPool(2, sportsHub, true);
        casinoBank.setSettlementRouterOnce(address(router));
        sportsBank.setSettlementRouterOnce(address(router));

        usdc.mint(gov, 20_000_000e6);
        usdc.approve(address(casinoBank), type(uint256).max);
        usdc.approve(address(sportsBank), type(uint256).max);
        casinoBank.deposit(5_000_000e6, gov);
        sportsBank.deposit(5_000_000e6, gov);
        vm.stopPrank();

        handler = new SettlementRouterHandler(
            usdc, casinoBank, sportsBank, poolRegistry, router, gov, casinoHub, sportsHub, attackerHub
        );
        targetContract(address(handler));

        bytes4[] memory selectors = new bytes4[](8);
        selectors[0] = SettlementRouterHandler.action_openPosition.selector;
        selectors[1] = SettlementRouterHandler.action_settlePosition.selector;
        selectors[2] = SettlementRouterHandler.action_refundPosition.selector;
        selectors[3] = SettlementRouterHandler.action_togglePoolActive.selector;
        selectors[4] = SettlementRouterHandler.action_wrongOwnerCannotSettleOrRefund.selector;
        selectors[5] = SettlementRouterHandler.action_registeredHubCannotOpenWrongPool.selector;
        selectors[6] = SettlementRouterHandler.action_verticalHubCannotBypassRouter.selector;
        selectors[7] = SettlementRouterHandler.action_edgeAboveMaxCannotOpen.selector;

        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    function invariant_router_reserved_matches_bank_reserved_by_pool() external view {
        assertEq(casinoBank.totalReserved(), handler.openReservedCasino(), "casino reserved mismatch");
        assertEq(sportsBank.totalReserved(), handler.openReservedSports(), "sports reserved mismatch");
    }

    function invariant_router_positions_are_pool_isolated_and_stable() external view {
        handler.assertSampledPositions();
    }

    function invariant_no_wrong_owner_or_bank_bypass() external view {
        assertEq(handler.vUnauthorizedSettlement(), 0, "wrong owner settled/refunded");
        assertEq(handler.vBankBypass(), 0, "hub bypassed router");
        assertEq(handler.vWrongPoolOpen(), 0, "hub opened unallowed pool");
    }

    /// @notice ExecutableSSOT v1.6 A2 and A8: no settlement accrues more than the operator share of the edge the
    ///         position was opened with, and no position opens above MAX_HOUSE_EDGE_BPS.
    function invariant_allocation_never_exceeds_operator_share() external view {
        assertEq(handler.vAllocationAboveCap(), 0, "settlement accrued above the operator share");
        assertEq(handler.vEdgeAboveMax(), 0, "position opened above the edge cap");
    }

    function invariant_next_position_id_matches_successful_opens() external view {
        assertEq(router.nextPositionId(), handler.openedCount() + 1, "nextPositionId drift");
    }
}
