// Generated from current Foundry artifacts by script/release/export_frontend_abis.py.
import GameHub from "./contracts/GameHub.abi.json" with { type: "json" };
export const GameHubAbi = GameHub.abi;
import VRFHub from "./contracts/VRFHub.abi.json" with { type: "json" };
export const VRFHubAbi = VRFHub.abi;
import PoolRegistry from "./contracts/PoolRegistry.abi.json" with { type: "json" };
export const PoolRegistryAbi = PoolRegistry.abi;
import SettlementRouter from "./contracts/SettlementRouter.abi.json" with { type: "json" };
export const SettlementRouterAbi = SettlementRouter.abi;
import ReferralRegistry from "./contracts/ReferralRegistry.abi.json" with { type: "json" };
export const ReferralRegistryAbi = ReferralRegistry.abi;
import DefaultReferralEngine from "./contracts/DefaultReferralEngine.abi.json" with { type: "json" };
export const DefaultReferralEngineAbi = DefaultReferralEngine.abi;
import DiceModule from "./contracts/DiceModule.abi.json" with { type: "json" };
export const DiceModuleAbi = DiceModule.abi;
import CoinTossModule from "./contracts/CoinTossModule.abi.json" with { type: "json" };
export const CoinTossModuleAbi = CoinTossModule.abi;
import RouletteModule from "./contracts/RouletteModule.abi.json" with { type: "json" };
export const RouletteModuleAbi = RouletteModule.abi;
import KenoModule from "./contracts/KenoModule.abi.json" with { type: "json" };
export const KenoModuleAbi = KenoModule.abi;
import PlinkoModule from "./contracts/PlinkoModule.abi.json" with { type: "json" };
export const PlinkoModuleAbi = PlinkoModule.abi;
import SicBoModule from "./contracts/SicBoModule.abi.json" with { type: "json" };
export const SicBoModuleAbi = SicBoModule.abi;
import SlotsModule from "./contracts/SlotsModule.abi.json" with { type: "json" };
export const SlotsModuleAbi = SlotsModule.abi;
import BaccaratModule from "./contracts/BaccaratModule.abi.json" with { type: "json" };
export const BaccaratModuleAbi = BaccaratModule.abi;
import Bank from "./contracts/Bank.abi.json" with { type: "json" };
export const BankAbi = Bank.abi;
import LiquidityVault from "./contracts/LiquidityVault.abi.json" with { type: "json" };
export const LiquidityVaultAbi = LiquidityVault.abi;
import IGameModule from "./contracts/IGameModule.abi.json" with { type: "json" };
export const IGameModuleAbi = IGameModule.abi;
import GovernanceTimelock from "./contracts/GovernanceTimelock.abi.json" with { type: "json" };
export const GovernanceTimelockAbi = GovernanceTimelock.abi;
const abis = Object.freeze({
  GameHubAbi,
  VRFHubAbi,
  PoolRegistryAbi,
  SettlementRouterAbi,
  ReferralRegistryAbi,
  DefaultReferralEngineAbi,
  DiceModuleAbi,
  CoinTossModuleAbi,
  RouletteModuleAbi,
  KenoModuleAbi,
  PlinkoModuleAbi,
  SicBoModuleAbi,
  SlotsModuleAbi,
  BaccaratModuleAbi,
  BankAbi,
  LiquidityVaultAbi,
  IGameModuleAbi,
  GovernanceTimelockAbi
});
export function getContractAbis() {
  return abis;
}
