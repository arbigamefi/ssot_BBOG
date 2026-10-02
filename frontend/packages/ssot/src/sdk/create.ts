import type { PublicClient, WalletClient } from "viem";
import { getAddress, getAbiItem, type AbiEvent, type Address, type Hex } from "viem";
import type { SSOTRelease } from "../release/schema";
import type {
  DomainBankPosition,
  DomainBankSnapshot,
  DomainBet,
  DomainError,
  DomainSportsMarket,
  DomainSportsResult,
  DomainSportsTicket,
  DomainXPBuckets
} from "../domain";
import { decodeStakeSpec } from "../encoding/stakeSpec";
import { ERC20_ABI } from "../abis/erc20";
import { readRecoveryPosition, readRecoveryPage } from "./bankRecovery";
import { readAsyncBankState, readAsyncBankPosition } from "./bankRedemption";
import { decodeBankProviderCashEvent } from "@ssot/bet-index/bank-cash-ledger";
import { extractPlayerPaymentProof, type PlayerPaymentProof } from "@ssot/bet-index/player-payment";
import { getContractAbis } from "../abis/index.mjs";
import { createTxPipeline, type JournalSink, type TxResult } from "./txPipeline";
import type {
  PlaceBetInput,
  PlaceBetPlan,
  CreateSportsMarketInput,
  ExecutePlanResult,
  ExecuteSportsTicketPlanResult,
  BankProviderLedgerEntry,
  ReconcilePlaceBetTxResult,
  BindPlaceBetTxResult,
  PlaceSportsTicketInput,
  PlaceSportsTicketPlan,
  ProposeSportsResultInput,
  ResolveSportsChallengeDecision,
  ResolveSportsChallengeInput,
  GameHubTerminalProof,
  SSOTGameHubAPI,
  SSOTBankAPI,
  SSOTVRFHubAPI,
  SSOTSportsHubAPI,
  SportsOddsSnapshotInput,
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
  totalAssets,
  activeReserved,
  riskReserveBps
}: {
  totalAssets: bigint;
  activeReserved: bigint;
  riskReserveBps: bigint;
}) {
  const riskReserve = (totalAssets * riskReserveBps) / 10000n;
  const free = totalAssets - activeReserved - riskReserve;
  return free > 0n ? free : 0n;
}

function canBankHoldBet({
  totalAssets,
  activeReserved,
  riskReserveBps,
  stake,
  requiredReserve
}: {
  totalAssets: bigint;
  activeReserved: bigint;
  riskReserveBps: bigint;
  stake: bigint;
  requiredReserve: bigint;
}) {
  const navAfterStake = totalAssets + stake;
  const reservedAfterStake = activeReserved + requiredReserve;
  if (navAfterStake < reservedAfterStake) return false;
  const riskReserveAfterStake = (navAfterStake * riskReserveBps) / 10000n;
  return navAfterStake - reservedAfterStake >= riskReserveAfterStake;
}

