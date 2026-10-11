"use client";

import { useQuery } from "@tanstack/react-query";

import { useRelease } from "../../ssot/release/ReleaseProvider";
import type {
  GovernanceOperationView,
  GovernanceQueueResponse,
  OpsGovernanceResponse
} from "./types";

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return (await response.json()) as T;
}

/** Waiting and ready timelock operations of the active chain, refreshed every minute. */
export function useGovernanceQueue() {
  const { chainId } = useRelease();
  return useQuery({
    queryKey: ["governance", "queue", chainId],
    queryFn: () => getJson<GovernanceQueueResponse>(`/api/governance/queue?chainId=${chainId}`),
    refetchInterval: 60_000,
    staleTime: 30_000
  });
}

export function useOpsGovernance() {
  const { chainId } = useRelease();
  return useQuery({
    queryKey: ["governance", "ops", chainId],
    queryFn: () => getJson<OpsGovernanceResponse>(`/api/ops/governance?chainId=${chainId}`),
    refetchInterval: 60_000,
    staleTime: 30_000
  });
}

/** Calls of one scheduled operation (a batch has several), in schedule order. */
export function groupOperations(operations: readonly GovernanceOperationView[]) {
  const groups: { operationId: string; calls: GovernanceOperationView[] }[] = [];
  for (const operation of operations) {
    const group = groups.find((item) => item.operationId === operation.operationId);
    if (group) group.calls.push(operation);
    else groups.push({ operationId: operation.operationId, calls: [operation] });
  }
  for (const group of groups) group.calls.sort((a, b) => a.index - b.index);
  return groups;
}
