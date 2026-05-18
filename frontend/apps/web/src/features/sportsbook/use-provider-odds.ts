"use client";

import { useQuery } from "@tanstack/react-query";

import { isSportsbookProviderOdds, type SportsbookProviderOdds } from "./provider-odds";

export function useSportsbookProviderOdds({
  marketId,
  enabled
}: {
  marketId?: bigint;
  enabled: boolean;
}) {
  return useQuery({
    queryKey: ["sportsbook", "provider-odds", marketId?.toString() ?? "none"],
    enabled: enabled && marketId !== undefined,
    staleTime: 30_000,
    retry: false,
    queryFn: async (): Promise<SportsbookProviderOdds> => {
      if (marketId === undefined) {
        throw new Error("marketId is required.");
      }
      const response = await fetch(
        `/api/sportsbook/provider-odds?marketId=${encodeURIComponent(marketId.toString())}`,
        { cache: "no-store" }
      );
      const body = (await response.json()) as
        | SportsbookProviderOdds
        | { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(
          "error" in body && body.error?.message ? body.error.message : "Provider odds failed."
        );
      }
      if (!isSportsbookProviderOdds(body)) {
        throw new Error("Provider odds response is invalid.");
      }
      return body;
    }
  });
}
