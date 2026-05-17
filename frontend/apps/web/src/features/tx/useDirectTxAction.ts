"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import type { DomainError, TxResult } from "@ssot/ssot";
import type { TxJournalRow } from "@ssot/ssot/indexer";
import type { StepState, TxStepItem, TxStatus } from "@ssot/ui";

import { useRelease } from "../../ssot/release/ReleaseProvider";
import { useSSOTRuntime } from "../../ssot/runtime";

type DirectTxLabels = {
  preflight: string;
  submit: string;
  confirm: string;
};

type DirectTxDescriptions = {
  preflight?: string;
  submit?: string;
  confirm?: string;
};

type DirectTxActionOptions = {
  action: string;
  labels: DirectTxLabels;
  descriptions?: DirectTxDescriptions;
  errorMessage?: string;
};

type SequencedTxStepConfig = {
  key: string;
  title: string;
  description?: string;
  action?: string;
  optional?: boolean;
};

type SequencedTxActionOptions = {
  steps: SequencedTxStepConfig[];
  finalAction: string;
  matchWindowMs?: number;
  errorMessage?: string;
};

type DirectTxState = {
  status: TxStatus;
  startedAt?: number;
  txHash?: `0x${string}`;
  error?: DomainError;
};

const ZERO_HASH = "0x0";

function isMeaningfulHash(value?: string) {
  return Boolean(value && value !== ZERO_HASH);
}

function mapJournalStatus(status: TxJournalRow["status"]): TxStatus {
  switch (status) {
    case "submitted":
      return "submitting";
    case "mined":
      return "mined";
    case "failed":
    case "timeout":
      return "failed";
    default:
      return "idle";
  }
}

function buildSteps(
  status: TxStatus,
  labels: DirectTxLabels,
  descriptions?: DirectTxDescriptions,
  txHash?: string
): TxStepItem[] {
  const hasSubmittedTx = isMeaningfulHash(txHash);

  const preflightState: StepState =
    status === "idle"
      ? "todo"
      : status === "planning"
        ? "active"
        : status === "failed" && !hasSubmittedTx
          ? "error"
          : "done";

  const submitState: StepState =
    status === "idle" || status === "planning"
      ? "todo"
      : status === "submitting"
        ? "active"
        : status === "failed"
          ? hasSubmittedTx
            ? "done"
            : "todo"
          : "done";

  const confirmState: StepState =
    status === "mined"
      ? "done"
      : status === "failed"
        ? hasSubmittedTx
          ? "error"
          : "todo"
        : status === "submitting" && hasSubmittedTx
          ? "active"
          : "todo";

  return [
    {
      title: labels.preflight,
      description: descriptions?.preflight,
      state: preflightState
    },
    {
      title: labels.submit,
      description: descriptions?.submit,
      state: submitState
    },
    {
      title: labels.confirm,
      description: descriptions?.confirm,
      state: confirmState
    }
  ];
}

function toDomainError(error: unknown, fallbackMessage = "Transaction failed"): DomainError {
  if (typeof error === "object" && error && "message" in error) {
    return {
      code: "UNKNOWN_TX_ERROR",
      message: String((error as { message?: unknown }).message ?? fallbackMessage),
      severity: "error"
    };
  }
  return {
    code: "UNKNOWN_TX_ERROR",
    message: fallbackMessage,
    severity: "error"
  };
}

function sortRowsByCreatedAt(rows: TxJournalRow[]) {
  return [...rows].sort((a, b) => a.createdAt - b.createdAt);
}

function findLatestRow(rows: TxJournalRow[], action: string) {
  const filtered = rows.filter((row) => row.action === action);
  return filtered.length > 0 ? filtered[filtered.length - 1] : undefined;
}