function assetPerShare(assets: bigint | undefined, shares: bigint, decimals: number) {
  if (assets == null || shares <= 0n) return undefined;
  const shareUnit = 10n ** BigInt(decimals);
  return (assets * shareUnit) / shares;
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
  vrfHub: SSOTVRFHubAPI;
  sportsHub: SSOTSportsHubAPI;
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
      bank: getAddress(pool.bank) as Address
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
  const sportsHubAddress = getAddress(release.contracts.sportsHub) as Address;

  // Every deployment uses the current source ABI.
  const {
    GameHubAbi: GAME_HUB_ABI,
    BankAbi: BANK_ABI,
    VRFHubAbi: VRFHUB_ABI,
    SportsHubAbi: SPORTS_HUB_ABI,
    IGameModuleAbi: GAME_MODULE_ABI
  } = getContractAbis();
  // Nested Bank reverts must decode during the final hub simulation as well as planning.
  const bankErrors = BANK_ABI.filter((item) => item.type === "error");
  const CASINO_EXECUTION_ABI = [...GAME_HUB_ABI, ...bankErrors];
  const SPORTS_EXECUTION_ABI = [...SPORTS_HUB_ABI, ...bankErrors];
  const BANK_DEPOSIT_EVENT = getAbiItem({ abi: BANK_ABI, name: "Deposit" }) as AbiEvent;
  const BANK_WITHDRAW_EVENT = getAbiItem({ abi: BANK_ABI, name: "Withdraw" }) as AbiEvent;
  const BANK_RECOVERY_EVENT = getAbiItem({ abi: BANK_ABI, name: "RecoveryClaimed" }) as AbiEvent;

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
    async quoteVRFFee(betCount: number): Promise<bigint> {
      const [fee] = (await publicClient.readContract({
        address: gameHubAddress,
        abi: GAME_HUB_ABI,
        functionName: "quoteVRFFee",
        args: [betCount, await publicClient.getGasPrice()]
      })) as unknown as [bigint, number];
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

        if (input.betCount <= 0 || input.betCount > 100) {
          return {
            error: {
              code: "BAD_INPUT",
              message: "betCount must be between 1 and 100",
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
          args: [input.betCount, gasPrice]
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
        const [
          requiredReserve,
          totalAssets,
          activeReserved,
          riskReserveBps,
          activeOpenHolds,
          maxActiveHolds,
          minStake
        ] = await Promise.all([
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
            address: bank as Address,
            abi: BANK_ABI,
            blockNumber,
            functionName: "totalAssets"
          }) as Promise<bigint>,
          publicClient.readContract({
            address: bank as Address,
            abi: BANK_ABI,
            blockNumber,
            functionName: "activeReserved"
          }) as Promise<bigint>,
          publicClient.readContract({
            address: bank as Address,
            abi: BANK_ABI,
            blockNumber,
            functionName: "riskReserveBps"
          }) as Promise<bigint>,
          publicClient.readContract({
            address: bank,
            abi: BANK_ABI,
            blockNumber,
            functionName: "activeOpenHolds"
          }) as Promise<bigint>,
          publicClient.readContract({
            address: bank,
            abi: BANK_ABI,
            blockNumber,
            functionName: "MAX_ACTIVE_HOLDS"
          }) as Promise<bigint>,
          publicClient.readContract({
            address: bank,
            abi: BANK_ABI,
            blockNumber,
            functionName: "minStake"
          }) as Promise<bigint>
        ]);
        if (input.stake < minStake) {
          return {
            error: {
              code: "STAKE_BELOW_MINIMUM",
              message: `Total stake must be at least ${minStake} asset units.`,
              severity: "warning"
            }
          };
        }
        if (activeOpenHolds >= maxActiveHolds) {
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
          totalAssets,
          activeReserved,
          riskReserveBps
        });

        if (
          !canBankHoldBet({
            totalAssets,
            activeReserved,
            riskReserveBps,
            stake: input.stake,
            requiredReserve
          })
        ) {
          const navAfterStake = totalAssets + input.stake;
          const riskReserveAfterStake = (navAfterStake * riskReserveBps) / 10000n;
          const availableAfterStake =
            navAfterStake > activeReserved + riskReserveAfterStake
              ? navAfterStake - activeReserved - riskReserveAfterStake
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

        const navAfterStake = totalAssets + input.stake;
        const riskReserveAfterStake = (navAfterStake * riskReserveBps) / 10000n;
        const availableAfterStake =
          navAfterStake > activeReserved + riskReserveAfterStake
            ? navAfterStake - activeReserved - riskReserveAfterStake
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
        effectiveHouseEdgeBps: Number(bet.effectiveHouseEdgeBps),
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
    requestRedeem(poolId, shares, controller, owner) {
      return bankExit(poolId, "requestRedeem", "REQUEST_REDEEM", (self) => [
        shares,
        controller ?? self,
        owner ?? self
      ]);
    },
    cancelRedeemRequest(poolId, controller) {
      return bankExit(poolId, "cancelRedeemRequest", "CANCEL_REDEEM", (self) => [
        controller ?? self
      ]);
    },
    syncRedeem(poolId, controller) {
      return bankExit(poolId, "syncRedeem", "SYNC_REDEEM", (self) => [controller ?? self]);
    },
    claimPlayerPayable(poolId, player) {
      return bankExit(poolId, "claimPlayerPayable", "CLAIM_PLAYER_PAYABLE", (self) => [
        player ?? self
      ]);
    },
    syncRecovery(poolId, epochId, controller) {
      return bankExit(poolId, "syncRecovery", "SYNC_RECOVERY", (self) => [
        epochId,
        controller ?? self
      ]);
    },
    claimRecovery(poolId, epochId, receiver, controller) {
      return bankExit(poolId, "claimRecovery", "CLAIM_RECOVERY", (self) => [
        epochId,
        receiver ?? self,
        controller ?? self
      ]);
    },
    async getRecovery(poolId, epochId, controller, opts) {
      const pool = resolveBankPool(poolId);
      const blockNumber = opts?.blockNumber ?? (await publicClient.getBlockNumber());
      const block = await publicClient.getBlock({ blockNumber });
      return readRecoveryPosition(
        publicClient,
        pool.bank,
        epochId,
        controller,
        blockNumber,
        block.timestamp
      );
    },
    async getRecoveryPage(poolId, controller, opts) {
      const pool = resolveBankPool(poolId);
      return readRecoveryPage(publicClient, pool.bank, controller, release.chainId, opts);
    },
    async getSnapshot(poolId: number, opts): Promise<DomainBankSnapshot> {
      const pool = resolveBankPool(poolId);
      const blockNumber =
        opts?.blockNumber ?? (await publicClient.getBlockNumber({ cacheTime: 0 }));
      const block = await publicClient.getBlock({ blockNumber });
      const shareUnit = 10n ** BigInt(pool.decimals);
      const [ssot, totalSupply, assetsPerShare, performance] = (await Promise.all([
        publicClient.readContract({
          address: pool.bank,
          abi: BANK_ABI,
          functionName: "getSSOT",
          args: [],
          blockNumber
        }),
        publicClient.readContract({
          address: pool.bank,
          abi: BANK_ABI,
          functionName: "totalSupply",
          args: [],
          blockNumber
        }),
        publicClient.readContract({
          address: pool.bank,
          abi: BANK_ABI,
          functionName: "convertToAssets",
          args: [shareUnit],
          blockNumber
        }),
        publicClient.readContract({
          address: pool.bank,
          abi: BANK_ABI,
          functionName: "getPerformance",
          args: [],
          blockNumber
        })
      ])) as [
        any,
        bigint,
        bigint,
        readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint]
      ];

      const asyncState = await readAsyncBankState(publicClient, pool.bank, blockNumber);

      return {
        chainId: release.chainId,
        poolId,
        asset: pool.asset as AddressT,
        bank: pool.bank as AddressT,
        totalAssets: BigInt(ssot.NAV),
        totalSupply,
        assetsPerShare,
        activeReserved: BigInt(ssot.R),
        ...asyncState,
        updatedAtBlock: blockNumber,
        snapshotTimestamp: block.timestamp,
        riskInPaused: ssot.riskInPaused,
        riskReserveBps: Number(ssot.riskReserveBps),
        riskReserve: BigInt(ssot.riskReserve),
        riskFree: BigInt(ssot.riskFree),
        withdrawalBufferBps: Number(ssot.withdrawalBufferBps),
        withdrawalBuffer: BigInt(ssot.withdrawalBuffer),
        withdrawable: BigInt(ssot.withdrawable),
        protocolFeesPayable: BigInt(ssot.PF),
        externalPayablesTotal: BigInt(ssot.XP),
        totalTurnover: BigInt(performance[0]),
        totalPayoutGross: BigInt(performance[1]),
        totalPayoutNet: BigInt(performance[2]),
        totalRefunded: BigInt(performance[3]),
        totalFeeOnPayout: BigInt(performance[4]),
        totalProtocolFeeAccrued: BigInt(performance[5]),
        totalBetsHeld: BigInt(performance[6]),
        totalBetsSettled: BigInt(performance[7]),
        totalBetsRefunded: BigInt(performance[8])
      };
    },

    async getPosition(poolId: number, user: AddressT, opts): Promise<DomainBankPosition> {
      const pool = resolveBankPool(poolId);
      const blockNumber =
        opts?.blockNumber ?? (await publicClient.getBlockNumber({ cacheTime: 0 }));
      const [block, shares] = await Promise.all([
        publicClient.getBlock({ blockNumber }),
        publicClient.readContract({
          address: pool.bank,
          abi: BANK_ABI,
          functionName: "balanceOf",
          args: [user],
          blockNumber
        })
      ]);
      const assetsEquivalent = (await publicClient.readContract({
        address: pool.bank,
        abi: BANK_ABI,
        functionName: "convertToAssets",
        args: [shares],
        blockNumber
      })) as bigint;
      const state = await readAsyncBankPosition(
        publicClient,
        pool.bank,
        user,
        blockNumber,
        shares as bigint,
        assetsEquivalent
      );
      return {
        poolId,
        user,
        shares: shares as bigint,
        updatedAtBlock: blockNumber,
        snapshotTimestamp: block.timestamp,
        ...state
      };
    },

    async convertToShares(poolId: number, assets: bigint): Promise<bigint> {
      const pool = resolveBankPool(poolId);
      return (await publicClient.readContract({
        address: pool.bank,
        abi: BANK_ABI,
        functionName: "convertToShares",
        args: [assets]
      })) as bigint;
    },

    async convertToAssets(poolId: number, shares: bigint): Promise<bigint> {
      const pool = resolveBankPool(poolId);
      return (await publicClient.readContract({
        address: pool.bank,
        abi: BANK_ABI,
        functionName: "convertToAssets",
        args: [shares]
      })) as bigint;
    },

    async getProviderLedger(
      poolId: number,
      owner: AddressT,
      opts?: {
        startBlock?: number;
        endBlock?: number;
        beforeBlock?: number;
        beforeLogIndex?: number;
        limit?: number;
      }
    ): Promise<BankProviderLedgerEntry[]> {
      const pool = resolveBankPool(poolId);
      const ownerAddress = getAddress(owner) as Address;
      const latest =
        opts?.endBlock != null ? BigInt(opts.endBlock) : await publicClient.getBlockNumber();
      const fromBlock =
        opts?.startBlock != null && opts.startBlock >= 0
          ? BigInt(opts.startBlock)
          : latest > 100_000n
            ? latest - 100_000n
            : 0n;
      const limit = opts?.limit ?? PROVIDER_LEDGER_DEFAULT_LIMIT;

      type CashLog = {
        transactionHash: Hex | null;
        blockNumber: bigint | null;
        logIndex: number | null;
        cash: NonNullable<ReturnType<typeof decodeBankProviderCashEvent>>;
      };
      const cashLogs: CashLog[] = [];
      for (
        let start = fromBlock;
        start <= latest;
        start += PROVIDER_LEDGER_SCAN_CHUNK_BLOCKS + 1n
      ) {
        const end =
          start + PROVIDER_LEDGER_SCAN_CHUNK_BLOCKS < latest
            ? start + PROVIDER_LEDGER_SCAN_CHUNK_BLOCKS
            : latest;
        const logs = await publicClient.getLogs({
          address: pool.bank,
          events: [BANK_DEPOSIT_EVENT, BANK_WITHDRAW_EVENT, BANK_RECOVERY_EVENT],
          fromBlock: start,
          toBlock: end
        });
        for (const log of logs) {
          const cash = decodeBankProviderCashEvent(
            pool.bank,
            log.eventName!,
            log.args as Record<string, unknown>
          );
          if (
            cash?.owner === ownerAddress.toLowerCase() &&
            log.transactionHash &&
            log.blockNumber != null &&
            log.logIndex != null &&
            !log.removed &&
            (opts?.beforeBlock == null ||
              log.blockNumber < BigInt(opts.beforeBlock) ||
              (log.blockNumber === BigInt(opts.beforeBlock) &&
                log.logIndex < (opts.beforeLogIndex ?? 0)))
          )
            cashLogs.push({ ...log, cash });
        }
      }
      const selected = cashLogs
        .sort((a, b) => Number(b.blockNumber! - a.blockNumber!) || b.logIndex! - a.logIndex!)
        .slice(0, limit);
      return Promise.all(
        selected.map(async (log): Promise<BankProviderLedgerEntry> => {
          const block = await publicClient.getBlock({ blockNumber: log.blockNumber! });
          return {
            id: `${release.chainId}:${log.transactionHash}:${log.logIndex ?? 0}`,
            action: log.cash.action,
            txHash: log.transactionHash!,
            blockNumber: Number(log.blockNumber),
            logIndex: log.logIndex ?? 0,
            timestamp: Number(block.timestamp) * 1000,
            assets: log.cash.assets,
            shares: log.cash.shares,
            receiver: log.cash.receiver,
            caller: log.cash.caller,
            epochId: log.cash.epochId,
            sharePrice: assetPerShare(log.cash.assets, log.cash.shares, pool.decimals)
          };
        })
      );
    },

    async getAssetBalance(asset: AddressT, user: AddressT): Promise<bigint> {
      return (await publicClient.readContract({
        address: asset as Address,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [user]
      })) as bigint;
    },

    async getAllowance(poolId: number, owner: AddressT): Promise<bigint> {
      const pool = resolveBankPool(poolId);
      return (await publicClient.readContract({
        address: pool.asset,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [owner, pool.bank]
      })) as bigint;
    },

    async deposit(
      poolId: number,
      assets: bigint,
      receiver: AddressT
    ): Promise<TxResult & { shares?: bigint }> {
      const walletReq = requireWallet();
      if ("error" in walletReq) return { txHash: "0x0" as Hex, ok: false, error: walletReq.error };
      const poolReq = getPool(poolId);
      if ("error" in poolReq) return { txHash: "0x0" as Hex, ok: false, error: poolReq.error };
      const pool = normalizePool(poolReq);

      const allowance = (await publicClient.readContract({
        address: pool.asset,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [walletReq.account, pool.bank]
      })) as bigint;
      const { needsApproval, approveAmount } = planExactApproval({ allowance, required: assets });

      if (needsApproval) {
        const approveTx = await tx.simulateAndWrite({
          chainId: release.chainId,
          releaseDigest: release.releaseDigest,
          action: "APPROVE_DEPOSIT",
          publicClient,
          walletClient: walletReq.walletClient,
          account: walletReq.account,
          address: pool.asset,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [pool.bank, approveAmount!]
        });
        if (!approveTx.ok) return approveTx;
        const allowanceReady = await waitForTokenAllowance({
          token: pool.asset,
          owner: walletReq.account,
          spender: pool.bank,
          required: assets
        });
        if (!allowanceReady.ok) {
          return {
            txHash: approveTx.txHash,
            ok: false,
            error: createAllowanceNotConfirmedError({
              action: "the Bank",
              required: assets,
              observed: allowanceReady.observed,
              spender: pool.bank
            })
          };
        }
      }

      return tx.simulateAndWrite({
        chainId: release.chainId,
        releaseDigest: release.releaseDigest,
        action: "DEPOSIT",
        publicClient,
        walletClient: walletReq.walletClient,
        account: walletReq.account,
        address: pool.bank,
        abi: BANK_ABI,
        functionName: "deposit",
        args: [assets, receiver]
      });
    },

    withdraw(poolId, assets, receiver, owner) {
      return bankExit(poolId, "withdraw", "WITHDRAW", (self) => [
        assets,
        receiver ?? self,
        owner ?? self
      ]);
    },

    redeem(poolId, shares, receiver, owner) {
      return bankExit(poolId, "redeem", "REDEEM", (self) => [
        shares,
        receiver ?? self,
        owner ?? self
      ]);
    },

    async mint(
      poolId: number,
      shares: bigint,
      receiver: AddressT
    ): Promise<TxResult & { assets?: bigint }> {
      const walletReq = requireWallet();
      if ("error" in walletReq) return { txHash: "0x0" as Hex, ok: false, error: walletReq.error };
      const poolReq = getPool(poolId);
      if ("error" in poolReq) return { txHash: "0x0" as Hex, ok: false, error: poolReq.error };
      const pool = normalizePool(poolReq);

      const blockNumber = await publicClient.getBlockNumber();
      const assetsNeeded = (await publicClient.readContract({
        address: pool.bank,
        abi: BANK_ABI,
        functionName: "previewMint",
        args: [shares],
        blockNumber
      })) as bigint;

      const allowance = (await publicClient.readContract({
        address: pool.asset,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [walletReq.account, pool.bank]
      })) as bigint;
      const { needsApproval, approveAmount } = planExactApproval({
        allowance,
        required: assetsNeeded
      });

      if (needsApproval) {
        const approveTx = await tx.simulateAndWrite({
          chainId: release.chainId,
          releaseDigest: release.releaseDigest,
          action: "APPROVE_MINT",
          publicClient,
          walletClient: walletReq.walletClient,
          account: walletReq.account,
          address: pool.asset,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [pool.bank, approveAmount!]
        });
        if (!approveTx.ok) return approveTx;
        const allowanceReady = await waitForTokenAllowance({
          token: pool.asset,
          owner: walletReq.account,
          spender: pool.bank,
          required: assetsNeeded
        });
        if (!allowanceReady.ok) {
          return {
            txHash: approveTx.txHash,
            ok: false,
            error: createAllowanceNotConfirmedError({
              action: "the Bank",
              required: assetsNeeded,
              observed: allowanceReady.observed,
              spender: pool.bank
            })
          };
        }
      }

      return tx.simulateAndWrite({
        chainId: release.chainId,
        releaseDigest: release.releaseDigest,
        action: "MINT",
        publicClient,
        walletClient: walletReq.walletClient,
        account: walletReq.account,
        address: pool.bank,
        abi: BANK_ABI,
        functionName: "mint",
        args: [shares, receiver]
      });
    },

    async maxWithdraw(poolId: number, owner: AddressT): Promise<bigint> {
      const pool = resolveBankPool(poolId);
      return (await publicClient.readContract({
        address: pool.bank,
        abi: BANK_ABI,
        functionName: "maxWithdraw",
        args: [owner]
      })) as bigint;
    },

    async maxRedeem(poolId: number, owner: AddressT): Promise<bigint> {
      const pool = resolveBankPool(poolId);
      return (await publicClient.readContract({
        address: pool.bank,
        abi: BANK_ABI,
        functionName: "maxRedeem",
        args: [owner]
      })) as bigint;
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

  const sportsHub: SSOTSportsHubAPI = {
    async getNextMarketId(): Promise<bigint> {
      return (await publicClient.readContract({
        address: sportsHubAddress,
        abi: SPORTS_HUB_ABI,
        functionName: "nextMarketId",
        args: []
      })) as bigint;
    },

    async getNextTicketId(): Promise<bigint> {
      return (await publicClient.readContract({
        address: sportsHubAddress,
        abi: SPORTS_HUB_ABI,
        functionName: "nextTicketId",
        args: []
      })) as bigint;
    },

    async getMarket(marketId: bigint): Promise<DomainSportsMarket> {
      const market = (await publicClient.readContract({
        address: sportsHubAddress,
        abi: SPORTS_HUB_ABI,
        functionName: "getMarket",
        args: [marketId]
      })) as any;
      return mapSportsMarket(market);
    },

    async getTicket(ticketId: bigint): Promise<DomainSportsTicket> {
      const ticket = (await publicClient.readContract({
        address: sportsHubAddress,
        abi: SPORTS_HUB_ABI,
        functionName: "getTicket",
        args: [ticketId]
      })) as any;
      return mapSportsTicket(ticket);
    },

    async getResult(marketId: bigint): Promise<DomainSportsResult> {
      const result = (await publicClient.readContract({
        address: sportsHubAddress,
        abi: SPORTS_HUB_ABI,
        functionName: "getResult",
        args: [marketId]
      })) as any;
      return mapSportsResult(result);
    },

    async getMarketReserved(marketId: bigint): Promise<bigint> {
      return (await publicClient.readContract({
        address: sportsHubAddress,
        abi: SPORTS_HUB_ABI,
        functionName: "marketReserved",
        args: [marketId]
      })) as bigint;
    },

    async getMarketOutcomeReserved(marketId: bigint, outcomeId: number): Promise<bigint> {
      return (await publicClient.readContract({
        address: sportsHubAddress,
        abi: SPORTS_HUB_ABI,
        functionName: "marketOutcomeReserved",
        args: [marketId, outcomeId]
      })) as bigint;
    },

    async getEventReserved(eventId: bigint): Promise<bigint> {
      return (await publicClient.readContract({
        address: sportsHubAddress,
        abi: SPORTS_HUB_ABI,
        functionName: "eventReserved",
        args: [eventId]
      })) as bigint;
    },

    async getPoolEventReserved(poolId: number, eventId: bigint): Promise<bigint> {
      return (await publicClient.readContract({
        address: sportsHubAddress,
        abi: SPORTS_HUB_ABI,
        functionName: "poolEventReserved",
        args: [BigInt(poolId), eventId]
      })) as bigint;
    },

    async hashOddsTicket(
      odds: SportsOddsSnapshotInput,
      player: AddressT,
      stake: bigint
    ): Promise<Hex> {
      return (await publicClient.readContract({
        address: sportsHubAddress,
        abi: SPORTS_HUB_ABI,
        functionName: "hashOddsTicket",
        args: [toSportsOddsStruct(odds), player, stake]
      })) as Hex;
    },

    async planPlaceTicket(
      input: PlaceSportsTicketInput
    ): Promise<PlaceSportsTicketPlan | { error: DomainError }> {
      try {
        if (input.chainId !== release.chainId) {
          return {
            error: {
              code: "CHAIN_MISMATCH",
              message: `Release chainId=${release.chainId} does not match request chainId=${input.chainId}.`,
              severity: "error"
            }
          };
        }

        if (!release.sports?.enabled) {
          return {
            error: {
              code: "SPORTSBOOK_DISABLED",
              message: "Sportsbook ticket placement is disabled for this release.",
              severity: "warning"
            }
          };
        }

        if (input.stake <= 0n) {
          return {
            error: { code: "BAD_INPUT", message: "stake must be > 0", severity: "error" }
          };
        }

        const walletReq = requireWallet();
        if ("error" in walletReq) return walletReq;

        const oddsCheck = validateSportsOddsInput(input);
        if (oddsCheck) return { error: oddsCheck };

        const market = await sportsHub.getMarket(input.marketId);
        if (market.state !== "open") {
          return {
            error: {
              code: "SPORTS_MARKET_NOT_OPEN",
              message: `Market ${input.marketId.toString()} is not open for ticket placement.`,
              severity: "warning",
              details: { state: market.state }
            }
          };
        }
        if (input.outcomeId < 0 || input.outcomeId >= market.outcomeCount) {
          return {
            error: {
              code: "SPORTS_BAD_OUTCOME",
              message: "Selected outcome is outside this market's outcome range.",
              severity: "error",
              details: { outcomeId: input.outcomeId, outcomeCount: market.outcomeCount }
            }
          };
        }
        if (input.odds.marketVersion !== market.version) {
          return {
            error: {
              code: "SPORTS_ODDS_VERSION_MISMATCH",
              message: "Odds snapshot version does not match the current market version.",
              severity: "warning",
              details: {
                oddsVersion: input.odds.marketVersion.toString(),
                marketVersion: market.version.toString()
              }
            }
          };
        }
        if (input.stake > input.odds.maxStake) {
          return {
            error: {
              code: "SPORTS_STAKE_EXCEEDS_ODDS_CAP",
              message: "Stake exceeds the signed odds snapshot maxStake.",
              severity: "warning",
              details: {
                stake: input.stake.toString(),
                maxStake: input.odds.maxStake.toString()
              }
            }
          };
        }

        const poolReq = getPool(market.poolId);
        if ("error" in poolReq) return poolReq;
        const pool = normalizePool(poolReq);
        if (pool.domain.toLowerCase() !== "sports" && !pool.sportsRisk) {
          return {
            error: {
              code: "SPORTS_POOL_REQUIRED",
              message: `Pool ${market.poolId} is not configured as a sports pool.`,
              severity: "error"
            }
          };
        }
        const releaseRiskHash = pool.sportsRisk?.riskHash?.toLowerCase();
        if (releaseRiskHash && releaseRiskHash !== input.odds.riskHash.toLowerCase()) {
          return {
            error: {
              code: "SPORTS_RISK_HASH_MISMATCH",
              message: "Odds snapshot riskHash does not match the release sports risk policy.",
              severity: "warning",
              details: { expected: pool.sportsRisk?.riskHash, received: input.odds.riskHash }
            }
          };
        }

        const allowance = (await publicClient.readContract({
          address: pool.asset,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [walletReq.account, sportsHubAddress]
        })) as bigint;
        const { needsApproval, approveAmount } = planExactApproval({
          allowance,
          required: input.stake
        });

        const warnings: string[] = [];
        if (release.isPlaceholder) {
          warnings.push("Release snapshot is marked as placeholder; writes are not recommended.");
        }
        const now = BigInt(Math.floor(Date.now() / 1000));
        if (input.odds.expiresAt <= now) {
          return {
            error: {
              code: "SPORTS_ODDS_EXPIRED",
              message: "Odds snapshot has expired.",
              severity: "warning",
              details: { expiresAt: input.odds.expiresAt.toString(), now: now.toString() }
            }
          };
        }

        let oddsTicketHash: Hex | undefined;
        try {
          oddsTicketHash = await sportsHub.hashOddsTicket(
            input.odds,
            walletReq.account as AddressT,
            input.stake
          );
        } catch {
          warnings.push("Could not preview the odds ticket hash before execution.");
        }

        const blockNumber = await publicClient.getBlockNumber({ cacheTime: 0 });
        const [minStake, activeOpenHolds, maxActiveHolds] = await Promise.all(
          ["minStake", "activeOpenHolds", "MAX_ACTIVE_HOLDS"].map(
            (functionName) =>
              publicClient.readContract({
                address: pool.bank,
                abi: BANK_ABI,
                functionName,
                blockNumber
              }) as Promise<bigint>
          )
        );
        if (input.stake < minStake!)
          return {
            error: {
              code: "STAKE_BELOW_MINIMUM",
              message: `Total stake must be at least ${minStake} asset units.`,
              severity: "warning"
            }
          };
        if (activeOpenHolds! >= maxActiveHolds!)
          return {
            error: {
              code: "POOL_CAPACITY_FULL",
              message: "This pool is temporarily at capacity.",
              severity: "warning",
              retryable: true
            }
          };

        const steps: PlaceSportsTicketPlan["steps"] = [];
        if (needsApproval) {
          steps.push({
            type: "approve",
            token: pool.asset as AddressT,
            spender: sportsHubAddress as AddressT,
            amount: approveAmount!
          });
        }
        steps.push({
          type: "placeSportsTicket",
          to: sportsHubAddress as AddressT,
          call: {
            contract: "SportsHub",
            fn: "placeTicket",
            argsSummary: {
              marketId: input.marketId,
              outcomeId: input.outcomeId,
              stake: input.stake,
              oddsWad: input.odds.oddsWad,
              maxPayout: input.odds.maxPayout,
              expiresAt: input.odds.expiresAt
            }
          }
        });

        return {
          chainId: release.chainId,
          releaseDigest: release.releaseDigest,
          warnings,
          steps,
          payload: {
            marketId: input.marketId,
            outcomeId: input.outcomeId,
            stake: input.stake,
            odds: input.odds,
            signature: input.signature,
            poolId: market.poolId
          },
          preview: {
            allowance,
            needsApproval,
            approveAmount,
            asset: pool.asset as AddressT,
            bank: pool.bank as AddressT,
            marketState: market.state,
            oddsTicketHash
          }
        };
      } catch (e) {
        return { error: toDomainError(e) };
      }
    },

    async executeTicketPlan(plan: PlaceSportsTicketPlan): Promise<ExecuteSportsTicketPlanResult> {
      const walletReq = requireWallet();
      if ("error" in walletReq) {
        return {
          placeTicketTx: { txHash: "0x0" as Hex, ok: false, error: walletReq.error }
        };
      }

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
            args: [getAddress(step.spender) as Address, step.amount]
          });
          if (!approveTx.ok) {
            return {
              approveTx,
              placeTicketTx: { txHash: "0x0" as Hex, ok: false, error: approveTx.error }
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
              placeTicketTx: {
                txHash: approveTx.txHash,
                ok: false,
                error: createAllowanceNotConfirmedError({
                  action: "place the ticket",
                  required: step.amount,
                  observed: allowanceReady.observed,
                  spender: getAddress(step.spender) as Address
                })
              }
            };
          }
        }
      }

      const placeStep = plan.steps.find((s) => s.type === "placeSportsTicket");
      if (!placeStep) {
        return {
          approveTx,
          placeTicketTx: {
            txHash: "0x0" as Hex,
            ok: false,
            error: {
              code: "NO_PLACE_TICKET_STEP",
              message: "No placeSportsTicket step in plan.",
              severity: "error"
            }
          }
        };
      }

      const payload = plan.payload;
      const args = [
        payload.marketId,
        payload.outcomeId,
        toSportsOddsStruct(payload.odds),
        payload.stake,
        payload.signature
      ] as const;

      const placeTicketTx = await tx.simulateAndWrite({
        chainId: plan.chainId,
        releaseDigest: plan.releaseDigest,
        action: "SPORTS_PLACE_TICKET",
        publicClient,
        walletClient: walletReq.walletClient,
        account: walletReq.account,
        address: sportsHubAddress,
        abi: SPORTS_EXECUTION_ABI,
        functionName: "placeTicket",
        args
      });

      if (!placeTicketTx.ok) {
        return { approveTx, placeTicketTx };
      }

      let ticketId: bigint | undefined;
      try {
        const receipt = await publicClient.getTransactionReceipt({ hash: placeTicketTx.txHash });
        const ev = tx.extractEventArgs({
          abi: SPORTS_HUB_ABI,
          receiptLogs: receipt.logs as any,
          eventName: "TicketPlaced"
        });
        const rawTicketId = ev[0]?.ticketId;
        if (rawTicketId != null) ticketId = BigInt(rawTicketId as any);
      } catch {
        // Event parsing is best-effort; callers can reconcile with getTicket/nextTicketId.
      }

      return { approveTx, placeTicketTx, ticketId };
    },

    async createMarket(input: CreateSportsMarketInput): Promise<TxResult> {
      return sportsHubWrite("SPORTS_CREATE_MARKET", "createMarket", [
        input.eventId,
        BigInt(input.poolId),
        input.outcomeCount,
        input.startsAt,
        input.lockTime,
        input.resultFinalitySeconds,
        input.marketKey,
        input.rulebookHash
      ]);
    },

    async openMarket(marketId: bigint): Promise<TxResult> {
      return sportsHubWrite("SPORTS_OPEN_MARKET", "openMarket", [marketId]);
    },

    async suspendMarket(marketId: bigint, suspended: boolean): Promise<TxResult> {
      return sportsHubWrite("SPORTS_SUSPEND_MARKET", "suspendMarket", [marketId, suspended]);
    },

    async lockMarket(marketId: bigint): Promise<TxResult> {
      return sportsHubWrite("SPORTS_LOCK_MARKET", "lockMarket", [marketId]);
    },

    async voidMarket(marketId: bigint, reasonHash: Hex): Promise<TxResult> {
      return sportsHubWrite("SPORTS_VOID_MARKET", "voidMarket", [marketId, reasonHash]);
    },

    async proposeResult(input: ProposeSportsResultInput): Promise<TxResult> {
      const reporterSignatures = input.reporterSignatures ?? [];
      const args = reporterSignatures.length
        ? [
            input.marketId,
            input.winningOutcomeId,
            input.resultSourceHash,
            input.evidenceHash,
            input.observedAt,
            reporterSignatures
          ]
        : [
            input.marketId,
            input.winningOutcomeId,
            input.resultSourceHash,
            input.evidenceHash,
            input.observedAt
          ];
      return sportsHubWrite("SPORTS_PROPOSE_RESULT", "proposeResult", args);
    },

    async challengeResult(marketId: bigint, reasonHash: Hex): Promise<TxResult> {
      return sportsHubWrite("SPORTS_CHALLENGE_RESULT", "challengeResult", [marketId, reasonHash]);
    },

    async resolveResultChallenge(input: ResolveSportsChallengeInput): Promise<TxResult> {
      return sportsHubWrite("SPORTS_RESOLVE_RESULT_CHALLENGE", "resolveResultChallenge", [
        input.marketId,
        mapSportsChallengeDecisionInput(input.decision),
        input.decisionHash
      ]);
    },

    async finalizeResult(marketId: bigint): Promise<TxResult> {
      return sportsHubWrite("SPORTS_FINALIZE_RESULT", "finalizeResult", [marketId]);
    },

    async settleTicket(ticketId: bigint): Promise<TxResult> {
      return sportsHubWrite("SPORTS_SETTLE_TICKET", "settleTicket", [ticketId]);
    },

    async settleTickets(ticketIds: readonly bigint[]): Promise<TxResult> {
      return sportsHubWrite("SPORTS_SETTLE_TICKETS", "settleTickets", [ticketIds]);
    },

    async refundTicket(ticketId: bigint): Promise<TxResult> {
      return sportsHubWrite("SPORTS_REFUND_TICKET", "refundTicket", [ticketId]);
    },

    async refundTickets(ticketIds: readonly bigint[]): Promise<TxResult> {
      return sportsHubWrite("SPORTS_REFUND_TICKETS", "refundTickets", [ticketIds]);
    },

    async voidTicket(ticketId: bigint): Promise<TxResult> {
      return sportsHubWrite("SPORTS_VOID_TICKET", "voidTicket", [ticketId]);
    },

    async voidTickets(ticketIds: readonly bigint[]): Promise<TxResult> {
      return sportsHubWrite("SPORTS_VOID_TICKETS", "voidTickets", [ticketIds]);
    }
  };

  function sportsHubWrite(
    action: string,
    functionName: string,
    args: readonly unknown[]
  ): Promise<TxResult> {
    const walletReq = requireWallet();
    if ("error" in walletReq)
      return Promise.resolve({ txHash: "0x0" as Hex, ok: false, error: walletReq.error });
    return tx.simulateAndWrite({
      chainId: release.chainId,
      releaseDigest: release.releaseDigest,
      action,
      publicClient,
      walletClient: walletReq.walletClient,
      account: walletReq.account,
      address: sportsHubAddress,
      abi: SPORTS_HUB_ABI,
      functionName,
      args
    });
  }

  return { release, account, gameHub, bank, vrfHub, sportsHub };
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

