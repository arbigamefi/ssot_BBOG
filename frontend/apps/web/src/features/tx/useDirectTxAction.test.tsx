import * as React from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TxJournalRow } from "@ssot/ssot/indexer";

const data = vi.hoisted(() => ({ rows: [] as TxJournalRow[] }));
vi.mock("../../ssot/release/ReleaseProvider", () => ({ useRelease: () => ({ chainId: 84532 }) }));
vi.mock("../../ssot/runtime", () => ({
  useSSOTRuntime: () => ({
    db: {
      txJournal: {
        where: () => ({
          aboveOrEqual: (time: number) => ({
            toArray: async () => data.rows.filter((row) => row.createdAt >= time)
          })
        }),
        orderBy: () => ({
          reverse: () => ({ limit: () => ({ toArray: async () => [...data.rows].reverse() }) })
        })
      }
    }
  })
}));
import { useDirectTxAction, useSequencedTxAction } from "./useDirectTxAction";

let client: QueryClient;
const hash = `0x${"1".repeat(64)}` as const;
const success = { ok: true as const, txHash: hash };
function row(action: string, status: "mined" | "failed", createdAt = Date.now()) {
  return { chainId: 84532, action, status, createdAt, txHash: hash } as TxJournalRow;
}
function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
function useSequence() {
  return useSequencedTxAction({
    finalAction: "DEPOSIT",
    steps: [
      { key: "approve", title: "Approve", action: "APPROVE_DEPOSIT", optional: true },
      { key: "deposit", title: "Deposit", action: "DEPOSIT" }
    ]
  });
}
beforeEach(() => {
  data.rows = [];
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  cleanup();
  client.clear();
});

describe("transaction execution identity", () => {
  it("does not revive a failed sequence when the successful approval arrives later", async () => {
    const { result } = renderHook(useSequence, { wrapper: Wrapper });
    await act(async () => {
      await result.current.execute(async () => ({
        ok: false,
        txHash: hash,
        error: {
          code: "ALLOWANCE_NOT_CONFIRMED",
          message: "Allowance unavailable",
          severity: "error"
        }
      }));
    });
    data.rows = [row("APPROVE_DEPOSIT", "mined")];
    await act(() => client.invalidateQueries());
    await waitFor(() => expect(result.current.journalRows).toHaveLength(1));
    expect(result.current.status).toBe("failed");
    expect(result.current.busy).toBe(false);
  });
  it("excludes a recent previous failed deposit while the new sequence is pending", async () => {
    data.rows = [row("DEPOSIT", "failed", Date.now() - 1000)];
    const { result } = renderHook(useSequence, { wrapper: Wrapper });
    let finish!: (value: typeof success) => void;
    let pending!: Promise<typeof success>;
    act(() => {
      pending = result.current.execute(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          })
      );
    });
    await act(() => client.invalidateQueries());
    expect(result.current.journalRows).toHaveLength(0);
    expect(result.current.status).toBe("planning");
    await act(async () => {
      finish(success);
      await pending;
    });
    expect(result.current.status).toBe("mined");
  });
  it("does not downgrade a completed sequence from a late partial journal snapshot", async () => {
    const { result } = renderHook(useSequence, { wrapper: Wrapper });
    await act(async () => {
      await result.current.execute(async () => success);
    });
    data.rows = [row("APPROVE_DEPOSIT", "mined")];
    await act(() => client.invalidateQueries());
    await waitFor(() => expect(result.current.journalRows).toHaveLength(1));
    expect(result.current.status).toBe("mined");
    expect(result.current.busy).toBe(false);
  });
  it("excludes the previous withdrawal from a fresh direct action", async () => {
    data.rows = [row("WITHDRAW", "failed", Date.now() - 1000)];
    const { result } = renderHook(
      () =>
        useDirectTxAction({
          action: "WITHDRAW",
          labels: { preflight: "Check", submit: "Sign", confirm: "Confirm" }
        }),
      { wrapper: Wrapper }
    );
    await act(async () => {
      await result.current.execute(async () => success);
    });
    await act(() => client.invalidateQueries());
    await waitFor(() => expect(result.current.journalEntry).toBeNull());
    expect(result.current.status).toBe("mined");
  });
});