function buildSequencedSteps(
  status: TxStatus,
  stepConfigs: SequencedTxStepConfig[],
  journalRows: TxJournalRow[]
): TxStepItem[] {
  const orderedRows = sortRowsByCreatedAt(journalRows);

  return stepConfigs.map((step, index) => {
    if (!step.action) {
      const preflightState: StepState =
        status === "idle"
          ? "todo"
          : status === "planning"
            ? "active"
            : status === "failed" && orderedRows.length === 0
              ? "error"
              : "done";
      return {
        title: step.title,
        description: step.description,
        state: preflightState
      };
    }

    const row = findLatestRow(orderedRows, step.action);
    if (row) {
      const state: StepState =
        row.status === "failed" || row.status === "timeout"
          ? "error"
          : row.status === "submitted"
            ? "active"
            : "done";
      return {
        title: step.title,
        description: step.description,
        state
      };
    }

    const laterRowsExist = stepConfigs
      .slice(index + 1)
      .some(
        (candidate) =>
          candidate.action && orderedRows.some((rowItem) => rowItem.action === candidate.action)
      );

    if (step.optional && laterRowsExist) {
      return {
        title: step.title,
        description: step.description,
        state: "done"
      };
    }

    return {
      title: step.title,
      description: step.description,
      state: "todo"
    };
  });
}

function deriveSequencedStatus(
  currentStatus: TxStatus,
  journalRows: TxJournalRow[],
  finalAction: string
): TxStatus {
  const orderedRows = sortRowsByCreatedAt(journalRows);
  if (orderedRows.some((row) => row.status === "failed" || row.status === "timeout")) {
    return "failed";
  }
  const finalRow = findLatestRow(orderedRows, finalAction);
  if (finalRow?.status === "mined") {
    return "mined";
  }
  if (finalRow?.status === "submitted") {
    return "submitting";
  }
  if (orderedRows.length > 0) {
    return "submitting";
  }
  return currentStatus;
}

export function useDirectTxAction({
  action,
  labels,
  descriptions,
  errorMessage
}: DirectTxActionOptions) {
  const { db } = useSSOTRuntime();
  const { chainId } = useRelease();
  const [state, setState] = React.useState<DirectTxState>({ status: "idle" });

  const { data: journalEntry } = useQuery({
    queryKey: ["ssot", "directTxAction", chainId, action, state.startedAt],
    enabled: Boolean(db && state.startedAt),
    queryFn: async (): Promise<TxJournalRow | null> => {
      const startedAt = state.startedAt;
      if (!db || !startedAt) return null;
      const rows = await db.txJournal.orderBy("createdAt").reverse().limit(100).toArray();
      return (
        rows.find(
          (row) =>
            row.chainId === chainId && row.action === action && row.createdAt >= startedAt - 2_000
        ) ?? null
      );
    },
    refetchInterval: state.status === "planning" || state.status === "submitting" ? 1_000 : false
  });

  React.useEffect(() => {
    if (!journalEntry) return;
    setState((current) => {
      const nextStatus = mapJournalStatus(journalEntry.status);
      const nextHash = isMeaningfulHash(journalEntry.txHash) ? journalEntry.txHash : current.txHash;
      if (
        current.status === nextStatus &&
        current.txHash === nextHash &&
        current.error === undefined
      ) {
        return current;
      }
      return {
        ...current,
        status: nextStatus,
        txHash: nextHash,
        error: nextStatus === "failed" && current.error ? current.error : current.error
      };
    });
  }, [journalEntry]);

  const execute = React.useCallback(
    async <T extends TxResult>(run: () => Promise<T>): Promise<T> => {
      const startedAt = Date.now();
      setState({ status: "planning", startedAt, error: undefined, txHash: undefined });
      try {
        const result = await run();
        setState((current) => ({
          ...current,
          status: result.ok ? "mined" : "failed",
          txHash: isMeaningfulHash(result.txHash) ? result.txHash : current.txHash,
          error: result.ok ? undefined : result.error
        }));
        return result;
      } catch (error) {
        const domainError = toDomainError(error, errorMessage);
        setState((current) => ({
          ...current,
          status: "failed",
          error: domainError
        }));
        return {
          ok: false,
          txHash: ZERO_HASH as `0x${string}`,
          error: domainError
        } as T;
      }
    },
    [errorMessage]
  );

  const reset = React.useCallback(() => {
    setState({ status: "idle" });
  }, []);

  return {
    status: state.status,
    error: state.error,
    txHash: state.txHash,
    journalEntry,
    hasActivity: state.status !== "idle" || Boolean(journalEntry),
    busy: state.status === "planning" || state.status === "submitting",
    execute,
    reset,
    steps: buildSteps(state.status, labels, descriptions, state.txHash ?? journalEntry?.txHash)
  };
}