function mapSportsMarket(market: any): DomainSportsMarket {
  return {
    marketId: BigInt(market.marketId),
    eventId: BigInt(market.eventId),
    poolId: Number(market.poolId),
    outcomeCount: Number(market.outcomeCount),
    startsAt: Number(market.startsAt),
    lockTime: Number(market.lockTime),
    resultFinalitySeconds: Number(market.resultFinalitySeconds),
    version: BigInt(market.version),
    marketKey: market.marketKey as Hex,
    rulebookHash: market.rulebookHash as Hex,
    state: mapSportsMarketState(Number(market.state))
  };
}

function mapSportsTicket(ticket: any): DomainSportsTicket {
  return {
    ticketId: BigInt(ticket.ticketId),
    positionId: BigInt(ticket.positionId),
    marketId: BigInt(ticket.marketId),
    eventId: BigInt(ticket.eventId),
    poolId: Number(ticket.poolId),
    outcomeId: Number(ticket.outcomeId),
    player: ticket.player as AddressT,
    stake: BigInt(ticket.stake),
    payout: BigInt(ticket.payout),
    reserved: BigInt(ticket.reserved),
    oddsSnapshotHash: ticket.oddsSnapshotHash as Hex,
    rulebookHash: ticket.rulebookHash as Hex,
    acceptedAt: Number(ticket.acceptedAt),
    state: mapSportsTicketState(Number(ticket.state))
  };
}

