import {
  BaseError,
  parseEventLogs,
  type Abi,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient
} from "viem";
import type { DomainError } from "../domain";
import { toDomainError } from "./errors";
import type { TxResult } from "./types";

export interface TxJournalEntry {
  chainId: number;
  releaseDigest: string;
  action: string;
  txHash: Hex;
  status: "submitted" | "mined" | "failed" | "timeout";
  ok: boolean;
  createdAt: number;
  minedAt?: number;
  blockNumber?: number;
  errorCode?: string;
}

export type JournalSink = (entry: TxJournalEntry) => void;

export type { TxResult };

/** Pipeline configuration with production defaults. */
export interface TxPipelineConfig {
  /** Receipt wait timeout in ms. Default: 120_000 (2 minutes). */
  receiptTimeoutMs?: number;
  /** Number of retries for transient simulate failures. Default: 1. */
  maxRetries?: number;
  /** Delay between retries in ms. Default: 2_000. */
  retryDelayMs?: number;
  /** Minimum interval between RPC calls in ms. Default: 200. */
  minIntervalMs?: number;
}

const DEFAULT_CONFIG: Required<TxPipelineConfig> = {
  receiptTimeoutMs: 120_000,
  maxRetries: 1,
  retryDelayMs: 2_000,
  minIntervalMs: 200,
};

export interface TxPipeline {
  simulateAndWrite(params: {
    chainId: number;
    releaseDigest: string;
    action: string;
    publicClient: PublicClient;
    walletClient: WalletClient;
    account: Address;
    address: Address;
    abi: Abi;
    functionName: string;
    args: readonly unknown[];
    value?: bigint;
  }): Promise<TxResult>;
  writeNoSimulate(params: {
    chainId: number;
    releaseDigest: string;
    action: string;
    publicClient: PublicClient;
    walletClient: WalletClient;
    address: Address;
    abi: Abi;
    functionName: string;
    args: readonly unknown[];
    value?: bigint;
  }): Promise<TxResult>;
  extractEventArgs<T extends { eventName: string }>(params: {
    abi: Abi;
    receiptLogs: { data: Hex; topics: Hex[]; address: Address }[];
    eventName: string;
  }): Array<Record<string, unknown>>;
}