export function useSequencedTxAction({
  steps,
  finalAction,
  matchWindowMs = 2_000,
  errorMessage
}: SequencedTxActionOptions) {
  const { db } = useSSOTRuntime();
  const { chainId } = useRelease();
  const [state, setState] = React.useState<DirectTxState>({ status: "idle" });

  const trackedActions = React.useMemo(
    () => steps.map((step) => step.action).filter((value): value is string => Boolean(value)),
    [steps]
  );

  const { data: journalRows = [] } = useQuery({
    queryKey: ["ssot", "sequencedTxAction", chainId, trackedActions.join(","), state.startedAt],
    enabled: Boolean(db && state.startedAt),
    queryFn: async (): Promise<TxJournalRow[]> => {
      const startedAt = state.startedAt;
      if (!db || !startedAt) return [];
      const rows = await db.txJournal
        .where("createdAt")
        .aboveOrEqual(startedAt - matchWindowMs)
        .toArray();
      return sortRowsByCreatedAt(
        rows.filter((row) => row.chainId === chainId && trackedActions.includes(row.action))
      );
    },
    refetchInterval: state.status === "planning" || state.status === "submitting" ? 1_000 : false
  });

  React.useEffect(() => {
    if (journalRows.length === 0) return;
    setState((current) => {
      const nextStatus = deriveSequencedStatus(current.status, journalRows, finalAction);
      const latestRow = journalRows[journalRows.length - 1];
      const nextHash =
        latestRow && isMeaningfulHash(latestRow.txHash) ? latestRow.txHash : current.txHash;
      if (
        current.status === nextStatus &&
        current.txHash === nextHash &&
        current.error === undefined
      ) {
        return current;
      }
      return {
        ...current,
        status: nextStatus,
        txHash: nextHash
      };
    });
  }, [finalAction, journalRows]);

  const execute = React.useCallback(
    async <T extends TxResult>(run: () => Promise<T>): Promise<T> => {
      const startedAt = Date.now();
      setState({ status: "planning", startedAt, error: undefined, txHash: undefined });
      try {
        const result = await run();
        setState((current) => ({
          ...current,
          status: result.ok ? "mined" : "failed",
          txHash: isMeaningfulHash(result.txHash) ? result.txHash : current.txHash,
          error: result.ok ? undefined : result.error
        }));
        return result;
      } catch (error) {
        const domainError = toDomainError(error, errorMessage);
        setState((current) => ({
          ...current,
          status: "failed",
          error: domainError
        }));
        return {
          ok: false,
          txHash: ZERO_HASH as `0x${string}`,
          error: domainError
        } as T;
      }
    },
    [errorMessage]
  );

  const reset = React.useCallback(() => {
    setState({ status: "idle" });
  }, []);

  const latestRow = journalRows[journalRows.length - 1];
  const latestRowHash =
    latestRow && isMeaningfulHash(latestRow.txHash) ? latestRow.txHash : undefined;

  return {
    status: state.status,
    error: state.error,
    txHash: state.txHash ?? latestRowHash,
    journalRows,
    journalEntry: latestRow,
    hasActivity: state.status !== "idle" || journalRows.length > 0,
    busy: state.status === "planning" || state.status === "submitting",
    execute,
    reset,
    steps: buildSequencedSteps(state.status, steps, journalRows)
  };
}
