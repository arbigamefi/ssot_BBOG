import type { PublicClient, WalletClient } from "viem";
import { getAddress, type Address, type Hex } from "viem";
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
import { getReleaseAbis } from "../abis/release/resolver";
import { createTxPipeline, type JournalSink, type TxResult } from "./txPipeline";
import type {
  PlaceBetInput,
  PlaceBetPlan,
  CreateSportsMarketInput,
  ExecutePlanResult,
  ExecuteSportsTicketPlanResult,
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

/** Minimal ABI shared by all GameModule contracts for maxPayout calculation. */
const GAME_MODULE_ABI = [
  {
    inputs: [
      { name: "params", type: "bytes" },
      {
        components: [
          { name: "amountPerRoll", type: "uint256" },
          { name: "betCount", type: "uint32" },
          { name: "stopGain", type: "uint256" },
          { name: "stopLoss", type: "uint256" }
        ],
        name: "stakeSpec",
        type: "tuple"
      }
    ],
    name: "maxPayout",
    outputs: [{ name: "reserved", type: "uint256" }],
    stateMutability: "pure",
    type: "function"
  }
] as const;

const GAME_HUB_OUTCOME_READ_ABI = [
  {
    inputs: [{ name: "positionId", type: "uint256" }],
    name: "getBetParams",
    outputs: [{ name: "", type: "bytes" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ name: "positionId", type: "uint256" }],
    name: "getBetRandomWords",
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function"
  }
] as const;

const GAME_HUB_TERMINAL_PROOF_LOOKBACK_BLOCKS = 250n;
const GAME_HUB_TERMINAL_PROOF_CHUNK_BLOCKS = 10n;
const ALLOWANCE_CONFIRMATION_ATTEMPTS = 6;
const ALLOWANCE_CONFIRMATION_DELAY_MS = 500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface CreateSSOTSDKParams {
  release: SSOTRelease;
  publicClient: PublicClient;
  walletClient?: WalletClient;
  account?: Address;
  journal?: JournalSink;
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
  const tx = createTxPipeline({ journal: params.journal });

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
    poolId: number
  ): NonNullable<SSOTRelease["pools"]>[number] | { error: DomainError } {
    const pool = release.pools.find((item) => item.poolId === poolId);
    if (!pool) {
      return {
        error: {
          code: "UNKNOWN_POOL",
          message: `No pool found for poolId ${poolId} in the v1.3 release bundle.`,
          severity: "error"
        }
      };
    }
    if (!pool.active) {
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

  function resolvePool(poolId: number) {
    const pool = getPool(poolId);
    if ("error" in pool) {
      throw new Error(pool.error.message);
    }
    return normalizePool(pool);
  }

  const gameHubAddress = getAddress(release.contracts.gameHub) as Address;
  const vrfHubAddress = getAddress(release.contracts.vrfHub) as Address;
  const sportsHubAddress = getAddress(release.contracts.sportsHub) as Address;

  // ABI resolution MUST be driven by the synchronized release bundle.
  const {
    GameHubAbi: GAME_HUB_ABI,
    BankAbi: BANK_ABI,
    VRFHubAbi: VRFHUB_ABI,
    SportsHubAbi: SPORTS_HUB_ABI
  } = getReleaseAbis(release.chainId);

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
      observed = await readTokenAllowance(params.token, params.owner, params.spender);
      if (observed >= params.required) return { ok: true as const, observed };
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
    let receipt: any;
    try {
      receipt = await publicClient.readContract({
        address: gameHubAddress,
        abi: GAME_HUB_ABI,
        functionName: "getBetTerminal",
        args: [betId]
      } as any);
    } catch {
      // Older dev deployments do not expose getBetTerminal. Keep event-log proof as fallback.
      return null;
    }

    const state = Number(receipt?.state ?? 0);
    if (state === 4) {
      return {
        kind: "settled",
        settlement: {
          payoutGross: BigInt(receipt.payoutGross ?? 0n),
          payoutNet: BigInt(receipt.payoutNet ?? 0n),
          feeOnPayout: BigInt(receipt.feeOnPayout ?? 0n),
          protocolFeeAccrual: BigInt(receipt.protocolFeeAccrual ?? 0n)
        }
      };
    }

    if (state === 5) {
      return {
        kind: "refunded",
        refund: {
          refundAmount: BigInt(receipt.refundAmount ?? 0n)
        }
      };
    }

    return null;
  }

  const gameHub: SSOTGameHubAPI = {
    async quoteVRFFee(betCount: number): Promise<bigint> {
      const [fee] = (await publicClient.readContract({
        address: gameHubAddress,
        abi: GAME_HUB_ABI,
        functionName: "quoteVRFFee",
        args: [betCount]
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

        if (input.betCount <= 0) {
          return {
            error: { code: "BAD_INPUT", message: "betCount must be > 0", severity: "error" }
          };
        }

        const walletReq = requireWallet();
        if ("error" in walletReq) return walletReq;

        const pool = getPool(input.poolId);
        if ("error" in pool) return pool;

        const asset = getAddress(pool.asset) as Address;
        const bank = getAddress(pool.bank) as Address;

        const paused = (await publicClient.readContract({
          address: gameHubAddress,
          abi: GAME_HUB_ABI,
          functionName: "riskInPaused",
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

        const [rawFee] = (await publicClient.readContract({
          address: gameHubAddress,
          abi: GAME_HUB_ABI,
          functionName: "quoteVRFFee",
          args: [input.betCount]
        })) as unknown as [bigint, number];

        // Add 50% buffer to VRF fee to account for L1 gas price fluctuation
        // between planning and execution. The contract refunds any overpayment.
        const fee = rawFee + rawFee / 2n;

        const allowance = (await publicClient.readContract({
          address: asset,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [walletReq.account, bank]
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
        const stakeSpecForSolvency = decodeStakeSpec(input.stakeSpec);

        // Parallel reads: game module maxPayout + bank solvency state
        const [requiredReserve, totalAssets, totalReserved, minLiquidityBps] = await Promise.all([
          publicClient.readContract({
            address: getAddress(moduleAddress) as Address,
            abi: GAME_MODULE_ABI,
            functionName: "maxPayout",
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
            functionName: "totalAssets"
          }) as Promise<bigint>,
          publicClient.readContract({
            address: bank as Address,
            abi: BANK_ABI,
            functionName: "totalReserved"
          }) as Promise<bigint>,
          publicClient.readContract({
            address: bank as Address,
            abi: BANK_ABI,
            functionName: "minLiquidityBps"
          }) as Promise<bigint>
        ]);

        // freeLiquidity = totalAssets - totalReserved - (totalAssets × minLiquidityBps / 10000)
        const minLiqReserve = (totalAssets * BigInt(minLiquidityBps)) / 10000n;
        const freeLiquidity = totalAssets - totalReserved - minLiqReserve;

        if (requiredReserve > freeLiquidity) {
          return {
            error: {
              code: "INSUFFICIENT_LIQUIDITY",
              message: `Bank liquidity insufficient. Required reserve: ${requiredReserve}, available: ${freeLiquidity}. Reduce your stake or wait for more deposits.`,
              severity: "warning",
              details: { required: requiredReserve.toString(), available: freeLiquidity.toString() }
            }
          };
        }

        // Warn if liquidity is tight (reserved > 90% of free liquidity)
        if (requiredReserve * 10n > freeLiquidity * 9n) {
          warnings.push(
            "Bank liquidity is tight — your bet may revert if another bet is placed first."
          );
        }

        if (needsApproval) {
          steps.push({
            type: "approve",
            token: asset as AddressT,
            spender: bank as AddressT,
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

        const stakeSpecDecoded = decodeStakeSpec(input.stakeSpec);
        if (stakeSpecDecoded.betCount !== input.betCount) {
          return {
            error: {
              code: "STAKE_SPEC_MISMATCH",
              message: "stakeSpec.betCount must match betCount.",
              severity: "error",
              details: { stakeSpecBetCount: stakeSpecDecoded.betCount, betCount: input.betCount }
            }
          };
        }
        const impliedStake = stakeSpecDecoded.amountPerRoll * BigInt(stakeSpecDecoded.betCount);
        if (impliedStake !== input.stake) {
          warnings.push(
            `stakeSpec implies stake=${impliedStake.toString()} but input stake=${input.stake.toString()}. Execution will use stakeSpec.`
          );
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

    async executePlan(plan: PlaceBetPlan): Promise<ExecutePlanResult> {
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
            args: [getAddress(step.spender) as Address, step.amount]
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
                txHash: approveTx.txHash,
                ok: false,
                error: createAllowanceNotConfirmedError({
                  action: "place the bet",
                  required: step.amount,
                  observed: allowanceReady.observed,
                  spender: getAddress(step.spender) as Address
                })
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

      const placeBetTx = await tx.simulateAndWrite({
        chainId: plan.chainId,
        releaseDigest: plan.releaseDigest,
        action: "PLACE_BET",
        publicClient,
        walletClient: walletReq.walletClient,
        account: walletReq.account,
        address: gameHubAddress,
        abi: GAME_HUB_ABI,
        functionName: "placeBet",
        args,
        value: placeStep.value
      });

      if (!placeBetTx.ok) {
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
        const rawBetId = first?.positionId ?? first?.betId;
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
        const ev = tx.extractEventArgs({
          abi: GAME_HUB_ABI,
          receiptLogs: receipt.logs as any,
          eventName: "BetPlaced",
          address: gameHubAddress
        });
        const first = ev[0];
        const rawBetId = first?.positionId ?? first?.betId;
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
        vrfRequestedAt: numberOrUndefined(bet.vrfRequestedAt),
        resolvedAt: numberOrUndefined(bet.resolvedAt),
        settledAt: numberOrUndefined(bet.resolvedAt)
      };
    },

    async getBetParams(betId: bigint): Promise<Hex> {
      return (await publicClient.readContract({
        address: gameHubAddress,
        abi: GAME_HUB_OUTCOME_READ_ABI,
        functionName: "getBetParams",
        args: [betId]
      })) as Hex;
    },

    async getBetRandomWords(betId: bigint): Promise<bigint[]> {
      const words = (await publicClient.readContract({
        address: gameHubAddress,
        abi: GAME_HUB_OUTCOME_READ_ABI,
        functionName: "getBetRandomWords",
        args: [betId]
      })) as readonly bigint[];
      return [...words];
    },

    async getTerminalProof(betId: bigint): Promise<GameHubTerminalProof | null> {
      const terminalReceipt = await readTerminalReceipt(betId);
      if (terminalReceipt) return terminalReceipt;

      const latestBlock = await publicClient.getBlockNumber();
      let latest: Awaited<ReturnType<typeof readTerminalEventsInRange>>[number] | undefined;

      for (const range of terminalProofRanges(latestBlock)) {
        const events = await readTerminalEventsInRange({ betId, ...range });
        latest = events[0];
        if (latest) break;
      }

      if (!latest) return null;

      const args = latest.event.args ?? {};
      const txHash = latest.event.transactionHash as Hex | undefined;
      const blockNumber = latest.event.blockNumber as bigint | undefined;

      if (latest.kind === "settled") {
        return {
          kind: "settled",
          settlement: {
            txHash,
            blockNumber,
            payoutGross: BigInt(args.payoutGross ?? 0n),
            payoutNet: BigInt(args.payoutNet ?? 0n),
            feeOnPayout: BigInt(args.feeOnPayout ?? 0n),
            protocolFeeAccrual: BigInt(args.protocolFeeAccrual ?? 0n)
          }
        };
      }

      return {
        kind: "refunded",
        refund: {
          txHash,
          blockNumber,
          refundAmount: BigInt(args.refundAmount ?? 0n)
        }
      };
    }
  };

  const bank: SSOTBankAPI = {
    async getSnapshot(poolId: number): Promise<DomainBankSnapshot> {
      const pool = resolvePool(poolId);
      const shareUnit = 10n ** BigInt(pool.decimals);
      const [ssot, totalSupply, assetsPerShare] = (await Promise.all([
        publicClient.readContract({
          address: pool.bank,
          abi: BANK_ABI,
          functionName: "getSSOT",
          args: []
        }),
        publicClient.readContract({
          address: pool.bank,
          abi: BANK_ABI,
          functionName: "totalSupply",
          args: []
        }),
        publicClient.readContract({
          address: pool.bank,
          abi: BANK_ABI,
          functionName: "convertToAssets",
          args: [shareUnit]
        })
      ])) as [any, bigint, bigint];

      return {
        chainId: release.chainId,
        poolId,
        asset: pool.asset as AddressT,
        bank: pool.bank as AddressT,
        totalAssets: BigInt(ssot.NAV),
        totalSupply,
        assetsPerShare,
        totalReserved: BigInt(ssot.R),
        minLiquidityBps: Number(ssot.minLiquidityBps),
        protocolFeesPayable: BigInt(ssot.PF),
        externalPayablesTotal: BigInt(ssot.XP)
      };
    },

    async getPosition(poolId: number, user: AddressT): Promise<DomainBankPosition> {
      const pool = resolvePool(poolId);
      const shares = (await publicClient.readContract({
        address: pool.bank,
        abi: BANK_ABI,
        functionName: "balanceOf",
        args: [user]
      })) as bigint;

      const assetsEquivalent = (await publicClient.readContract({
        address: pool.bank,
        abi: BANK_ABI,
        functionName: "convertToAssets",
        args: [shares]
      })) as bigint;

      return { poolId, user, shares, assetsEquivalent };
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
      const pool = resolvePool(poolId);
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

    async withdraw(
      poolId: number,
      assets: bigint,
      receiver: AddressT,
      owner: AddressT
    ): Promise<TxResult & { shares?: bigint }> {
      const walletReq = requireWallet();
      if ("error" in walletReq) return { txHash: "0x0" as Hex, ok: false, error: walletReq.error };
      const poolReq = getPool(poolId);
      if ("error" in poolReq) return { txHash: "0x0" as Hex, ok: false, error: poolReq.error };
      const pool = normalizePool(poolReq);

      return tx.simulateAndWrite({
        chainId: release.chainId,
        releaseDigest: release.releaseDigest,
        action: "WITHDRAW",
        publicClient,
        walletClient: walletReq.walletClient,
        account: walletReq.account,
        address: pool.bank,
        abi: BANK_ABI,
        functionName: "withdraw",
        args: [assets, receiver, owner]
      });
    },

    async redeem(
      poolId: number,
      shares: bigint,
      receiver: AddressT,
      owner: AddressT
    ): Promise<TxResult & { assets?: bigint }> {
      const walletReq = requireWallet();
      if ("error" in walletReq) return { txHash: "0x0" as Hex, ok: false, error: walletReq.error };
      const poolReq = getPool(poolId);
      if ("error" in poolReq) return { txHash: "0x0" as Hex, ok: false, error: poolReq.error };
      const pool = normalizePool(poolReq);

      return tx.simulateAndWrite({
        chainId: release.chainId,
        releaseDigest: release.releaseDigest,
        action: "REDEEM",
        publicClient,
        walletClient: walletReq.walletClient,
        account: walletReq.account,
        address: pool.bank,
        abi: BANK_ABI,
        functionName: "redeem",
        args: [shares, receiver, owner]
      });
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

      const assetsNeeded = (await publicClient.readContract({
        address: pool.bank,
        abi: BANK_ABI,
        functionName: "convertToAssets",
        args: [shares]
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
      const pool = resolvePool(poolId);
      return (await publicClient.readContract({
        address: pool.bank,
        abi: BANK_ABI,
        functionName: "maxWithdraw",
        args: [owner]
      })) as bigint;
    },

    async maxRedeem(poolId: number, owner: AddressT): Promise<bigint> {
      const pool = resolvePool(poolId);
      return (await publicClient.readContract({
        address: pool.bank,
        abi: BANK_ABI,
        functionName: "maxRedeem",
        args: [owner]
      })) as bigint;
    },

    async playerTurnover(poolId: number, player: AddressT): Promise<bigint> {
      const pool = resolvePool(poolId);
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
      const pool = resolvePool(poolId);
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
          args: [walletReq.account, pool.bank]
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

        const steps: PlaceSportsTicketPlan["steps"] = [];
        if (needsApproval) {
          steps.push({
            type: "approve",
            token: pool.asset as AddressT,
            spender: pool.bank as AddressT,
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
        abi: SPORTS_HUB_ABI,
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