/** Returns true if the error is a transient RPC error that should be retried. */
export function isTransientError(err: unknown): boolean {
  if (err instanceof BaseError) {
    if (err.name === "HttpRequestError") return true;
    if (err.name === "RpcRequestError") {
      const code = (err as any)?.code;
      // -32005 = rate limit, -32603 = internal error
      if (code === -32005 || code === -32603) return true;
    }
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createTxPipeline(opts?: { journal?: JournalSink; config?: TxPipelineConfig }): TxPipeline {
  const journal = opts?.journal;
  const cfg = { ...DEFAULT_CONFIG, ...opts?.config };

  // Simple RPC throttle: track last call timestamp
  let lastCallAt = 0;

  async function throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - lastCallAt;
    if (elapsed < cfg.minIntervalMs) {
      await sleep(cfg.minIntervalMs - elapsed);
    }
    lastCallAt = Date.now();
  }

  async function waitReceipt(publicClient: PublicClient, txHash: Hex): Promise<{
    blockNumber: bigint;
    status: "success" | "reverted";
    logs: any[];
  }> {
    await throttle();

    // Race the receipt against a timeout
    const receiptPromise = publicClient.waitForTransactionReceipt({ hash: txHash });

    if (cfg.receiptTimeoutMs <= 0) {
      return receiptPromise as Promise<{ blockNumber: bigint; status: "success" | "reverted"; logs: any[] }>;
    }

    const timeoutPromise = sleep(cfg.receiptTimeoutMs).then(() => {
      throw Object.assign(new Error(`Transaction receipt timeout after ${cfg.receiptTimeoutMs}ms`), {
        name: "TxTimeoutError",
      });
    });

    return Promise.race([receiptPromise, timeoutPromise]) as Promise<{
      blockNumber: bigint;
      status: "success" | "reverted";
      logs: any[];
    }>;
  }

  function makeTxTimeoutError(): DomainError {
    return {
      code: "TX_TIMEOUT",
      message: `Transaction was not confirmed within ${Math.round(cfg.receiptTimeoutMs / 1000)}s. It may still confirm later.`,
      severity: "warning",
      retryable: true,
    };
  }

  async function simulateAndWrite(params: {
    chainId: number;
    releaseDigest: string;
    action: string;
    publicClient: PublicClient;
    walletClient: WalletClient;
    account: Address;
    address: Address;
    abi: Abi;
    functionName: string;
    args: readonly unknown[];
    value?: bigint;
  }): Promise<TxResult> {
    // Simulate with retry on transient errors
    let sim: any;
    let lastError: unknown;
    for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
      try {
        await throttle();
        sim = await params.publicClient.simulateContract({
          account: params.account,
          address: params.address,
          abi: params.abi,
          functionName: params.functionName as any,
          args: params.args as any,
          value: params.value
        });
        break; // success
      } catch (e) {
        lastError = e;
        if (attempt < cfg.maxRetries && isTransientError(e)) {
          await sleep(cfg.retryDelayMs);
          continue;
        }
        // Non-transient or last attempt — fail
        const error = toDomainError(e);
        const txHash = "0x0" as Hex;
        journal?.({
          chainId: params.chainId,
          releaseDigest: params.releaseDigest,
          action: params.action,
          txHash,
          status: "failed",
          ok: false,
          createdAt: Date.now(),
          errorCode: error.code
        });
        return { txHash, ok: false, error };
      }
    }

    if (!sim) {
      // Should not happen, but guard
      const error = toDomainError(lastError);
      return { txHash: "0x0" as Hex, ok: false, error };
    }

    try {
      await throttle();
      const txHash = await params.walletClient.writeContract(sim.request);

      journal?.({
        chainId: params.chainId,
        releaseDigest: params.releaseDigest,
        action: params.action,
        txHash,
        status: "submitted",
        ok: true,
        createdAt: Date.now()
      });

      const receipt = await waitReceipt(params.publicClient, txHash);

      // Check for on-chain revert (simulation can pass but execution may revert
      // if state changes between simulation and mining)
      if (receipt.status === "reverted") {
        const error: DomainError = {
          code: "TX_REVERTED",
          message: "Transaction was mined but reverted on-chain. Gas was consumed but the operation had no effect.",
          severity: "error",
        };
        journal?.({
          chainId: params.chainId,
          releaseDigest: params.releaseDigest,
          action: params.action,
          txHash,
          status: "failed",
          ok: false,
          createdAt: Date.now(),
          minedAt: Date.now(),
          blockNumber: Number(receipt.blockNumber),
          errorCode: error.code,
        });
        return { txHash, ok: false, error };
      }

      const res: TxResult = { txHash, ok: true };
      journal?.({
        chainId: params.chainId,
        releaseDigest: params.releaseDigest,
        action: params.action,
        txHash,
        status: "mined",
        ok: true,
        createdAt: Date.now(),
        minedAt: Date.now(),
        blockNumber: Number(receipt.blockNumber)
      });
      return res;
    } catch (e) {
      const isTimeout = (e as any)?.name === "TxTimeoutError";
      const error = isTimeout ? makeTxTimeoutError() : toDomainError(e);
      const txHash = "0x0" as Hex;
      journal?.({
        chainId: params.chainId,
        releaseDigest: params.releaseDigest,
        action: params.action,
        txHash,
        status: isTimeout ? "timeout" : "failed",
        ok: false,
        createdAt: Date.now(),
        errorCode: error.code
      });
      return { txHash, ok: false, error };
    }
  }

  async function writeNoSimulate(params: {
    chainId: number;
    releaseDigest: string;
    action: string;
    publicClient: PublicClient;
    walletClient: WalletClient;
    address: Address;
    abi: Abi;
    functionName: string;
    args: readonly unknown[];
    value?: bigint;
  }): Promise<TxResult> {
    try {
      await throttle();
      const txHash = await params.walletClient.writeContract({
        chain: params.walletClient.chain,
        account: params.walletClient.account!,
        address: params.address,
        abi: params.abi,
        functionName: params.functionName as any,
        args: params.args as any,
        value: params.value
      });
      journal?.({
        chainId: params.chainId,
        releaseDigest: params.releaseDigest,
        action: params.action,
        txHash,
        status: "submitted",
        ok: true,
        createdAt: Date.now()
      });

      const receipt = await waitReceipt(params.publicClient, txHash);

      // Check for on-chain revert
      if (receipt.status === "reverted") {
        const error: DomainError = {
          code: "TX_REVERTED",
          message: "Transaction was mined but reverted on-chain. Gas was consumed but the operation had no effect.",
          severity: "error",
        };
        journal?.({
          chainId: params.chainId,
          releaseDigest: params.releaseDigest,
          action: params.action,
          txHash,
          status: "failed",
          ok: false,
          createdAt: Date.now(),
          minedAt: Date.now(),
          blockNumber: Number(receipt.blockNumber),
          errorCode: error.code,
        });
        return { txHash, ok: false, error };
      }

      journal?.({
        chainId: params.chainId,
        releaseDigest: params.releaseDigest,
        action: params.action,
        txHash,
        status: "mined",
        ok: true,
        createdAt: Date.now(),
        minedAt: Date.now(),
        blockNumber: Number(receipt.blockNumber)
      });
      return { txHash, ok: true };
    } catch (e) {
      const isTimeout = (e as any)?.name === "TxTimeoutError";
      const error = isTimeout ? makeTxTimeoutError() : toDomainError(e);
      const txHash = "0x0" as Hex;
      journal?.({
        chainId: params.chainId,
        releaseDigest: params.releaseDigest,
        action: params.action,
        txHash,
        status: isTimeout ? "timeout" : "failed",
        ok: false,
        createdAt: Date.now(),
        errorCode: error.code
      });
      return { txHash, ok: false, error };
    }
  }

  function extractEventArgs(params: {
    abi: Abi;
    receiptLogs: { data: Hex; topics: Hex[]; address: Address }[];
    eventName: string;
  }): Array<Record<string, unknown>> {
    const decoded = parseEventLogs({
      abi: params.abi,
      logs: params.receiptLogs as any,
      eventName: params.eventName as any
    });
    return decoded.map((l) => (l as any).args as Record<string, unknown>);
  }

  return { simulateAndWrite, writeNoSimulate, extractEventArgs };
}
