// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {IBank} from "../../src/core/interfaces/IBank.sol";
import {IPoolRegistry} from "../../src/core/interfaces/IPoolRegistry.sol";
import {ILiquidityVaultBank} from "../../src/core/interfaces/ILiquidityVaultBank.sol";
import {SettlementRouter} from "../../src/core/SettlementRouter.sol";
import {LiquidityVault} from "../../src/core/LiquidityVault.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {Errors} from "../../src/libs/Errors.sol";
import {BlacklistToken} from "../mocks/BlacklistToken.sol";
import {LaunchFixture} from "../utils/LaunchFixture.sol";

/// @dev The audit's rogue hub (F-03): it funds its own stake and settles at the full reserve.
contract AuditRogueHub {
    function drain(SettlementRouter router, uint64 poolId, BlacklistToken token, address bank, uint256 stake, uint256 reserved)
        external
        returns (uint256 id)
    {
        token.approve(bank, stake);
        id = router.openPosition(poolId, address(this), stake, reserved, bytes32(0), 0);
        router.settlePosition(id, reserved, reserved, 0, 0, new SSOTTypes.XPAward[](0));
    }
}

/// @dev The same hub claiming the timelock as its governance, which any contract can do (design review R5).
contract AuditRogueHubClaimingGovernance is AuditRogueHub {
    address public immutable governance;
    address public constant pendingGovernance = address(0);

    constructor(address governance_) {
        governance = governance_;
    }
}

/// @dev The audit's opener (F-05), extended to open for any player.
contract AuditOpener {
    address public immutable governance;
    address public constant pendingGovernance = address(0);

    constructor(address governance_) {
        governance = governance_;
    }

    function open(SettlementRouter router, uint64 poolId, address player, BlacklistToken token, address bank)
        external
        returns (uint256)
    {
        token.approve(bank, 10_000);
        return router.openPosition(poolId, player, 10_000, 20_000, bytes32(0), 0);
    }
}

