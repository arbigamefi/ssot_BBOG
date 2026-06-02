"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        // A modest default so one-shot queries don't immediately refetch on
        // remount/refocus. Freshness-critical hooks (balances, bets, ledgers)
        // set their own refetchInterval/staleTime and override this.
        defaultOptions: { queries: { staleTime: 30_000 } }
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