function mapSportsResult(result: any): DomainSportsResult {
  return {
    marketId: BigInt(result.marketId),
    eventId: BigInt(result.eventId),
    poolId: Number(result.poolId),
    winningOutcomeId: Number(result.winningOutcomeId),
    marketVersion: BigInt(result.marketVersion),
    resultPayloadHash: result.resultPayloadHash as Hex,
    resultSourceHash: result.resultSourceHash as Hex,
    evidenceHash: result.evidenceHash as Hex,
    rulebookHash: result.rulebookHash as Hex,
    reporterSetHash: result.reporterSetHash as Hex,
    reporterThreshold: Number(result.reporterThreshold),
    reporterCount: Number(result.reporterCount),
    proposer: result.proposer as AddressT,
    observedAt: Number(result.observedAt),
    proposedAt: Number(result.proposedAt),
    finalizesAt: Number(result.finalizesAt),
    challenged: Boolean(result.challenged),
    challengeReasonHash: result.challengeReasonHash as Hex,
    challenger: result.challenger as AddressT,
    challengedAt: Number(result.challengedAt),
    challengeDecision: mapSportsChallengeDecision(Number(result.challengeDecision)),
    arbitrationDecisionHash: result.arbitrationDecisionHash as Hex,
    arbitrator: result.arbitrator as AddressT,
    arbitratedAt: Number(result.arbitratedAt)
  };
}