/// @notice Work package B8: the audit and review proofs of concept as regressions on the launch candidate. Each
///         attack the PoC demonstrated against the earlier code now fails. Scenarios already covered elsewhere are
///         listed here, not repeated:
///         - audit F-01, F-02 (release chain): CertifiedRuntime.t.sol, CallbackDomainV16.t.sol;
///         - audit module census and tree differential: test/diff/AuditModuleCensus.t.sol, AuditTreeDifferential.t.sol;
///         - plan review P1, P2 and design review P1, P3, P4, R1-R7: LaunchAuthority.t.sol;
///         - plan review P5a, P5b, P5c and design review V1-V13, C1, G1: VoidBet.t.sol (issuer freeze, accounting
///           fault), BankNFTAccounting.t.sol, SettlementRouter.t.sol and GameHubE2E.t.sol (C1, C2, G1, G2);
///         - plan review P6: LaunchAuthority.t.sol (no delay below 72 hours at construction or later, and no
///           bootstrap proposer under decision D1, so no operation can be queued under a shorter delay).
contract AuditRegressionTest is LaunchFixture {
    function setUp() public {
        _launch();
        vm.warp(vm.getBlockTimestamp() + 1 days); // the LP's NFT is mature
    }

    /// Audit F-03: a hub admitted by governance used to drain the LP in the block of its admission. The audit's
    /// hub is now refused outright, and one that claims the timelock waits 72 hours while the LP leaves.
    function test_F03_admissionNoLongerDrainsTheLpWithoutAnExitWindow() public {
        AuditRogueHub rogue = new AuditRogueHub();
        vm.prank(SAFE);
        vm.expectRevert(Errors.Unauthorized.selector);
        registry.setHubRegistered(address(rogue), true);
        (address[] memory t, bytes[] memory d) =
            _one(address(registry), abi.encodeCall(registry.setHubRegistered, (address(rogue), true)));
        _schedule(t, d, "audit rogue");
        vm.warp(vm.getBlockTimestamp() + DELAY);
        vm.expectRevert(abi.encodeWithSelector(IPoolRegistry.ForeignGovernance.selector, address(rogue)));
        _execute(t, d, "audit rogue");

        AuditRogueHubClaimingGovernance claimant = new AuditRogueHubClaimingGovernance(address(tl));
        token.mint(address(claimant), 1_000e6);
        t = new address[](2);
        d = new bytes[](2);
        t[0] = address(registry);
        d[0] = abi.encodeCall(registry.setHubRegistered, (address(claimant), true));
        t[1] = address(registry);
        d[1] = abi.encodeCall(registry.setHubAllowedForPool, (POOL, address(claimant), true));
        uint256 queuedAt = vm.getBlockTimestamp();
        _schedule(t, d, "claimant");
        vm.warp(queuedAt + 1 hours);
        vm.prank(LP);
        assertEq(vault.withdrawDeposit(lpId, ONE), 10_000e6, "the LP leaves inside the window");
        vm.warp(queuedAt + DELAY);
        _execute(t, d, "claimant");
        vm.expectRevert(IBank.SolvencyViolation.selector);
        claimant.drain(router, POOL, token, address(bank), 10_000, 20_000);
    }

    /// Audit F-04: a guardian pause used to close every LP exit until governance unpaused. The guardian still
    /// cannot unpause, but the mature LP exits in full while the pause lasts.
    function test_F04_guardianPauseNoLongerFreezesAMatureLpExit() public {
        vm.prank(GUARDIAN);
        bank.setRiskInPaused(true);
        vm.prank(GUARDIAN);
        vm.expectRevert(Errors.Unauthorized.selector);
        bank.setRiskInPaused(false);
        vm.prank(LP);
        assertEq(vault.withdrawDeposit(lpId, ONE), 10_000e6);
        assertTrue(bank.riskInPaused());
    }

    /// Audit F-05: one player used to fill all 128 open holds of a Bank. A player now holds at most two, through
    /// any hub; filling the Bank takes 64 addresses (residual R-4).
    function test_F05_onePlayerNoLongerFillsTheBankWideHoldCap() public {
        AuditOpener opener = new AuditOpener(address(tl));
        address[] memory t = new address[](2);
        bytes[] memory d = new bytes[](2);
        t[0] = address(registry);
        d[0] = abi.encodeCall(registry.setHubRegistered, (address(opener), true));
        t[1] = address(registry);
        d[1] = abi.encodeCall(registry.setHubAllowedForPool, (POOL, address(opener), true));
        _schedule(t, d, "opener");
        vm.warp(vm.getBlockTimestamp() + DELAY);
        _execute(t, d, "opener");
        token.mint(address(opener), 10e6);

        address player = address(0x10000);
        opener.open(router, POOL, player, token, address(bank));
        opener.open(router, POOL, player, token, address(bank));
        vm.expectRevert(abi.encodeWithSelector(IBank.PlayerOpenHoldLimit.selector, player));
        opener.open(router, POOL, player, token, address(bank));

        for (uint256 i = 1; i < 64; ++i) {
            opener.open(router, POOL, address(uint160(0x10000 + i)), token, address(bank));
            opener.open(router, POOL, address(uint160(0x10000 + i)), token, address(bank));
        }
        assertEq(bank.openHolds(), 128);
        vm.expectRevert(IBank.OpenHoldLimit.selector);
        opener.open(router, POOL, address(0x20000), token, address(bank));
    }

    /// Plan review P3: an unbookable result used to keep the LP fence closed for the whole 72-hour window. The
    /// guardian now opens a void window at once, anyone voids 24 hours after the request, and the LP exits two days
    /// before a queued admission can execute. Without a window the 7-day public void applies (ADR-0037 §7.3).
    function test_P3_anUnbookableResultNoLongerSpansTheTimelockWindow() public {
        uint256 t0 = vm.getBlockTimestamp();
        uint256 bet = _bet(ALICE, GAME_DEFECT, 10e6, address(0));
        _fulfill(bet, 7);
        assertEq(uint8(vault.depositState(lpId).status), uint8(ILiquidityVaultBank.LPStatus.UnbookedResult));
        AuditRogueHubClaimingGovernance claimant = new AuditRogueHubClaimingGovernance(address(tl));
        (address[] memory t, bytes[] memory d) =
            _one(address(registry), abi.encodeCall(registry.setHubRegistered, (address(claimant), true)));
        _schedule(t, d, "admit");
        vm.prank(GUARDIAN);
        hub.openVoidWindow(POOL);

        vm.warp(t0 + 24 hours);
        vm.prank(KEEPER);
        assertTrue(hub.voidBet(bet));
        assertEq(uint8(vault.depositState(lpId).status), uint8(ILiquidityVaultBank.LPStatus.Ready));
        vm.prank(LP);
        assertEq(vault.withdrawDeposit(lpId, ONE), 10_000e6);
        vm.expectRevert();
        _execute(t, d, "admit");
    }

    /// Plan review P4, disclosed as residual R-2: while open holds lock capital a sole LP exits only L - K, and that
    /// partial success restarts the 24-hour cooldown, so a full exit is not guaranteed while betting continues.
    function test_P4_aPartialExitRestartsTheCooldown() public {
        _bet(ALICE, GAME_DICE, 1_000e6, address(0));
        _bet(BOB, GAME_DICE, 1_000e6, address(0));
        LiquidityVault.DepositState memory s = vault.depositState(lpId);
        assertLt(s.maxPercent, ONE, "only a partial exit is executable");
        assertEq(s.maxAssets, vault.getReserve() - vault.lockedLiquidity());
        vm.prank(LP);
        assertEq(vault.withdrawDeposit(lpId, s.maxPercent), s.maxAssets);
        assertEq(vault.withdrawAfter(lpId), vm.getBlockTimestamp() + 24 hours, "partial success relocks for 24 h");
        vm.prank(LP);
        vm.expectRevert(
            abi.encodeWithSelector(LiquidityVault.LPUnavailable.selector, ILiquidityVaultBank.LPStatus.CoolingDown)
        );
        vault.withdrawDeposit(lpId, ONE);
    }
}
