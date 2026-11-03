import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const state = vi.hoisted(() => ({
  bets: { data: [] as unknown[], isPending: false, isError: false }
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams()
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key
}));

vi.mock("../../../ssot/release/ReleaseProvider", () => ({
  useRelease: () => ({
    chainId: 84532,
    readOnlyReason: null,
    release: {
      chainId: 84532,
      contracts: { gameHub: "0x1234567890abcdef1234567890abcdef12345678" },
      assets: [
        {
          symbol: "USDC",
          decimals: 6,
          address: "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
          bank: "0x49b9dc94d98c3d78224ca37abf05ec09af7c50ff"
        }
      ],
      pools: [
        {
          asset: "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
          bank: "0x49b9dc94d98c3d78224ca37abf05ec09af7c50ff",
          decimals: 6,
          domain: "Casino",
          domainId: 1,
          poolId: 1,
          symbol: "USDC"
        }
      ],
      gamesMeta: [
        {
          gameId: "0x8d8e6987fb3617c00abdd68d6c1f7eac28b7f9f96b25367e9b65dacaa0914a8b",
          slug: "dice",
          label: "Dice",
          module: "0x8fb66ccc25d07b252d282be646d24444c062c667"
        }
      ]
    }
  })
}));

vi.mock("../../../ssot/sdk", () => ({
  useSSOTSDK: () => ({ sdk: null, wrongNetwork: false, switchNetwork: undefined })
}));

vi.mock("../../../ssot/runtime", () => ({
  useSSOTRuntime: () => ({ db: null })
}));

vi.mock("../../betting/useRecentBets", () => ({
  useRecentBets: () => ({ ...state.bets, refetch: vi.fn() })
}));

import { useGameRoom } from "./use-game-room";

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {children}
    </QueryClientProvider>
  );
}

describe("useGameRoom", () => {
  afterEach(() => {
    cleanup();
    state.bets = { data: [], isPending: false, isError: false };
  });

  it("opens the dice room at one round of 1 USDC, low under 50", () => {
    const { result } = renderHook(() => useGameRoom("dice"), { wrapper });
    expect(result.current.game?.slug).toBe("dice");
    expect(result.current.assetSymbol).toBe("USDC");
    expect(result.current.assetDecimals).toBe(6);
    expect(result.current.betAmount).toBe("1");
    expect(result.current.betCount).toBe(1);
    expect(result.current.diceDirection).toBe("under");
    expect(result.current.diceTarget).toBe(50);
    expect(result.current.winChance).toBe(50);
    expect(result.current.isBetPanelPending).toBe(false);
    expect(result.current.showResult).toBe(false);
  });

  it("keeps the dice line inside the 2–97% win chance for either side", () => {
    const { result } = renderHook(() => useGameRoom("dice"), { wrapper });
    act(() => result.current.changeDiceTarget(1));
    expect(result.current.diceTarget).toBe(2);
    act(() => result.current.changeDiceTarget(120));
    expect(result.current.diceTarget).toBe(97);
    act(() => result.current.changeDiceDirection("over"));
    expect(result.current.diceDirection).toBe("over");
    expect(result.current.diceTarget).toBe(97);
    act(() => result.current.changeDiceTarget(1));
    expect(result.current.diceTarget).toBe(3);
    expect(result.current.winChance).toBe(97);
  });

  it("reports how the recent bets read went", () => {
    state.bets = { data: [], isPending: true, isError: false };
    const { result, rerender } = renderHook(() => useGameRoom("dice"), { wrapper });
    expect(result.current.recentBetsStatus).toBe("loading");
    state.bets = { data: [], isPending: false, isError: true };
    rerender();
    expect(result.current.recentBetsStatus).toBe("error");
  });

  it("finds no game for a slug the release does not carry", () => {
    const { result } = renderHook(() => useGameRoom("keno"), { wrapper });
    expect(result.current.game).toBeNull();
  });
});
