import type { PublicClient, WalletClient } from "viem";
import { getAddress, getAbiItem, type AbiEvent, type Address, type Hex } from "viem";
import type { SSOTRelease } from "../release/schema";
import type { DomainBankSnapshot, DomainBet, DomainError, DomainXPBuckets } from "../domain";
import { decodeStakeSpec } from "../encoding/stakeSpec";
import { ERC20_ABI } from "../abis/erc20";
import { decodeVaultProviderEvent } from "@ssot/bet-index/vault-ledger";
import {
  decodeLPStatus,
  readDepositPosition,
  readDepositsPage,
  quoteNftWithdrawal,
  verifyVaultBinding,
  MAX_TREE_CAPITAL
} from "./liquidityVault";
import { extractPlayerPaymentProof, type PlayerPaymentProof } from "@ssot/bet-index/player-payment";
import { getContractAbis } from "../abis/index.mjs";
import { createTxPipeline, type JournalSink, type TxResult } from "./txPipeline";
import type {
  PlaceBetInput,
  PlaceBetPlan,
  ExecutePlanResult,
  VaultProviderLedgerEntry,
  ReconcilePlaceBetTxResult,
  BindPlaceBetTxResult,
  GameHubTerminalProof,
  SSOTGameHubAPI,
  SSOTBankAPI,
  SSOTLiquidityVaultAPI,
  SSOTVRFHubAPI,
  Address as AddressT
} from "./types";
import { toDomainError } from "./errors";
import { planExactApproval } from "./approval";

const GAME_HUB_TERMINAL_PROOF_LOOKBACK_BLOCKS = 250n;
const GAME_HUB_TERMINAL_PROOF_CHUNK_BLOCKS = 10n;
const ALLOWANCE_CONFIRMATION_ATTEMPTS = 6;
const ALLOWANCE_CONFIRMATION_DELAY_MS = 500;
// Base public RPC rejects eth_getLogs ranges above 2,000 blocks. Keep this
// below the cap to avoid inclusive range interpretation differences.
const PROVIDER_LEDGER_SCAN_CHUNK_BLOCKS = 1_900n;
const PROVIDER_LEDGER_DEFAULT_LIMIT = 50;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeRiskFreeLiquidity({
  riskAssets,
  totalReserved,
  riskReserveBps
}: {
  riskAssets: bigint;
  totalReserved: bigint;
  riskReserveBps: bigint;
}) {
  const riskReserve = (riskAssets * riskReserveBps) / 10000n;
  const free = riskAssets - totalReserved - riskReserve;
  return free > 0n ? free : 0n;
}

function canBankHoldBet({
  riskAssets,
  totalReserved,
  riskReserveBps,
  stake,
  requiredReserve
}: {
  riskAssets: bigint;
  totalReserved: bigint;
  riskReserveBps: bigint;
  stake: bigint;
  requiredReserve: bigint;
}) {
  const riskAssetsAfterStake = riskAssets + stake;
  if (riskAssetsAfterStake > MAX_TREE_CAPITAL || requiredReserve < stake) return false;
  const reservedAfterStake = totalReserved + requiredReserve;
  if (riskAssetsAfterStake < reservedAfterStake) return false;
  const riskReserveAfterStake = (riskAssetsAfterStake * riskReserveBps) / 10000n;
  return riskAssetsAfterStake - reservedAfterStake >= riskReserveAfterStake;
}

export interface CreateSSOTSDKParams {
  release: SSOTRelease;
  publicClient: PublicClient;
  walletClient?: WalletClient;
  account?: Address;
  journal?: JournalSink;
  /** Revoke pending writes when the embedding app changes wallet or release context. */
  assertWalletContext?: () => void;
}

export interface SSOTSDK {
  release: SSOTRelease;
  /** Connected wallet address (undefined when read-only). */
  account?: Address;
  gameHub: SSOTGameHubAPI;
  bank: SSOTBankAPI;
  vault: SSOTLiquidityVaultAPI;
  vrfHub: SSOTVRFHubAPI;
}

