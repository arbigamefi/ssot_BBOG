// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/Test.sol";
import {GovernanceTimelock} from "../../src/access/GovernanceTimelock.sol";
import {Bank} from "../../src/core/Bank.sol";
import {GameHub} from "../../src/core/GameHub.sol";
import {LiquidityVault} from "../../src/core/LiquidityVault.sol";
import {PoolRegistry} from "../../src/core/PoolRegistry.sol";
import {SettlementRouter} from "../../src/core/SettlementRouter.sol";
import {VRFHub} from "../../src/core/VRFHub.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {IGameModule} from "../../src/core/interfaces/IGameModule.sol";
import {MockVRFV2PlusWrapper} from "../../src/mocks/MockVRFV2PlusWrapper.sol";
import {ReferralRegistry} from "../../src/engines/referral/ReferralRegistry.sol";
import {DefaultReferralEngine} from "../../src/engines/referral/DefaultReferralEngine.sol";
import {DiceModule} from "../../src/modules/dice/DiceModule.sol";
import {BlacklistToken} from "../mocks/BlacklistToken.sol";

/// @dev A module whose resolve always reverts: every accepted bet is unbookable.
contract RevertingModule is IGameModule {
    function validate(bytes calldata, SSOTTypes.StakeSpec calldata) external pure override {}

    function maxPayout(bytes calldata, SSOTTypes.StakeSpec calldata s) external pure override returns (uint256) {
        return s.amountPerRoll * uint256(s.betCount) * 2;
    }

    function resolve(bytes calldata, SSOTTypes.StakeSpec calldata, uint256, uint256[] calldata)
        external
        pure
        override
        returns (uint256, uint256)
    {
        revert("module defect");
    }
}

/// @dev A module whose resolve consumes all the gas it is given, so a settlement attempt spends its whole budget.
contract GasBurnerModule is IGameModule {
    function validate(bytes calldata, SSOTTypes.StakeSpec calldata) external pure override {}

    function maxPayout(bytes calldata, SSOTTypes.StakeSpec calldata s) external pure override returns (uint256) {
        return s.amountPerRoll * uint256(s.betCount) * 2;
    }

    function resolve(bytes calldata, SSOTTypes.StakeSpec calldata, uint256, uint256[] calldata)
        external
        pure
        override
        returns (uint256 x, uint256)
    {
        while (true) {
            unchecked {
                ++x;
            }
        }
    }
}

