import type { PublicClient, WalletClient } from "viem";
import { getAddress, type Address, type Hex } from "viem";
import type { SSOTRelease } from "../release/schema";
import type { DomainBankPosition, DomainBankSnapshot, DomainBet, DomainError, DomainXPBuckets } from "../domain";
import { decodeStakeSpec } from "../encoding/stakeSpec";
import { ERC20_ABI } from "../abis/erc20";
import { getReleaseAbis } from "../abis/release/resolver";
import { createTxPipeline, type JournalSink, type TxResult } from "./txPipeline";
import type {
  PlaceBetInput,
  PlaceBetPlan,
  ExecutePlanResult,
  ReconcilePlaceBetTxResult,
  BindPlaceBetTxResult,
  SSOTHubAPI,
  SSOTBankAPI,
  SSOTVRFHubAPI,
  Address as AddressT
} from "./types";
import { toDomainError } from "./errors";
import { planExactApproval } from "./approval";

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
  hub: SSOTHubAPI;
  bank: SSOTBankAPI;
  vrfHub: SSOTVRFHubAPI;
}

export function createSSOTSDK(params: CreateSSOTSDKParams): SSOTSDK {
  const { release, publicClient, walletClient, account } = params;
  const tx = createTxPipeline({ journal: params.journal });

  function requireWallet(): { walletClient: WalletClient; account: Address } | { error: DomainError } {
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

  const hubAddress = getAddress(release.contracts.hub) as Address;
  const vrfHubAddress = getAddress(release.contracts.vrfHub) as Address;

  // ABI resolution MUST be driven by the synchronized release bundle.
  const { HubAbi: HUB_ABI, BankAbi: BANK_ABI, VRFHubAbi: VRFHUB_ABI } = getReleaseAbis(release.chainId);

  const hub: SSOTHubAPI = {
    async quoteVRFFee(betCount: number): Promise<bigint> {
      const [fee] = (await publicClient.readContract({
        address: hubAddress,
        abi: HUB_ABI,
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

        const paused = (await publicClient.readContract({
          address: hubAddress,
          abi: HUB_ABI,
          functionName: "riskInPaused",
          args: [input.asset]
        })) as boolean;
        if (paused) {
          return {
            error: {
              code: "RISK_IN_PAUSED",
              message: "New bets are currently paused for this asset.",
              severity: "warning"
            }
          };
        }

        const bank = (await publicClient.readContract({
          address: hubAddress,
          abi: HUB_ABI,
          functionName: "bankFor",
          args: [input.asset]
        })) as Address;

        // Guard: bankFor returns 0x0 when asset is not registered on the Hub
        if (!bank || bank === "0x0000000000000000000000000000000000000000") {
          return {
            error: {
              code: "UNKNOWN_ASSET",
              message: `No bank registered for asset ${input.asset}. The asset may not be configured on this network.`,
              severity: "error"
            }
          };
        }

        const [fee] = (await publicClient.readContract({
          address: hubAddress,
          abi: HUB_ABI,
          functionName: "quoteVRFFee",
          args: [input.betCount]
        })) as unknown as [bigint, number];

        const allowance = (await publicClient.readContract({
          address: input.asset as Address,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [walletReq.account, bank]
        })) as bigint;

        const { needsApproval, approveAmount } = planExactApproval({ allowance, required: input.stake });
        const steps: PlaceBetPlan["steps"] = [];
        const warnings: string[] = [];

        if (needsApproval) {
          steps.push({
            type: "approve",
            token: input.asset as AddressT,
            spender: bank as AddressT,
            amount: approveAmount!
          });
        }

        steps.push({
          type: "placeBet",
          to: hubAddress as AddressT,
          value: fee,
          call: {
            contract: "Hub",
            fn: "placeBet",
            argsSummary: {
              gameId: input.gameId,
              asset: input.asset,
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
            asset: input.asset,
            params: input.params,
            stakeSpec: stakeSpecDecoded,
            affiliate: (input.affiliate ?? "0x0000000000000000000000000000000000000000") as AddressT,
            maxHouseEdgeBps: input.maxHouseEdgeBps
          },
          preview: {
            vrfFee: fee,
            stake: input.stake,
            allowance,
            needsApproval,
            approveAmount
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
            return { approveTx, placeBetTx: { txHash: "0x0" as Hex, ok: false, error: approveTx.error } };
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
            error: { code: "NO_PLACE_BET_STEP", message: "No placeBet step in plan.", severity: "error" }
          }
        };
      }

      const payload = plan.payload;

      const args = [
        payload.gameId,
        payload.asset as Address,
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
        address: hubAddress,
        abi: HUB_ABI,
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
          abi: HUB_ABI,
          receiptLogs: receipt.logs as any,
          eventName: "BetPlaced"
        });
        const first = ev[0];
        if (first?.betId != null) betId = BigInt(first.betId as any);
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
            error: { code: "BAD_TX_HASH", message: "Invalid txHash for reconciliation.", severity: "error" }
          };
        }
        const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
        const ev = tx.extractEventArgs({
          abi: HUB_ABI,
          receiptLogs: receipt.logs as any,
          eventName: "BetPlaced"
        });
        const first = ev[0];
        if (first?.betId != null) {
          return { ok: true, betId: BigInt(first.betId as any), source: "receipt" as const };
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
        const bet = await hub.getBet(betId);
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
        address: hubAddress,
        abi: HUB_ABI,
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
        address: hubAddress,
        abi: HUB_ABI,
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
        address: hubAddress,
        abi: HUB_ABI,
        functionName: "bindReferrer",
        args: [referrer]
      });
    },

    async referrerOf(player: AddressT): Promise<AddressT> {
      const referrer = (await publicClient.readContract({
        address: hubAddress,
        abi: HUB_ABI,
        functionName: "referrerOf",
        args: [player]
      })) as Address;
      return referrer as AddressT;
    },

    async getBet(betId: bigint): Promise<DomainBet> {
      const bet = (await publicClient.readContract({
        address: hubAddress,
        abi: HUB_ABI,
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
        player: bet.player as AddressT,
        stake: BigInt(bet.stake),
        vrfFeePaid: BigInt(bet.vrfFeePaid),
        state,
        placedAt: Number(bet.placedAt)
      };
    }
  };

  const bank: SSOTBankAPI = {
    async getSnapshot(asset: AddressT): Promise<DomainBankSnapshot> {
      const bankAddr = (await publicClient.readContract({
        address: hubAddress,
        abi: HUB_ABI,
        functionName: "bankFor",
        args: [asset]
      })) as Address;

      const ssot = (await publicClient.readContract({
        address: bankAddr,
        abi: BANK_ABI,
        functionName: "getSSOT",
        args: []
      })) as any;

      return {
        chainId: release.chainId,
        asset,
        bank: bankAddr as AddressT,
        totalAssets: BigInt(ssot.NAV),
        totalReserved: BigInt(ssot.R),
        minLiquidityBps: Number(ssot.minLiquidityBps),
        protocolFeesPayable: BigInt(ssot.PF),
        externalPayablesTotal: BigInt(ssot.XP)
      };
    },

    async getPosition(asset: AddressT, user: AddressT): Promise<DomainBankPosition> {
      const bankAddr = (await publicClient.readContract({
        address: hubAddress,
        abi: HUB_ABI,
        functionName: "bankFor",
        args: [asset]
      })) as Address;

      const shares = (await publicClient.readContract({
        address: bankAddr,
        abi: BANK_ABI,
        functionName: "balanceOf",
        args: [user]
      })) as bigint;

      const assetsEquivalent = (await publicClient.readContract({
        address: bankAddr,
        abi: BANK_ABI,
        functionName: "convertToAssets",
        args: [shares]
      })) as bigint;

      return { user, shares, assetsEquivalent };
    },

    async deposit(assets: bigint, receiver: AddressT): Promise<TxResult & { shares?: bigint }> {
      const walletReq = requireWallet();
      if ("error" in walletReq) return { txHash: "0x0" as Hex, ok: false, error: walletReq.error };

      const bankAddr = (await publicClient.readContract({
        address: hubAddress, abi: HUB_ABI, functionName: "bankFor", args: [receiver]
      })) as Address;

      // Guard: bankFor returns 0x0 when asset is not registered
      if (!bankAddr || bankAddr === "0x0000000000000000000000000000000000000000") {
        return { txHash: "0x0" as Hex, ok: false, error: {
          code: "UNKNOWN_ASSET",
          message: "No bank registered for this asset. The asset may not be configured on this network.",
          severity: "error"
        }};
      }

      // ERC20 approve for the bank (exact amount)
      const allowance = (await publicClient.readContract({
        address: release.assets[0]?.address as Address ?? ("0x" as Address),
        abi: ERC20_ABI, functionName: "allowance", args: [walletReq.account, bankAddr]
      })) as bigint;
      const { needsApproval, approveAmount } = planExactApproval({ allowance, required: assets });

      if (needsApproval) {
        const approveTx = await tx.simulateAndWrite({
          chainId: release.chainId, releaseDigest: release.releaseDigest, action: "APPROVE_DEPOSIT",
          publicClient, walletClient: walletReq.walletClient, account: walletReq.account,
          address: release.assets[0]?.address as Address ?? ("0x" as Address),
          abi: ERC20_ABI, functionName: "approve", args: [bankAddr, approveAmount!]
        });
        if (!approveTx.ok) return approveTx;
      }

      const result = await tx.simulateAndWrite({
        chainId: release.chainId, releaseDigest: release.releaseDigest, action: "DEPOSIT",
        publicClient, walletClient: walletReq.walletClient, account: walletReq.account,
        address: bankAddr, abi: BANK_ABI, functionName: "deposit", args: [assets, receiver]
      });

      return result;
    },

    async withdraw(assets: bigint, receiver: AddressT, owner: AddressT): Promise<TxResult & { shares?: bigint }> {
      const walletReq = requireWallet();
      if ("error" in walletReq) return { txHash: "0x0" as Hex, ok: false, error: walletReq.error };

      const bankAddr = (await publicClient.readContract({
        address: hubAddress, abi: HUB_ABI, functionName: "bankFor", args: [owner]
      })) as Address;

      return tx.simulateAndWrite({
        chainId: release.chainId, releaseDigest: release.releaseDigest, action: "WITHDRAW",
        publicClient, walletClient: walletReq.walletClient, account: walletReq.account,
        address: bankAddr, abi: BANK_ABI, functionName: "withdraw", args: [assets, receiver, owner]
      });
    },

    async redeem(shares: bigint, receiver: AddressT, owner: AddressT): Promise<TxResult & { assets?: bigint }> {
      const walletReq = requireWallet();
      if ("error" in walletReq) return { txHash: "0x0" as Hex, ok: false, error: walletReq.error };

      const bankAddr = (await publicClient.readContract({
        address: hubAddress, abi: HUB_ABI, functionName: "bankFor", args: [owner]
      })) as Address;

      return tx.simulateAndWrite({
        chainId: release.chainId, releaseDigest: release.releaseDigest, action: "REDEEM",
        publicClient, walletClient: walletReq.walletClient, account: walletReq.account,
        address: bankAddr, abi: BANK_ABI, functionName: "redeem", args: [shares, receiver, owner]
      });
    },

    async mint(shares: bigint, receiver: AddressT): Promise<TxResult & { assets?: bigint }> {
      const walletReq = requireWallet();
      if ("error" in walletReq) return { txHash: "0x0" as Hex, ok: false, error: walletReq.error };

      const firstAsset = release.assets[0]?.address as Address;
      const bankAddr = (await publicClient.readContract({
        address: hubAddress, abi: HUB_ABI, functionName: "bankFor", args: [firstAsset]
      })) as Address;

      // Mint requires approval: compute the cost in assets for the requested shares
      const assetsNeeded = (await publicClient.readContract({
        address: bankAddr, abi: BANK_ABI, functionName: "convertToAssets", args: [shares]
      })) as bigint;

      const allowance = (await publicClient.readContract({
        address: firstAsset, abi: ERC20_ABI, functionName: "allowance", args: [walletReq.account, bankAddr]
      })) as bigint;
      const { needsApproval, approveAmount } = planExactApproval({ allowance, required: assetsNeeded });

      if (needsApproval) {
        const approveTx = await tx.simulateAndWrite({
          chainId: release.chainId, releaseDigest: release.releaseDigest, action: "APPROVE_MINT",
          publicClient, walletClient: walletReq.walletClient, account: walletReq.account,
          address: firstAsset, abi: ERC20_ABI, functionName: "approve", args: [bankAddr, approveAmount!]
        });
        if (!approveTx.ok) return approveTx;
      }

      return tx.simulateAndWrite({
        chainId: release.chainId, releaseDigest: release.releaseDigest, action: "MINT",
        publicClient, walletClient: walletReq.walletClient, account: walletReq.account,
        address: bankAddr, abi: BANK_ABI, functionName: "mint", args: [shares, receiver]
      });
    },

    async maxWithdraw(owner: AddressT): Promise<bigint> {
      const firstAsset = release.assets[0]?.address as Address;
      const bankAddr = (await publicClient.readContract({
        address: hubAddress, abi: HUB_ABI, functionName: "bankFor", args: [firstAsset]
      })) as Address;

      return (await publicClient.readContract({
        address: bankAddr, abi: BANK_ABI, functionName: "maxWithdraw", args: [owner]
      })) as bigint;
    },

    async maxRedeem(owner: AddressT): Promise<bigint> {
      const firstAsset = release.assets[0]?.address as Address;
      const bankAddr = (await publicClient.readContract({
        address: hubAddress, abi: HUB_ABI, functionName: "bankFor", args: [firstAsset]
      })) as Address;

      return (await publicClient.readContract({
        address: bankAddr, abi: BANK_ABI, functionName: "maxRedeem", args: [owner]
      })) as bigint;
    },

    async playerTurnover(player: AddressT): Promise<bigint> {
      const firstAsset = release.assets[0]?.address as Address;
      const bankAddr = (await publicClient.readContract({
        address: hubAddress, abi: HUB_ABI, functionName: "bankFor", args: [firstAsset]
      })) as Address;

      return (await publicClient.readContract({
        address: bankAddr, abi: BANK_ABI, functionName: "playerTurnover", args: [player]
      })) as bigint;
    },

    async claimProtocolFees(amount: bigint, receiver: AddressT): Promise<TxResult & { claimed?: bigint }> {
      const walletReq = requireWallet();
      if ("error" in walletReq) return { txHash: "0x0" as Hex, ok: false, error: walletReq.error };

      // claimProtocolFees uses the first asset's bank (governance knows which)
      const bankAddr = (await publicClient.readContract({
        address: hubAddress, abi: HUB_ABI, functionName: "bankFor", args: [receiver]
      })) as Address;

      return tx.simulateAndWrite({
        chainId: release.chainId, releaseDigest: release.releaseDigest, action: "CLAIM_PROTOCOL_FEES",
        publicClient, walletClient: walletReq.walletClient, account: walletReq.account,
        address: bankAddr, abi: BANK_ABI, functionName: "claimProtocolFees", args: [amount, receiver]
      });
    },

    async claimXPAcrued(amount: bigint, receiver: AddressT): Promise<TxResult & { claimed?: bigint }> {
      const walletReq = requireWallet();
      if ("error" in walletReq) return { txHash: "0x0" as Hex, ok: false, error: walletReq.error };

      const bankAddr = (await publicClient.readContract({
        address: hubAddress, abi: HUB_ABI, functionName: "bankFor", args: [receiver]
      })) as Address;

      return tx.simulateAndWrite({
        chainId: release.chainId, releaseDigest: release.releaseDigest, action: "CLAIM_XP_ACCRUED",
        publicClient, walletClient: walletReq.walletClient, account: walletReq.account,
        address: bankAddr, abi: BANK_ABI, functionName: "claimXPAcrued", args: [amount, receiver]
      });
    },

    async getXPBuckets(payee: AddressT): Promise<DomainXPBuckets> {
      // Use the first asset's bank for XP reads
      const firstAsset = release.assets[0]?.address as Address;
      const bankAddr = (await publicClient.readContract({
        address: hubAddress, abi: HUB_ABI, functionName: "bankFor", args: [firstAsset]
      })) as Address;

      const [accrued, locked, holdback, releasable] = await Promise.all([
        publicClient.readContract({ address: bankAddr, abi: BANK_ABI, functionName: "xpAccruedOf", args: [payee] }) as Promise<bigint>,
        publicClient.readContract({ address: bankAddr, abi: BANK_ABI, functionName: "xpLockedOf", args: [payee] }) as Promise<bigint>,
        publicClient.readContract({ address: bankAddr, abi: BANK_ABI, functionName: "xpHoldbackOf", args: [payee] }) as Promise<bigint>,
        publicClient.readContract({ address: bankAddr, abi: BANK_ABI, functionName: "holdbackReleasable", args: [payee] }) as Promise<bigint>,
      ]);

      return { payee, accrued, locked, holdback, holdbackReleasable: releasable };
    },

    async unlockXPLocked(payee: AddressT, sourcePlayer: AddressT): Promise<TxResult> {
      const walletReq = requireWallet();
      if ("error" in walletReq) return { txHash: "0x0" as Hex, ok: false, error: walletReq.error };

      const firstAsset = release.assets[0]?.address as Address;
      const bankAddr = (await publicClient.readContract({
        address: hubAddress, abi: HUB_ABI, functionName: "bankFor", args: [firstAsset]
      })) as Address;

      return tx.simulateAndWrite({
        chainId: release.chainId, releaseDigest: release.releaseDigest, action: "UNLOCK_XP_LOCKED",
        publicClient, walletClient: walletReq.walletClient, account: walletReq.account,
        address: bankAddr, abi: BANK_ABI, functionName: "unlockXPLocked", args: [payee, sourcePlayer]
      });
    },

    async syncXPHoldback(payee: AddressT): Promise<TxResult> {
      const walletReq = requireWallet();
      if ("error" in walletReq) return { txHash: "0x0" as Hex, ok: false, error: walletReq.error };

      const firstAsset = release.assets[0]?.address as Address;
      const bankAddr = (await publicClient.readContract({
        address: hubAddress, abi: HUB_ABI, functionName: "bankFor", args: [firstAsset]
      })) as Address;

      return tx.simulateAndWrite({
        chainId: release.chainId, releaseDigest: release.releaseDigest, action: "SYNC_XP_HOLDBACK",
        publicClient, walletClient: walletReq.walletClient, account: walletReq.account,
        address: bankAddr, abi: BANK_ABI, functionName: "syncXPHoldback", args: [payee]
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

  return { release, account, hub, bank, vrfHub };
}

function mapBetState(state: number): DomainBet["state"] {
  // SSOTTypes.BetState: None(0), Held(1), PendingVRF(2), RandomReady(3), Settled(4), Refunded(5)
  if (state === 3) return "randomReady";
  if (state === 4) return "finalized";
  if (state === 5) return "refunded";
  return "placed";
}