export function createSSOTSDK(params: CreateSSOTSDKParams): SSOTSDK {
  const { release, publicClient, walletClient, account } = params;
  const tx = createTxPipeline({ journal: params.journal, beforeWrite: params.assertWalletContext });

  function requireWallet():
    | { walletClient: WalletClient; account: Address }
    | { error: DomainError } {
    if (!walletClient || !account) {
      return {
        error: {
          code: "WALLET_NOT_CONNECTED",
          message: "Connect a wallet to perform this action.",
          severity: "warning"
        }
      };
    }
    return { walletClient, account };
  }

  function getPool(
    poolId: number,
    allowInactive = false
  ): NonNullable<SSOTRelease["pools"]>[number] | { error: DomainError } {
    const pool = release.pools.find((item) => item.poolId === poolId);
    if (!pool) {
      return {
        error: {
          code: "UNKNOWN_POOL",
          message: `No pool found for poolId ${poolId} in the current release configuration.`,
          severity: "error"
        }
      };
    }
    if (!pool.active && !allowInactive) {
      return {
        error: {
          code: "POOL_INACTIVE",
          message: `Pool ${poolId} is not active in the current release.`,
          severity: "warning"
        }
      };
    }
    return pool;
  }

  function normalizePool(pool: NonNullable<SSOTRelease["pools"]>[number]) {
    return {
      ...pool,
      asset: getAddress(pool.asset) as Address,
      bank: getAddress(pool.bank) as Address,
      vault: getAddress(pool.vault) as Address
    };
  }

  // Disabling new deposits/bets must not hide existing holdings or prevent debt claims.
  function resolveBankPool(poolId: number) {
    const pool = getPool(poolId, true);
    if ("error" in pool) throw new Error(pool.error.message);
    return normalizePool(pool);
  }

  const gameHubAddress = getAddress(release.contracts.gameHub) as Address;
  const vrfHubAddress = getAddress(release.contracts.vrfHub) as Address;

  // Every deployment uses the current source ABI.
  const {
    GameHubAbi: GAME_HUB_ABI,
    BankAbi: BANK_ABI,
    LiquidityVaultAbi: VAULT_ABI,
    SettlementRouterAbi: ROUTER_ABI,
    VRFHubAbi: VRFHUB_ABI,
    IGameModuleAbi: GAME_MODULE_ABI
  } = getContractAbis();
  // Nested Bank reverts must decode during the final hub simulation as well as planning.
  const bankErrors = BANK_ABI.filter((item) => item.type === "error");
  const CASINO_EXECUTION_ABI = [...GAME_HUB_ABI, ...bankErrors];
  const VAULT_DEPOSIT_EVENT = getAbiItem({ abi: VAULT_ABI, name: "DepositAdded" }) as AbiEvent;
  const VAULT_WITHDRAW_EVENT = getAbiItem({ abi: VAULT_ABI, name: "DepositWithdrawn" }) as AbiEvent;
  const VAULT_TRANSFER_EVENT = getAbiItem({ abi: VAULT_ABI, name: "Transfer" }) as AbiEvent;

  async function readTokenAllowance(token: Address, owner: Address, spender: Address) {
    return (await publicClient.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [owner, spender]
    })) as bigint;
  }

  async function waitForTokenAllowance(params: {
    token: Address;
    owner: Address;
    spender: Address;
    required: bigint;
  }) {
    let observed = 0n;
    for (let attempt = 0; attempt < ALLOWANCE_CONFIRMATION_ATTEMPTS; attempt += 1) {
      try {
        observed = await readTokenAllowance(params.token, params.owner, params.spender);
        if (observed >= params.required) return { ok: true as const, observed };
      } catch (error) {
        // Approval is already mined. Retry reads only; never resend the approval.
        if (toDomainError(error).code !== "RPC_ERROR") return { ok: false as const, observed };
      }
      if (attempt < ALLOWANCE_CONFIRMATION_ATTEMPTS - 1) {
        await sleep(ALLOWANCE_CONFIRMATION_DELAY_MS);
      }
    }
    return { ok: false as const, observed };
  }

  function createAllowanceNotConfirmedError(params: {
    action: string;
    required: bigint;
    observed: bigint;
    spender: Address;
  }): DomainError {
    return {
      code: "ALLOWANCE_NOT_CONFIRMED",
      message: `Token approval was mined, but the allowance is not visible to ${params.action} yet. Retry in a few seconds.`,
      severity: "warning",
      retryable: true,
      details: {
        required: params.required.toString(),
        observed: params.observed.toString(),
        spender: params.spender
      }
    };
  }

  function terminalProofRanges(latestBlock: bigint) {
    const releaseBlock = BigInt(release.meta?.blockNumber ?? 0);
    const lookbackStart =
      latestBlock > GAME_HUB_TERMINAL_PROOF_LOOKBACK_BLOCKS
        ? latestBlock - GAME_HUB_TERMINAL_PROOF_LOOKBACK_BLOCKS
        : 0n;
    const fromBlock = lookbackStart > releaseBlock ? lookbackStart : releaseBlock;
    const ranges: Array<{ fromBlock: bigint; toBlock: bigint }> = [];
    let cursor = latestBlock;

    while (cursor >= fromBlock) {
      const rangeFrom =
        cursor + 1n > GAME_HUB_TERMINAL_PROOF_CHUNK_BLOCKS
          ? cursor + 1n - GAME_HUB_TERMINAL_PROOF_CHUNK_BLOCKS
          : 0n;
      const boundedFrom = rangeFrom > fromBlock ? rangeFrom : fromBlock;
      ranges.push({ fromBlock: boundedFrom, toBlock: cursor });
      if (boundedFrom === fromBlock) break;
      cursor = boundedFrom - 1n;
    }

    return ranges;
  }

  async function readTerminalEventsInRange({
    betId,
    fromBlock,
    toBlock
  }: {
    betId: bigint;
    fromBlock: bigint;
    toBlock: bigint;
  }) {
    const eventBase = {
      address: gameHubAddress,
      abi: GAME_HUB_ABI,
      fromBlock,
      toBlock,
      args: { positionId: betId }
    };

    const [settled, refunded] = await Promise.all([
      publicClient.getContractEvents({
        ...eventBase,
        eventName: "BetFinalized"
      } as any),
      publicClient.getContractEvents({
        ...eventBase,
        eventName: "BetRefunded"
      } as any)
    ]);

    return [
      ...settled.map((event: any) => ({
        kind: "settled" as const,
        event
      })),
      ...refunded.map((event: any) => ({
        kind: "refunded" as const,
        event
      }))
    ].sort((a, b) => {
      const blockA = BigInt(a.event.blockNumber ?? 0n);
      const blockB = BigInt(b.event.blockNumber ?? 0n);
      if (blockA !== blockB) return blockA > blockB ? -1 : 1;
      return Number(b.event.logIndex ?? 0) - Number(a.event.logIndex ?? 0);
    });
  }

  async function readTerminalReceipt(betId: bigint): Promise<GameHubTerminalProof | null> {
    const receipt = (await publicClient.readContract({
      address: gameHubAddress,
      abi: GAME_HUB_ABI,
      functionName: "getBetTerminal",
      args: [betId]
    })) as any;

    const state = Number(receipt.state);
    if (state === 4) {
      return {
        kind: "settled",
        settlement: {
          payoutGross: BigInt(receipt.payoutGross),
          payoutNet: BigInt(receipt.payoutNet),
          refundAmount: BigInt(receipt.refundAmount),
          feeOnPayout: BigInt(receipt.feeOnPayout),
          protocolFeeAccrual: BigInt(receipt.protocolFeeAccrual)
        }
      };
    }

    if (state === 5) {
      return {
        kind: "refunded",
        refund: {
          refundAmount: BigInt(receipt.refundAmount)
        }
      };
    }

    return null;
  }

  async function withPlayerPayment(
    betId: bigint,
    proof: GameHubTerminalProof | null
  ): Promise<GameHubTerminalProof | null> {
    if (!proof) return null;
    const terminal = proof.kind === "settled" ? proof.settlement : proof.refund;
    const amount =
      proof.kind === "settled"
        ? proof.settlement.payoutNet != null && proof.settlement.refundAmount != null
          ? proof.settlement.payoutNet + proof.settlement.refundAmount
          : undefined
        : proof.refund.refundAmount;
    let payment: PlayerPaymentProof =
      amount == null ? { status: "unknown" } : { status: "unknown", amount: amount.toString() };
    if (terminal.txHash && amount != null) {
      try {
        const [receipt, bet] = await Promise.all([
          publicClient.getTransactionReceipt({ hash: terminal.txHash }),
          publicClient.readContract({
            address: gameHubAddress,
            abi: GAME_HUB_ABI,
            functionName: "getBet",
            args: [betId],
            blockNumber: terminal.blockNumber
          })
        ]);
        const identity = bet as { bank: Address; asset: Address; player: Address };
        if (
          receipt.status === "success" &&
          (terminal.blockNumber == null || receipt.blockNumber === terminal.blockNumber)
        ) {
          payment = extractPlayerPaymentProof({
            logs: receipt.logs,
            bank: getAddress(identity.bank),
            asset: getAddress(identity.asset),
            player: getAddress(identity.player),
            betId,
            amount
          });
        }
      } catch {
        // Economic terminal proof survives missing receipt or identity evidence. No inference from counters.
      }
    }
    return proof.kind === "settled"
      ? { ...proof, settlement: { ...proof.settlement, payment } }
      : { ...proof, refund: { ...proof.refund, payment } };
  }

  const gameHub: SSOTGameHubAPI = {
    async getGameConfig(gameId, opts) {
      const blockNumber =
        opts?.blockNumber ?? (await publicClient.getBlockNumber({ cacheTime: 0 }));
      const [module, maxBetCount, callbackGasLimit, houseEdgeBps] = await Promise.all([
        publicClient.readContract({
          address: gameHubAddress,
          abi: GAME_HUB_ABI,
          functionName: "gameModule",
          args: [gameId],
          blockNumber
        }),
        publicClient.readContract({
          address: gameHubAddress,
          abi: GAME_HUB_ABI,
          functionName: "gameMaxBetCount",
          args: [gameId],
          blockNumber
        }),
        publicClient.readContract({
          address: gameHubAddress,
          abi: GAME_HUB_ABI,
          functionName: "gameCallbackGasLimit",
          args: [gameId],
          blockNumber
        }),
        publicClient.readContract({
          address: gameHubAddress,
          abi: GAME_HUB_ABI,
          functionName: "defaultHouseEdgeBps",
          blockNumber
        })
      ]);
      const normalizedModule = getAddress(module as Address);
      const released = release.games[gameId.toLowerCase()];
      const metadata = release.gamesMeta.find(
        (game) => game.gameId.toLowerCase() === gameId.toLowerCase()
      );
      if (
        !released ||
        !metadata ||
        normalizedModule !== getAddress(released) ||
        normalizedModule !== getAddress(metadata.module) ||
        Number(maxBetCount) !== metadata.maxBetCount ||
        Number(callbackGasLimit) !== metadata.callbackGasLimit ||
        Number(maxBetCount) <= 0 ||
        Number(maxBetCount) > 25 ||
        !Number.isInteger(Number(houseEdgeBps)) ||
        Number(houseEdgeBps) <= 0 ||
        Number(houseEdgeBps) > 500 ||
        Number(callbackGasLimit) <= 0
      ) {
        throw new Error("Game admission is missing or differs from the authenticated release.");
      }
      return {
        gameId,
        module: normalizedModule,
        houseEdgeBps: Number(houseEdgeBps),
        maxBetCount: Number(maxBetCount),
        callbackGasLimit: Number(callbackGasLimit)
      };
    },
    async quoteVRFFee(gameId, betCount, gasPriceBudget): Promise<bigint> {
      const blockNumber = await publicClient.getBlockNumber({ cacheTime: 0 });
      const config = await gameHub.getGameConfig(gameId, { blockNumber });
      if (!Number.isInteger(betCount) || betCount <= 0 || betCount > config.maxBetCount)
        throw new RangeError("Bet count exceeds this game's admitted limit.");
      const [fee] = (await publicClient.readContract({
        address: gameHubAddress,
        abi: GAME_HUB_ABI,
        functionName: "quoteVRFFee",
        args: [gameId, betCount, gasPriceBudget ?? (await publicClient.getGasPrice())],
        blockNumber
      })) as [bigint, number];
      return fee;
    },

    async planPlaceBet(input: PlaceBetInput): Promise<PlaceBetPlan | { error: DomainError }> {
      try {
        // sanity: chainId
        if (input.chainId !== release.chainId) {
          return {
            error: {
              code: "CHAIN_MISMATCH",
              message: `Release chainId=${release.chainId} does not match request chainId=${input.chainId}.`,
              severity: "error"
            }
          };
        }

        if (!Number.isInteger(input.betCount) || input.betCount <= 0) {
          return {
            error: {
              code: "BAD_INPUT",
              message: "betCount must be a positive integer",
              severity: "error"
            }
          };
        }

        const stakeSpecDecoded = decodeStakeSpec(input.stakeSpec);
        const impliedStake = stakeSpecDecoded.amountPerRoll * BigInt(stakeSpecDecoded.betCount);
        if (stakeSpecDecoded.betCount !== input.betCount || impliedStake !== input.stake) {
          return {
            error: {
              code: "STAKE_SPEC_MISMATCH",
              message: "stake and betCount must match encoded stakeSpec.",
              severity: "error"
            }
          };
        }
        if (stakeSpecDecoded.amountPerRoll <= 0n) {
          return {
            error: { code: "BAD_INPUT", message: "amountPerRoll must be > 0", severity: "error" }
          };
        }

        const walletReq = requireWallet();
        if ("error" in walletReq) return walletReq;

        const pool = getPool(input.poolId);
        if ("error" in pool) return pool;

        const asset = getAddress(pool.asset) as Address;
        const bank = getAddress(pool.bank) as Address;

        const blockNumber = await publicClient.getBlockNumber({ cacheTime: 0 });
        const config = await gameHub.getGameConfig(input.gameId, { blockNumber });
        if (input.betCount > config.maxBetCount)
          return {
            error: {
              code: "BAD_INPUT",
              message: `This game permits at most ${config.maxBetCount} rounds.`,
              severity: "error"
            }
          };
        const paused = (await publicClient.readContract({
          address: gameHubAddress,
          abi: GAME_HUB_ABI,
          functionName: "riskInPaused",
          blockNumber,
          args: [BigInt(input.poolId)]
        })) as boolean;
        if (paused) {
          return {
            error: {
              code: "RISK_IN_PAUSED",
              message: "New bets are currently paused for this pool.",
              severity: "warning"
            }
          };
        }

        const gasPrice = await publicClient.getGasPrice();
        const [rawFee] = (await publicClient.readContract({
          address: gameHubAddress,
          abi: GAME_HUB_ABI,
          functionName: "quoteVRFFee",
          blockNumber,
          args: [input.gameId, input.betCount, gasPrice]
        })) as unknown as [bigint, number];

        // Add 50% buffer to VRF fee to account for L1 gas price fluctuation
        // between planning and execution. The contract refunds any overpayment.
        const fee = rawFee + rawFee / 2n;

        const allowance = (await publicClient.readContract({
          address: asset,
          abi: ERC20_ABI,
          functionName: "allowance",
          blockNumber,
          args: [walletReq.account, gameHubAddress]
        })) as bigint;

        const { needsApproval, approveAmount } = planExactApproval({
          allowance,
          required: input.stake
        });
        const steps: PlaceBetPlan["steps"] = [];
        const warnings: string[] = [];

        // ——— Solvency pre-flight ———
        // Lookup game module address from release bundle
        const moduleAddress = release.games[input.gameId];
        if (!moduleAddress) {
          return {
            error: {
              code: "UNKNOWN_GAME",
              message: `No game module found for gameId ${input.gameId} in the release bundle.`,
              severity: "error"
            }
          };
        }

        // Decode stakeSpec early for maxPayout call
        const stakeSpecForSolvency = stakeSpecDecoded;

        // Parallel reads: game module maxPayout + bank solvency state
        const [requiredReserve, accounting, openHolds, maxOpenHolds, minBetAmount] =
          await Promise.all([
            publicClient.readContract({
              address: getAddress(moduleAddress) as Address,
              abi: GAME_MODULE_ABI,
              functionName: "maxPayout",
              blockNumber,
              args: [
                input.params,
                {
                  amountPerRoll: stakeSpecForSolvency.amountPerRoll,
                  betCount: stakeSpecForSolvency.betCount,
                  stopGain: stakeSpecForSolvency.stopGain,
                  stopLoss: stakeSpecForSolvency.stopLoss
                }
              ]
            }) as Promise<bigint>,
            publicClient.readContract({
              address: bank,
              abi: BANK_ABI,
              blockNumber,
              functionName: "getSSOT"
            }) as Promise<any>,
            publicClient.readContract({
              address: bank,
              abi: BANK_ABI,
              blockNumber,
              functionName: "openHolds"
            }) as Promise<bigint>,
            publicClient.readContract({
              address: bank,
              abi: BANK_ABI,
              blockNumber,
              functionName: "MAX_OPEN_HOLDS"
            }) as Promise<bigint>,
            publicClient.readContract({
              address: bank,
              abi: BANK_ABI,
              blockNumber,
              functionName: "minBetAmount"
            }) as Promise<bigint>
          ]);
        const riskAssets = BigInt(accounting.G);
        const totalReserved = BigInt(accounting.R);
        const riskReserveBps = BigInt(accounting.riskReserveBps);
        if (!accounting.accountingValid || BigInt(accounting.L) <= 0n)
          return {
            error: {
              code: "INSUFFICIENT_LIQUIDITY",
              message: "Pool capital is unavailable for new bets.",
              severity: "warning"
            }
          };
        if (stakeSpecDecoded.amountPerRoll < minBetAmount) {
          return {
            error: {
              code: "STAKE_BELOW_MINIMUM",
              message: `Each round must stake at least ${minBetAmount} asset units.`,
              severity: "warning"
            }
          };
        }
        if (openHolds >= maxOpenHolds) {
          return {
            error: {
              code: "POOL_CAPACITY_FULL",
              message: "This pool is temporarily at capacity. Wait for a pending bet to finish.",
              severity: "warning",
              retryable: true
            }
          };
        }

        const freeLiquidity = computeRiskFreeLiquidity({
          riskAssets,
          totalReserved,
          riskReserveBps
        });

        if (
          !canBankHoldBet({
            riskAssets,
            totalReserved,
            riskReserveBps,
            stake: input.stake,
            requiredReserve
          })
        ) {
          const riskAssetsAfterStake = riskAssets + input.stake;
          const riskReserveAfterStake = (riskAssetsAfterStake * riskReserveBps) / 10000n;
          const availableAfterStake =
            riskAssetsAfterStake > totalReserved + riskReserveAfterStake
              ? riskAssetsAfterStake - totalReserved - riskReserveAfterStake
              : 0n;
          return {
            error: {
              code: "INSUFFICIENT_LIQUIDITY",
              message: `Bank liquidity insufficient. Required reserve: ${requiredReserve}, available after stake: ${availableAfterStake}. Reduce your stake or wait for more deposits.`,
              severity: "warning",
              details: {
                required: requiredReserve.toString(),
                available: availableAfterStake.toString()
              }
            }
          };
        }

        const riskAssetsAfterStake = riskAssets + input.stake;
        const riskReserveAfterStake = (riskAssetsAfterStake * riskReserveBps) / 10000n;
        const availableAfterStake =
          riskAssetsAfterStake > totalReserved + riskReserveAfterStake
            ? riskAssetsAfterStake - totalReserved - riskReserveAfterStake
            : 0n;

        // Warn if liquidity is tight (reserved > 90% of post-stake capacity).
        if (availableAfterStake > 0n && requiredReserve * 10n > availableAfterStake * 9n) {
          warnings.push(
            "Bank liquidity is tight — your bet may revert if another bet is placed first."
          );
        }

        if (needsApproval) {
          steps.push({
            type: "approve",
            token: asset as AddressT,
            spender: gameHubAddress as AddressT,
            amount: approveAmount!
          });
        }

        steps.push({
          type: "placeBet",
          to: gameHubAddress as AddressT,
          value: fee,
          call: {
            contract: "GameHub",
            fn: "placeBet",
            argsSummary: {
              gameId: input.gameId,
              poolId: input.poolId,
              betCount: input.betCount,
              stake: input.stake,
              affiliate: input.affiliate ?? "0x0000000000000000000000000000000000000000",
              maxHouseEdgeBps: input.maxHouseEdgeBps
            }
          }
        });

        if (release.isPlaceholder) {
          warnings.push("Release snapshot is marked as placeholder; writes are not recommended.");
        }

        return {
          chainId: input.chainId,
          releaseDigest: release.releaseDigest,
          warnings,
          steps,
          payload: {
            gameId: input.gameId,
            poolId: input.poolId,
            params: input.params,
            stakeSpec: stakeSpecDecoded,
            affiliate: (input.affiliate ??
              "0x0000000000000000000000000000000000000000") as AddressT,
            maxHouseEdgeBps: input.maxHouseEdgeBps
          },
          preview: {
            vrfFee: fee,
            gasPrice,
            quoteBlockNumber: blockNumber,
            stake: input.stake,
            allowance,
            needsApproval,
            approveAmount,
            asset: asset as AddressT,
            bank: bank as AddressT,
            freeLiquidity,
            requiredReserve
          }
        };
      } catch (e) {
        return { error: toDomainError(e) };
      }
    },

    async executePlan(
      plan: PlaceBetPlan,
      onStage?: (stage: "approve" | "placeBet") => void
    ): Promise<ExecutePlanResult> {
      const walletReq = requireWallet();
      if ("error" in walletReq) {
        return {
          placeBetTx: { txHash: "0x0" as Hex, ok: false, error: walletReq.error }
        };
      }

      // Steps are deterministic; execute in order.
      let approveTx: TxResult | undefined;
      for (const step of plan.steps) {
        if (step.type === "approve") {
          approveTx = await tx.simulateAndWrite({
            chainId: plan.chainId,
            releaseDigest: plan.releaseDigest,
            action: "APPROVE",
            publicClient,
            walletClient: walletReq.walletClient,
            account: walletReq.account,
            address: getAddress(step.token) as Address,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [getAddress(step.spender) as Address, step.amount],
            beforeWrite: () => onStage?.("approve")
          });
          if (!approveTx.ok) {
            return {
              approveTx,
              placeBetTx: { txHash: "0x0" as Hex, ok: false, error: approveTx.error }
            };
          }
          const allowanceReady = await waitForTokenAllowance({
            token: getAddress(step.token) as Address,
            owner: walletReq.account,
            spender: getAddress(step.spender) as Address,
            required: step.amount
          });
          if (!allowanceReady.ok) {
            return {
              approveTx,
              placeBetTx: {
                txHash: "0x0" as Hex,
                ok: false,
                error: {
                  ...createAllowanceNotConfirmedError({
                    action: "place the bet",
                    required: step.amount,
                    observed: allowanceReady.observed,
                    spender: getAddress(step.spender) as Address
                  }),
                  details: {
                    chainId: plan.chainId,
                    action: "PLACE_BET",
                    phase: "allowance",
                    transactionSubmitted: false,
                    approvalTxHash: approveTx.txHash
                  }
                }
              }
            };
          }
        }
      }

      // Place bet
      const placeStep = plan.steps.find((s) => s.type === "placeBet") as any;
      if (!placeStep) {
        return {
          approveTx,
          placeBetTx: {
            txHash: "0x0" as Hex,
            ok: false,
            error: {
              code: "NO_PLACE_BET_STEP",
              message: "No placeBet step in plan.",
              severity: "error"
            }
          }
        };
      }

      const payload = plan.payload;

      const args = [
        payload.gameId,
        BigInt(payload.poolId),
        payload.params,
        {
          amountPerRoll: payload.stakeSpec.amountPerRoll,
          betCount: payload.stakeSpec.betCount,
          stopGain: payload.stakeSpec.stopGain,
          stopLoss: payload.stakeSpec.stopLoss
        },
        (payload.affiliate ?? "0x0000000000000000000000000000000000000000") as Address,
        payload.maxHouseEdgeBps
      ] as const;

      // Re-simulate after approval with the confirmed gas price and native budget.
      // The real wrapper price is evaluated inside this simulation; a changed
      // fee, allowance, capacity or reserve cannot trigger an unreviewed write.
      const submitBet = () =>
        tx.simulateAndWrite({
          chainId: plan.chainId,
          releaseDigest: plan.releaseDigest,
          action: "PLACE_BET",
          publicClient,
          walletClient: walletReq.walletClient,
          account: walletReq.account,
          address: gameHubAddress,
          abi: CASINO_EXECUTION_ABI,
          functionName: "placeBet",
          args,
          value: placeStep.value,
          gasPrice: plan.preview.gasPrice,
          beforeWrite: () => onStage?.("placeBet")
        });

      let placeBetTx = await submitBet();
      // A load-balanced RPC can simulate against a node lagging the allowance read.
      // Retry only this read-only failure after a mined approval, never a wallet request.
      if (
        approveTx?.ok &&
        placeBetTx.error?.code === "INSUFFICIENT_ALLOWANCE" &&
        placeBetTx.error.details?.phase === "simulation"
      ) {
        await sleep(ALLOWANCE_CONFIRMATION_DELAY_MS);
        placeBetTx = await submitBet();
      }
      if (!placeBetTx.ok) {
        if (approveTx?.ok && placeBetTx.error?.details?.transactionSubmitted === false) {
          placeBetTx.error.details.approvalTxHash = approveTx.txHash;
          if (placeBetTx.error.code === "INSUFFICIENT_ALLOWANCE") {
            placeBetTx.error = {
              ...placeBetTx.error,
              code: "ALLOWANCE_NOT_CONFIRMED",
              message:
                "Approval is mined, but the simulation node has not observed the allowance yet.",
              severity: "warning",
              retryable: true
            };
          }
        }
        return { approveTx, placeBetTx };
      }

      // best-effort parse betId from receipt logs
      let betId: bigint | undefined;
      try {
        const receipt = await publicClient.getTransactionReceipt({ hash: placeBetTx.txHash });
        const ev = tx.extractEventArgs({
          abi: GAME_HUB_ABI,
          receiptLogs: receipt.logs as any,
          eventName: "BetPlaced",
          address: gameHubAddress
        });
        const first = ev[0];
        const rawBetId = first?.positionId;
        if (rawBetId != null) betId = BigInt(rawBetId as any);
      } catch {
        // ignore
      }

      return { approveTx, placeBetTx, betId };
    },

    async reconcilePlaceBetTx(txHash: Hex): Promise<ReconcilePlaceBetTxResult> {
      try {
        if (!txHash || txHash === ("0x0" as Hex)) {
          return {
            ok: false,
            error: {
              code: "BAD_TX_HASH",
              message: "Invalid txHash for reconciliation.",
              severity: "error"
            }
          };
        }
        const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
        if (receipt.status === "reverted")
          return {
            ok: false,
            error: {
              code: "TX_REVERTED",
              message: "Transaction reverted on chain.",
              severity: "error",
              details: { chainId: release.chainId, action: "PLACE_BET", txHash }
            }
          };
        const ev = tx.extractEventArgs({
          abi: GAME_HUB_ABI,
          receiptLogs: receipt.logs as any,
          eventName: "BetPlaced",
          address: gameHubAddress
        });
        const first = ev[0];
        const rawBetId = first?.positionId;
        if (rawBetId != null) {
          return { ok: true, betId: BigInt(rawBetId as any), source: "receipt" as const };
        }
        return {
          ok: false,
          error: {
            code: "BET_ID_NOT_FOUND",
            message: "BetPlaced not found in receipt logs (still unreconciled).",
            severity: "warning",
            retryable: true
          }
        };
      } catch (e) {
        return { ok: false, error: toDomainError(e) };
      }
    },

    async bindPlaceBetTx(txHash: Hex, betId: bigint): Promise<BindPlaceBetTxResult> {
      const walletReq = requireWallet();
      if ("error" in walletReq) {
        return { ok: false, error: walletReq.error };
      }
      try {
        // Ensure ownership: bet.player must match connected wallet
        const bet = await gameHub.getBet(betId);
        if ((bet.player as string).toLowerCase() !== walletReq.account.toLowerCase()) {
          return {
            ok: false,
            error: {
              code: "BET_NOT_OWNED",
              message: "This betId does not belong to the connected wallet.",
              severity: "error",
              retryable: false,
              details: { betPlayer: bet.player, wallet: walletReq.account, txHash }
            }
          };
        }
        return { ok: true, betId, source: "manual" as const };
      } catch (e) {
        return { ok: false, error: toDomainError(e) };
      }
    },

    async refund(betId: bigint): Promise<TxResult> {
      const walletReq = requireWallet();
      if ("error" in walletReq) return { txHash: "0x0" as Hex, ok: false, error: walletReq.error };
      return tx.simulateAndWrite({
        chainId: release.chainId,
        releaseDigest: release.releaseDigest,
        action: "REFUND",
        publicClient,
        walletClient: walletReq.walletClient,
        account: walletReq.account,
        address: gameHubAddress,
        abi: GAME_HUB_ABI,
        functionName: "refund",
        args: [betId]
      });
    },

    async finalize(betId: bigint): Promise<TxResult> {
      const walletReq = requireWallet();
      if ("error" in walletReq) return { txHash: "0x0" as Hex, ok: false, error: walletReq.error };
      return tx.simulateAndWrite({
        chainId: release.chainId,
        releaseDigest: release.releaseDigest,
        action: "FINALIZE",
        publicClient,
        walletClient: walletReq.walletClient,
        account: walletReq.account,
        address: gameHubAddress,
        abi: GAME_HUB_ABI,
        functionName: "finalize",
        args: [betId]
      });
    },

    async bindReferrer(referrer: AddressT): Promise<TxResult> {
      const walletReq = requireWallet();
      if ("error" in walletReq) return { txHash: "0x0" as Hex, ok: false, error: walletReq.error };
      return tx.simulateAndWrite({
        chainId: release.chainId,
        releaseDigest: release.releaseDigest,
        action: "BIND_REFERRER",
        publicClient,
        walletClient: walletReq.walletClient,
        account: walletReq.account,
        address: gameHubAddress,
        abi: GAME_HUB_ABI,
        functionName: "bindReferrer",
        args: [referrer]
      });
    },

    async referrerOf(player: AddressT): Promise<AddressT> {
      const referrer = (await publicClient.readContract({
        address: gameHubAddress,
        abi: GAME_HUB_ABI,
        functionName: "referrerOf",
        args: [player]
      })) as Address;
      return referrer as AddressT;
    },

    async getBet(betId: bigint): Promise<DomainBet> {
      const bet = (await publicClient.readContract({
        address: gameHubAddress,
        abi: GAME_HUB_ABI,
        functionName: "getBet",
        args: [betId]
      })) as any;

      const stateNum: number = Number(bet.state);
      const state = mapBetState(stateNum);
      return {
        betId: BigInt(bet.betId),
        chainId: release.chainId,
        gameId: bet.gameId as Hex,
        asset: bet.asset as AddressT,
        bank: bet.bank as AddressT,
        player: bet.player as AddressT,
        stake: BigInt(bet.stake),
        reserved: BigInt(bet.reserved),
        amountPerRoll: BigInt(bet.amountPerRoll),
        betCount: Number(bet.betCount),
        stopGain: BigInt(bet.stopGain),
        stopLoss: BigInt(bet.stopLoss),
        houseEdgeBps: Number(bet.houseEdgeBps),
        vrfFeePaid: BigInt(bet.vrfFeePaid),
        vrfFeeCharged: BigInt(bet.vrfFeeCharged),
        vrfCallbackGasLimit: Number(bet.vrfCallbackGasLimit),
        requestId: BigInt(bet.requestId),
        randomHash: bet.randomHash as Hex,
        state,
        placedAt: Number(bet.placedAt),
        refundDeadline: Number(bet.refundDeadline),
        vrfRequestedAt: numberOrUndefined(bet.vrfRequestedAt),
        resolvedAt: numberOrUndefined(bet.resolvedAt),
        settledAt: numberOrUndefined(bet.resolvedAt)
      };
    },

    async getBetParams(betId: bigint): Promise<Hex> {
      return (await publicClient.readContract({
        address: gameHubAddress,
        abi: GAME_HUB_ABI,
        functionName: "getBetParams",
        args: [betId]
      })) as Hex;
    },

    async getBetRandomWords(betId: bigint): Promise<bigint[]> {
      const words = (await publicClient.readContract({
        address: gameHubAddress,
        abi: GAME_HUB_ABI,
        functionName: "getBetRandomWords",
        args: [betId]
      })) as readonly bigint[];
      return [...words];
    },

    async getTerminalProof(betId: bigint): Promise<GameHubTerminalProof | null> {
      const terminal = await readTerminalReceipt(betId);
      if (!terminal) return null;
      // Terminal storage proves economics. Logs locate the transaction for delivery evidence.
      let latest: Awaited<ReturnType<typeof readTerminalEventsInRange>>[number] | undefined;
      try {
        const latestBlock = await publicClient.getBlockNumber();
        for (const range of terminalProofRanges(latestBlock)) {
          const events = await readTerminalEventsInRange({ betId, ...range });
          latest = events[0];
          if (latest) break;
        }
      } catch {
        return withPlayerPayment(betId, terminal);
      }
      if (!latest || latest.kind !== terminal.kind) return withPlayerPayment(betId, terminal);
      const location = {
        txHash: latest.event.transactionHash as Hex | undefined,
        blockNumber: latest.event.blockNumber as bigint | undefined
      };
      return withPlayerPayment(
        betId,
        terminal.kind === "settled"
          ? { kind: "settled", settlement: { ...terminal.settlement, ...location } }
          : { kind: "refunded", refund: { ...terminal.refund, ...location } }
      );
    }
  };

  async function bankExit(
    poolId: number,
    functionName: string,
    action: string,
    args: (self: Address) => readonly unknown[]
  ): Promise<TxResult> {
    const wallet = requireWallet();
    if ("error" in wallet) return { txHash: "0x0", ok: false, error: wallet.error };
    const poolReq = getPool(poolId, true);
    if ("error" in poolReq) return { txHash: "0x0", ok: false, error: poolReq.error };
    const pool = normalizePool(poolReq);
    try {
      return tx.simulateAndWrite({
        chainId: release.chainId,
        releaseDigest: release.releaseDigest,
        action,
        publicClient,
        walletClient: wallet.walletClient,
        account: wallet.account,
        address: pool.bank,
        abi: BANK_ABI,
        functionName,
        args: args(wallet.account)
      });
    } catch (error) {
      return { txHash: "0x0", ok: false, error: toDomainError(error) };
    }
  }

  const bank: SSOTBankAPI = {
    claimPlayerPayable(poolId, player) {
      return bankExit(poolId, "claimPlayerPayable", "CLAIM_PLAYER_PAYABLE", (self) => [
        player ?? self
      ]);
    },
    async getPlayerPayable(poolId, player, opts) {
      return (await publicClient.readContract({
        address: resolveBankPool(poolId).bank,
        abi: BANK_ABI,
        functionName: "playerPayable",
        args: [player],
        blockNumber: opts?.blockNumber
      })) as bigint;
    },
    async getAssetBalance(asset, user) {
      return (await publicClient.readContract({
        address: asset,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [user]
      })) as bigint;
    },
    async getSnapshot(poolId, opts): Promise<DomainBankSnapshot> {
      const pool = resolveBankPool(poolId);
      const blockNumber =
        opts?.blockNumber ?? (await publicClient.getBlockNumber({ cacheTime: 0 }));
      const block = await publicClient.getBlock({ blockNumber });
      await verifyVaultBinding(publicClient, pool, blockNumber);
      const read = (functionName: string) =>
        publicClient.readContract({ address: pool.bank, abi: BANK_ABI, functionName, blockNumber });
      const [ssot, performance, lp, openHolds, maxOpenHolds, minBetAmount, unbooked] =
        (await Promise.all([
          read("getSSOT"),
          read("getPerformance"),
          read("lpAccounting"),
          read("openHolds"),
          read("MAX_OPEN_HOLDS"),
          read("minBetAmount"),
          publicClient.readContract({
            address: getAddress(release.contracts.settlementRouter),
            abi: ROUTER_ABI,
            functionName: "unbookedResultCount",
            args: [pool.bank],
            blockNumber
          })
        ])) as [
          any,
          readonly bigint[],
          readonly [bigint, bigint, number],
          bigint,
          bigint,
          bigint,
          bigint
        ];
      return {
        chainId: release.chainId,
        poolId,
        asset: pool.asset,
        bank: pool.bank,
        vault: pool.vault,
        L: BigInt(ssot.L),
        P: BigInt(ssot.P),
        R: BigInt(ssot.R),
        K: BigInt(ssot.K),
        G: BigInt(ssot.G),
        bankCash: BigInt(ssot.bankCash),
        vaultCash: BigInt(ssot.vaultCash),
        bankSurplus: BigInt(ssot.bankSurplus),
        vaultSurplus: BigInt(ssot.vaultSurplus),
        accountingValid: ssot.accountingValid,
        lpStatus: ssot.accountingValid ? decodeLPStatus(lp[2]) : "invalidAccounting",
        unbookedResultCount: BigInt(unbooked),
        openHolds,
        maxOpenHolds,
        minBetAmount,
        lpFreeCapital: BigInt(ssot.lpFreeCapital),
        playerPayableTotal: BigInt(ssot.PP),
        updatedAtBlock: blockNumber,
        snapshotTimestamp: block.timestamp,
        riskInPaused: ssot.riskInPaused,
        riskReserveBps: Number(ssot.riskReserveBps),
        riskReserve: BigInt(ssot.riskReserve),
        riskFree: BigInt(ssot.riskFree),
        withdrawalBufferBps: Number(ssot.withdrawalBufferBps),
        withdrawalBuffer: BigInt(ssot.withdrawalBuffer),
        protocolFeesPayable: BigInt(ssot.PF),
        externalPayablesTotal: BigInt(ssot.XP),
        totalTurnover: BigInt(performance[0]!),
        totalPayoutGross: BigInt(performance[1]!),
        totalPayoutNet: BigInt(performance[2]!),
        totalRefunded: BigInt(performance[3]!),
        totalFeeOnPayout: BigInt(performance[4]!),
        totalProtocolFeeAccrued: BigInt(performance[5]!),
        totalBetsHeld: BigInt(performance[6]!),
        totalBetsSettled: BigInt(performance[7]!),
        totalBetsRefunded: BigInt(performance[8]!)
      };
    },

    async playerTurnover(poolId: number, player: AddressT): Promise<bigint> {
      const pool = resolveBankPool(poolId);
      return (await publicClient.readContract({
        address: pool.bank,
        abi: BANK_ABI,
        functionName: "playerTurnover",
        args: [player]
      })) as bigint;
    },

    async claimProtocolFees(
      poolId: number,
      amount: bigint,
      receiver: AddressT
    ): Promise<TxResult & { claimed?: bigint }> {
      const walletReq = requireWallet();
      if ("error" in walletReq) return { txHash: "0x0" as Hex, ok: false, error: walletReq.error };
      const poolReq = getPool(poolId);
      if ("error" in poolReq) return { txHash: "0x0" as Hex, ok: false, error: poolReq.error };
      const pool = normalizePool(poolReq);

      return tx.simulateAndWrite({
        chainId: release.chainId,
        releaseDigest: release.releaseDigest,
        action: "CLAIM_PROTOCOL_FEES",
        publicClient,
        walletClient: walletReq.walletClient,
        account: walletReq.account,
        address: pool.bank,
        abi: BANK_ABI,
        functionName: "claimProtocolFees",
        args: [amount, receiver]
      });
    },

    async claimXPAccrued(
      poolId: number,
      amount: bigint,
      receiver: AddressT
    ): Promise<TxResult & { claimed?: bigint }> {
      const walletReq = requireWallet();
      if ("error" in walletReq) return { txHash: "0x0" as Hex, ok: false, error: walletReq.error };
      const poolReq = getPool(poolId);
      if ("error" in poolReq) return { txHash: "0x0" as Hex, ok: false, error: poolReq.error };
      const pool = normalizePool(poolReq);

      return tx.simulateAndWrite({
        chainId: release.chainId,
        releaseDigest: release.releaseDigest,
        action: "CLAIM_XP_ACCRUED",
        publicClient,
        walletClient: walletReq.walletClient,
        account: walletReq.account,
        address: pool.bank,
        abi: BANK_ABI,
        functionName: "claimXPAccrued",
        args: [amount, receiver]
      });
    },

    async getXPBuckets(poolId: number, payee: AddressT): Promise<DomainXPBuckets> {
      const pool = resolveBankPool(poolId);
      const [accrued, locked, holdback, releasable] = await Promise.all([
        publicClient.readContract({
          address: pool.bank,
          abi: BANK_ABI,
          functionName: "xpAccruedOf",
          args: [payee]
        }) as Promise<bigint>,
        publicClient.readContract({
          address: pool.bank,
          abi: BANK_ABI,
          functionName: "xpLockedOf",
          args: [payee]
        }) as Promise<bigint>,
        publicClient.readContract({
          address: pool.bank,
          abi: BANK_ABI,
          functionName: "xpHoldbackOf",
          args: [payee]
        }) as Promise<bigint>,
        publicClient.readContract({
          address: pool.bank,
          abi: BANK_ABI,
          functionName: "holdbackReleasable",
          args: [payee]
        }) as Promise<bigint>
      ]);

      return { payee, accrued, locked, holdback, holdbackReleasable: releasable };
    },

    async unlockXPLocked(
      poolId: number,
      payee: AddressT,
      sourcePlayer: AddressT
    ): Promise<TxResult> {
      const walletReq = requireWallet();
      if ("error" in walletReq) return { txHash: "0x0" as Hex, ok: false, error: walletReq.error };
      const poolReq = getPool(poolId);
      if ("error" in poolReq) return { txHash: "0x0" as Hex, ok: false, error: poolReq.error };
      const pool = normalizePool(poolReq);

      return tx.simulateAndWrite({
        chainId: release.chainId,
        releaseDigest: release.releaseDigest,
        action: "UNLOCK_XP_LOCKED",
        publicClient,
        walletClient: walletReq.walletClient,
        account: walletReq.account,
        address: pool.bank,
        abi: BANK_ABI,
        functionName: "unlockXPLocked",
        args: [payee, sourcePlayer]
      });
    },

    async syncXPHoldback(poolId: number, payee: AddressT): Promise<TxResult> {
      const walletReq = requireWallet();
      if ("error" in walletReq) return { txHash: "0x0" as Hex, ok: false, error: walletReq.error };
      const poolReq = getPool(poolId);
      if ("error" in poolReq) return { txHash: "0x0" as Hex, ok: false, error: poolReq.error };
      const pool = normalizePool(poolReq);

      return tx.simulateAndWrite({
        chainId: release.chainId,
        releaseDigest: release.releaseDigest,
        action: "SYNC_XP_HOLDBACK",
        publicClient,
        walletClient: walletReq.walletClient,
        account: walletReq.account,
        address: pool.bank,
        abi: BANK_ABI,
        functionName: "syncXPHoldback",
        args: [payee]
      });
    }
  };

  const vault: SSOTLiquidityVaultAPI = {
    async getDeposit(poolId, depositId, opts) {
      const pool = resolveBankPool(poolId);
      const blockNumber =
        opts?.blockNumber ?? (await publicClient.getBlockNumber({ cacheTime: 0 }));
      const block = await publicClient.getBlock({ blockNumber });
      await verifyVaultBinding(publicClient, pool, blockNumber);
      return readDepositPosition(publicClient, pool, depositId, blockNumber, block.timestamp);
    },
    getDeposits(poolId, owner, opts) {
      return readDepositsPage(publicClient, resolveBankPool(poolId), owner, release.chainId, opts);
    },
    async quoteWithdrawal(poolId, depositId, percent, opts) {
      return quoteNftWithdrawal(await vault.getDeposit(poolId, depositId, opts), percent);
    },
    async getAllowance(poolId, owner) {
      const pool = resolveBankPool(poolId);
      return readTokenAllowance(pool.asset, owner, pool.vault);
    },
    async addDeposit(poolId, assets, owner) {
      const wallet = requireWallet();
      if ("error" in wallet) return { txHash: "0x0", ok: false, error: wallet.error };
      const poolReq = getPool(poolId);
      if ("error" in poolReq) return { txHash: "0x0", ok: false, error: poolReq.error };
      try {
        if (assets <= 0n) throw new Error("Deposit assets must be positive.");
        const pool = normalizePool(poolReq);
        const recipient = getAddress(owner ?? wallet.account);
        if (
          ["0x0000000000000000000000000000000000000000", pool.bank, pool.vault].includes(recipient)
        )
          throw new Error("Invalid deposit owner.");
        const snapshot = await bank.getSnapshot(poolId);
        if (snapshot.lpStatus !== "ready" || !snapshot.accountingValid)
          throw new Error(`LP deposits unavailable: ${snapshot.lpStatus}.`);
        if (snapshot.G + assets > MAX_TREE_CAPITAL)
          throw new Error("Deposit exceeds the admitted capital bound.");
        const allowance = await readTokenAllowance(pool.asset, wallet.account, pool.vault);
        const { needsApproval, approveAmount } = planExactApproval({ allowance, required: assets });
        if (needsApproval) {
          const approved = await tx.simulateAndWrite({
            chainId: release.chainId,
            releaseDigest: release.releaseDigest,
            action: "APPROVE_DEPOSIT",
            publicClient,
            walletClient: wallet.walletClient,
            account: wallet.account,
            address: pool.asset,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [pool.vault, approveAmount!]
          });
          if (!approved.ok) return approved;
          const ready = await waitForTokenAllowance({
            token: pool.asset,
            owner: wallet.account,
            spender: pool.vault,
            required: assets
          });
          if (!ready.ok)
            return {
              txHash: approved.txHash,
              ok: false,
              error: createAllowanceNotConfirmedError({
                action: "the LiquidityVault",
                required: assets,
                observed: ready.observed,
                spender: pool.vault
              })
            };
        }
        return tx.simulateAndWrite({
          chainId: release.chainId,
          releaseDigest: release.releaseDigest,
          action: "DEPOSIT",
          publicClient,
          walletClient: wallet.walletClient,
          account: wallet.account,
          address: pool.vault,
          abi: VAULT_ABI,
          functionName: "addDepositFor",
          args: [recipient, assets]
        });
      } catch (error) {
        return { txHash: "0x0", ok: false, error: toDomainError(error) };
      }
    },
    async withdrawDeposit(poolId, depositId, percent) {
      const wallet = requireWallet();
      if ("error" in wallet) return { txHash: "0x0", ok: false, error: wallet.error };
      try {
        const quote = await vault.quoteWithdrawal(poolId, depositId, percent);
        if (getAddress(wallet.account) !== quote.position.owner)
          throw new Error("Only the current NFT owner may withdraw.");
        if (!quote.executable)
          return {
            txHash: "0x0",
            ok: false,
            error: {
              code: "NFT_WITHDRAWAL_UNAVAILABLE",
              message: `NFT withdrawal unavailable: ${quote.reason}.`,
              severity: "warning",
              details: { reason: quote.reason }
            }
          };
        return tx.simulateAndWrite({
          chainId: release.chainId,
          releaseDigest: release.releaseDigest,
          action: "WITHDRAW",
          publicClient,
          walletClient: wallet.walletClient,
          account: wallet.account,
          address: quote.position.vault,
          abi: VAULT_ABI,
          functionName: "withdrawDeposit",
          args: [depositId, percent]
        });
      } catch (error) {
        return { txHash: "0x0", ok: false, error: toDomainError(error) };
      }
    },
    async getProviderLedger(poolId, owner, opts): Promise<VaultProviderLedgerEntry[]> {
      const pool = resolveBankPool(poolId);
      const identity = owner.toLowerCase();
      const latest =
        opts?.endBlock != null
          ? BigInt(opts.endBlock)
          : await publicClient.getBlockNumber({ cacheTime: 0 });
      const fromBlock =
        opts?.startBlock != null
          ? BigInt(opts.startBlock)
          : latest > 100_000n
            ? latest - 100_000n
            : 0n;
      const limit = opts?.limit ?? PROVIDER_LEDGER_DEFAULT_LIMIT;
      if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 200 ||
        fromBlock < 0n ||
        latest < fromBlock
      )
        throw new RangeError("Invalid Vault history range or limit.");
      await verifyVaultBinding(publicClient, pool, latest);
      const entries: VaultProviderLedgerEntry[] = [];
      let end =
        opts?.beforeBlock != null && BigInt(opts.beforeBlock) < latest
          ? BigInt(opts.beforeBlock)
          : latest;
      while (end >= fromBlock && entries.length < limit) {
        const start =
          end - fromBlock > PROVIDER_LEDGER_SCAN_CHUNK_BLOCKS
            ? end - PROVIDER_LEDGER_SCAN_CHUNK_BLOCKS
            : fromBlock;
        const logs = await publicClient.getLogs({
          address: pool.vault,
          events: [VAULT_DEPOSIT_EVENT, VAULT_WITHDRAW_EVENT, VAULT_TRANSFER_EVENT],
          fromBlock: start,
          toBlock: end
        });
        for (const log of logs) {
          if (
            !log.transactionHash ||
            log.blockNumber == null ||
            log.logIndex == null ||
            log.removed
          )
            continue;
          if (
            opts?.beforeBlock != null &&
            (log.blockNumber > BigInt(opts.beforeBlock) ||
              (log.blockNumber === BigInt(opts.beforeBlock) &&
                log.logIndex >= (opts.beforeLogIndex ?? 0)))
          )
            continue;
          const row = decodeVaultProviderEvent(
            pool.vault,
            log.eventName!,
            log.args as Record<string, unknown>
          );
          if (
            !row ||
            (row.owner !== identity &&
              !(row.action === "transfer" && row.receiver === identity) &&
              !(row.action === "deposit" && row.caller === identity))
          )
            continue;
          entries.push({
            id: `${release.chainId}:${log.transactionHash}:${log.logIndex}`,
            action: row.action,
            depositId: row.depositId,
            txHash: log.transactionHash,
            blockNumber: Number(log.blockNumber),
            logIndex: log.logIndex,
            ...(row.action === "transfer"
              ? { from: row.owner, to: row.receiver }
              : {
                  owner: row.owner,
                  assets: row.assets,
                  percent: row.percent,
                  withdrawAfter: row.withdrawAfter,
                  ...(row.action === "deposit" ? { payer: row.caller } : {})
                })
          });
        }
        if (start === fromBlock) break;
        end = start - 1n;
      }
      return Promise.all(
        entries
          .sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex)
          .slice(0, limit)
          .map(async (entry) => ({
            ...entry,
            timestamp:
              Number(
                (await publicClient.getBlock({ blockNumber: BigInt(entry.blockNumber) })).timestamp
              ) * 1000
          }))
      );
    }
  };

  const vrfHub: SSOTVRFHubAPI = {
    async getRefundCredit(user: AddressT): Promise<bigint> {
      const amount = (await publicClient.readContract({
        address: vrfHubAddress,
        abi: VRFHUB_ABI,
        functionName: "refundCreditOf",
        args: [user]
      })) as bigint;
      return amount;
    },

    async claimRefundCredit(): Promise<TxResult> {
      const walletReq = requireWallet();
      if ("error" in walletReq) return { txHash: "0x0" as Hex, ok: false, error: walletReq.error };
      return tx.simulateAndWrite({
        chainId: release.chainId,
        releaseDigest: release.releaseDigest,
        action: "CLAIM_VRF_REFUND",
        publicClient,
        walletClient: walletReq.walletClient,
        account: walletReq.account,
        address: vrfHubAddress,
        abi: VRFHUB_ABI,
        functionName: "claimRefund",
        args: []
      });
    }
  };

  return { release, account, gameHub, bank, vault, vrfHub };
}

function mapBetState(state: number): DomainBet["state"] {
  // SSOTTypes.BetState: None(0), Held(1), PendingVRF(2), RandomReady(3), Settled(4), Refunded(5)
  if (state === 3) return "randomReady";
  if (state === 4) return "finalized";
  if (state === 5) return "refunded";
  return "placed";
}

function numberOrUndefined(value: unknown): number | undefined {
  const numeric = Number(value ?? 0);
  return numeric > 0 ? numeric : undefined;
}