function mapSportsMarketState(state: number): DomainSportsMarket["state"] {
  const states: DomainSportsMarket["state"][] = [
    "none",
    "draft",
    "open",
    "locked",
    "suspended",
    "resultProposed",
    "challenged",
    "resolved",
    "voided"
  ];
  return states[state] ?? "none";
}

function mapSportsTicketState(state: number): DomainSportsTicket["state"] {
  const states: DomainSportsTicket["state"][] = ["none", "held", "settled", "refunded", "voided"];
  return states[state] ?? "none";
}

function mapSportsChallengeDecision(state: number): DomainSportsResult["challengeDecision"] {
  const states: DomainSportsResult["challengeDecision"][] = [
    "none",
    "upholdResult",
    "reopenResult",
    "voidMarket"
  ];
  return states[state] ?? "none";
}

function mapSportsChallengeDecisionInput(decision: ResolveSportsChallengeDecision) {
  if (decision === "upholdResult") return 1;
  if (decision === "reopenResult") return 2;
  return 3;
}

function toSportsOddsStruct(odds: SportsOddsSnapshotInput) {
  return {
    marketId: odds.marketId,
    outcomeId: odds.outcomeId,
    marketVersion: odds.marketVersion,
    oddsWad: odds.oddsWad,
    maxStake: odds.maxStake,
    maxPayout: odds.maxPayout,
    expiresAt: odds.expiresAt,
    nonce: odds.nonce,
    riskHash: odds.riskHash
  };
}

function validateSportsOddsInput(input: PlaceSportsTicketInput): DomainError | undefined {
  if (input.odds.marketId !== input.marketId) {
    return {
      code: "SPORTS_ODDS_MARKET_MISMATCH",
      message: "Odds snapshot marketId does not match the selected market.",
      severity: "error",
      details: {
        marketId: input.marketId.toString(),
        oddsMarketId: input.odds.marketId.toString()
      }
    };
  }
  if (input.odds.outcomeId !== input.outcomeId) {
    return {
      code: "SPORTS_ODDS_OUTCOME_MISMATCH",
      message: "Odds snapshot outcomeId does not match the selected outcome.",
      severity: "error",
      details: {
        outcomeId: input.outcomeId,
        oddsOutcomeId: input.odds.outcomeId
      }
    };
  }
  if (input.odds.oddsWad <= 0n || input.odds.maxStake <= 0n || input.odds.maxPayout <= 0n) {
    return {
      code: "SPORTS_BAD_ODDS_SNAPSHOT",
      message: "Odds snapshot oddsWad, maxStake, and maxPayout must be non-zero.",
      severity: "error"
    };
  }
  return undefined;
}