/// @notice A system deployed as ADR-0037 decision D1 prescribes: every governed contract is constructed with
///         governance = the timelock, the Safe schedules the wiring batch, anyone executes it after 72 hours, LPs
///         deposit while the pool is inactive, and activation is a second operation.
abstract contract LaunchFixture is Test {
    address internal constant DEPLOYER = address(0xD0);
    address internal constant SAFE = address(0x5AFE);
    address internal constant GUARDIAN = address(0x6A);
    address internal constant NEW_GUARDIAN = address(0x6B);
    address internal constant LP = address(0x1B);
    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant CAROL = address(0xCA201);
    address internal constant KEEPER = address(0xBEEF);
    uint256 internal constant DELAY = 259_200;
    uint64 internal constant POOL = 1;
    uint32 internal constant CALLBACK_GAS = 2_447_746;
    uint40 internal constant ONE = 1e12;
    bytes internal constant RNG_DOMAIN = "SSOT_RNG_V1";

    bytes32 internal constant GAME_DICE = keccak256("DICE");
    /// The dice module with the smallest callback gas: its first settlement attempt runs out of gas.
    bytes32 internal constant GAME_DICE_LOWGAS = keccak256("DICE_LOWGAS");
    bytes32 internal constant GAME_DEFECT = keccak256("DEFECT");
    bytes32 internal constant GAME_BURN = keccak256("BURN");

    BlacklistToken internal token;
    GovernanceTimelock internal tl;
    PoolRegistry internal registry;
    SettlementRouter internal router;
    MockVRFV2PlusWrapper internal wrapper;
    VRFHub internal vrf;
    ReferralRegistry internal refReg;
    GameHub internal hub;
    Bank internal bank;
    LiquidityVault internal vault;
    DiceModule internal dice;
    uint48 internal lpId;

    function _deploy() internal {
        vm.warp(1_791_600_000);
        token = new BlacklistToken();
        vm.startPrank(DEPLOYER);
        tl = new GovernanceTimelock(DELAY, _list(SAFE), _list(GUARDIAN), _list(address(0)));
        registry = new PoolRegistry(address(tl));
        router = new SettlementRouter(address(registry));
        wrapper = new MockVRFV2PlusWrapper();
        vrf = new VRFHub(address(wrapper), address(router));
        refReg = new ReferralRegistry(address(tl));
        DefaultReferralEngine engine = new DefaultReferralEngine();
        hub = new GameHub(
            address(router), address(vrf), address(refReg), address(engine), address(tl), 3600, 200, 1000, 2000, 500, 3000
        );
        bank = new Bank(address(token), address(tl), 6000, 6, 10_000);
        vault = LiquidityVault(bank.vault());
        dice = new DiceModule();
        vm.stopPrank();
    }

    /// ADR-0037 §9 step 2. The release registers the eight certified games; the dice module and three test games
    /// stand in for them.
    function _wiringBatch() internal returns (address[] memory t, bytes[] memory d) {
        address defect = address(new RevertingModule());
        address burner = address(new GasBurnerModule());
        t = new address[](16);
        d = new bytes[](16);
        uint256 i;
        (t[i], d[i++]) = (address(refReg), abi.encodeCall(refReg.setBinderOnce, (address(hub))));
        (t[i], d[i++]) = (address(bank), abi.encodeCall(bank.setSettlementRouterOnce, (address(router))));
        (t[i], d[i++]) = (address(bank), abi.encodeCall(bank.setRandomnessConsumerOnce, (address(vrf))));
        (t[i], d[i++]) = (address(bank), abi.encodeCall(bank.setGuardian, (GUARDIAN)));
        (t[i], d[i++]) = (address(registry), abi.encodeCall(registry.setSentinel, (SAFE)));
        (t[i], d[i++]) = (address(hub), abi.encodeCall(hub.setSentinel, (SAFE)));
        (t[i], d[i++]) = (address(bank), abi.encodeCall(bank.setSentinel, (SAFE)));
        (t[i], d[i++]) = (address(bank), abi.encodeCall(bank.setWithdrawalBufferBps, (1000)));
        (t[i], d[i++]) = (
            address(registry),
            abi.encodeCall(registry.registerPool, (POOL, address(token), address(bank), SSOTTypes.PoolDomain.Casino))
        );
        (t[i], d[i++]) = (address(registry), abi.encodeCall(registry.setHubRegistered, (address(hub), true)));
        (t[i], d[i++]) = (address(registry), abi.encodeCall(registry.setHubAllowedForPool, (POOL, address(hub), true)));
        (t[i], d[i++]) = (address(hub), abi.encodeCall(hub.registerGame, (GAME_DICE, address(dice), 25, CALLBACK_GAS)));
        (t[i], d[i++]) = (address(hub), abi.encodeCall(hub.registerGame, (GAME_DICE_LOWGAS, address(dice), 25, 200_000)));
        (t[i], d[i++]) = (address(hub), abi.encodeCall(hub.registerGame, (GAME_DEFECT, defect, 25, CALLBACK_GAS)));
        (t[i], d[i++]) = (address(hub), abi.encodeCall(hub.registerGame, (GAME_BURN, burner, 25, CALLBACK_GAS)));
        (t[i], d[i++]) = (address(registry), abi.encodeCall(registry.setPoolActive, (POOL, false)));
        assert(i == t.length);
    }

    /// D1 deployment, the wiring batch, an LP deposit while inactive, then activation.
    function _launch() internal {
        _deploy();
        (address[] memory t, bytes[] memory d) = _wiringBatch();
        _schedule(t, d, "wiring");
        vm.warp(vm.getBlockTimestamp() + DELAY);
        _execute(t, d, "wiring");
        token.mint(LP, 10_000e6);
        vm.startPrank(LP);
        token.approve(address(vault), type(uint256).max);
        lpId = vault.addDeposit(10_000e6);
        vm.stopPrank();
        _govCall(address(registry), abi.encodeCall(registry.setPoolActive, (POOL, true)), "activate");
        _fund(ALICE);
        _fund(BOB);
        _fund(CAROL);
    }

    function _schedule(address[] memory t, bytes[] memory d, bytes32 salt) internal returns (bytes32 id) {
        vm.prank(SAFE);
        tl.scheduleBatch(t, new uint256[](t.length), d, bytes32(0), salt, DELAY);
        id = tl.hashOperationBatch(t, new uint256[](t.length), d, bytes32(0), salt);
    }

    function _execute(address[] memory t, bytes[] memory d, bytes32 salt) internal {
        vm.prank(KEEPER);
        tl.executeBatch(t, new uint256[](t.length), d, bytes32(0), salt);
    }

    function _govCall(address target, bytes memory data, bytes32 salt) internal {
        (address[] memory t, bytes[] memory d) = _one(target, data);
        _schedule(t, d, salt);
        vm.warp(vm.getBlockTimestamp() + tl.getMinDelay());
        _execute(t, d, salt);
    }

    function _one(address target, bytes memory data) internal pure returns (address[] memory t, bytes[] memory d) {
        t = _list(target);
        d = new bytes[](1);
        d[0] = data;
    }

    function _list(address a) internal pure returns (address[] memory list) {
        list = new address[](1);
        list[0] = a;
    }

    function _fund(address who) internal {
        token.mint(who, 1_000e6);
        vm.deal(who, 1 ether);
        vm.prank(who);
        token.approve(address(hub), type(uint256).max);
    }

    function _fee(bytes32 gameId) internal view returns (uint256 fee) {
        (fee,) = hub.quoteVRFFee(gameId, 1, tx.gasprice);
    }

    function _spec(uint256 amount) internal pure returns (SSOTTypes.StakeSpec memory) {
        return SSOTTypes.StakeSpec({amountPerRoll: amount, betCount: 1, stopGain: 0, stopLoss: 0});
    }

    function _bet(address player, bytes32 gameId, uint256 amount, address affiliate) internal returns (uint256 id) {
        uint256 fee = _fee(gameId);
        vm.prank(player);
        id = hub.placeBet{value: fee}(gameId, POOL, abi.encode(true, uint8(50)), _spec(amount), affiliate, 0);
    }

    function _fulfill(uint256 betId, uint256 seed) internal {
        uint256[] memory words = new uint256[](1);
        words[0] = seed;
        wrapper.fulfillTo(address(vrf), hub.getBet(betId).requestId, words);
    }

    /// Dice over 50: a seed whose roll wins (true) or loses (false).
    function _seed(uint256 betId, bool win) internal pure returns (uint256 seed) {
        for (seed = 1; seed < 4096; ++seed) {
            uint256 rolled = (uint256(keccak256(abi.encodePacked(RNG_DOMAIN, betId, uint256(0), seed))) % 100) + 1;
            if ((rolled > 50) == win) return seed;
        }
        revert("no seed");
    }

    function _unbooked() internal view returns (uint256) {
        return vrf.unbookedResultCount(address(bank));
    }
}
