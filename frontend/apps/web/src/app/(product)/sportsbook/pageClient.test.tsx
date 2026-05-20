import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

function createSportsHubMock() {
  return {
    getNextMarketId: vi.fn().mockResolvedValue(8n),
    getNextTicketId: vi.fn().mockResolvedValue(13n),
    getMarket: vi.fn().mockImplementation(async (marketId: bigint) => ({
      marketId,
      eventId: 90n + marketId,
      poolId: 2,
      outcomeCount: 3,
      // most fixtures live in the past so they bucket as "Recently settled"
      // unless we explicitly set a future timestamp; one fixture (id 7) sits
      // far enough in the future to land in the "Upcoming" bucket.
      startsAt: marketId === 7n ? Math.floor(Date.now() / 1000) + 7 * 86400 : 1_700_000_000,
      lockTime: 1_700_003_600,
      resultFinalitySeconds: 604_800,
      version: 1n,
      marketKey: `0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa${marketId
        .toString(16)
        .padStart(2, "0")}`,
      rulebookHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      state: marketId === 7n ? "open" : "resolved"
    }))
  };
}

const state: {
  release: unknown;
  readOnly: boolean;
  readOnlyReason: string | null;
  sportsbook: {
    enabled: boolean;
    frontendEnabled: boolean;
    hasSportsRelease: boolean;
    enablementFlag: string;
    disabledReason?: string;
  };
  sdk: { sportsHub: ReturnType<typeof createSportsHubMock> } | undefined;
} = {
  release: {
    chainId: 84532,
    name: "Base Sepolia",
    releaseDigest: "0x7ad0f2cb1a996251325c00441b125ca5276c5bf70f011577222ce588cae1349f",
    contracts: { sportsHub: "0x2db4ba326c2c3e5830b0da10f0c52b4097f9fa4b" },
    sports: { enabled: true },
    pools: []
  },
  readOnly: false,
  readOnlyReason: null,
  sportsbook: {
    enabled: false,
    frontendEnabled: false,
    hasSportsRelease: true,
    enablementFlag: "NEXT_PUBLIC_SPORTSBOOK_ENABLED",
    disabledReason: "NEXT_PUBLIC_SPORTSBOOK_ENABLED is not true."
  },
  sdk: { sportsHub: createSportsHubMock() }
};

vi.mock("../../../ssot/release/ReleaseProvider", () => ({
  useRelease: () => ({
    release: state.release,
    readOnly: state.readOnly,
    readOnlyReason: state.readOnlyReason,
    sportsbook: state.sportsbook
  })
}));

vi.mock("../../../ssot/sdk", () => ({
  useSSOTSDK: () => ({ sdk: state.sdk, ready: Boolean(state.sdk), readOnly: state.readOnly })
}));

vi.mock("../../../components/PageTransition", () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("@ssot/ui", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ")
}));

vi.mock("../../../features/sportsbook/use-provider-odds", () => ({
  useSportsbookProviderOdds: () => ({ data: undefined, isLoading: false, error: null })
}));

vi.mock("next-intl", async () => {
  const messages = (await import("../../../i18n/locales/en/common.json")).default as Record<
    string,
    unknown
  >;
  function resolveMessage(key: string) {
    return key.split(".").reduce<unknown>((node, segment) => {
      if (node && typeof node === "object" && segment in node) {
        return (node as Record<string, unknown>)[segment];
      }
      return undefined;
    }, messages);
  }
  function translate(scope: string | undefined = "") {
    return (key: string, values?: Record<string, string | number>) => {
      const full = scope ? `${scope}.${key}` : key;
      const resolved = resolveMessage(full);
      let message = typeof resolved === "string" ? resolved : full;
      for (const [name, value] of Object.entries(values ?? {})) {
        message = message.replace(`{${name}}`, String(value));
      }
      return message;
    };
  }
  return {
    useTranslations: (scope?: string) => translate(scope),
    useLocale: () => "en"
  };
});

import { SportsbookPageClient } from "./pageClient";

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function resetSportsbookFlag() {
  state.sportsbook = {
    enabled: false,
    frontendEnabled: false,
    hasSportsRelease: true,
    enablementFlag: "NEXT_PUBLIC_SPORTSBOOK_ENABLED",
    disabledReason: "NEXT_PUBLIC_SPORTSBOOK_ENABLED is not true."
  };
  state.sdk = { sportsHub: createSportsHubMock() };
}

describe("SportsbookPageClient (player-facing)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    resetSportsbookFlag();
  });

  it("renders the public sportsbook header with a status pill", () => {
    renderWithQueryClient(<SportsbookPageClient />);
    expect(screen.getByRole("heading", { name: "Sportsbook" })).toBeDefined();
    // status pill reflects preview mode while the flag is off
    expect(screen.getByText("Preview only")).toBeDefined();
  });

  it("keeps operator console links off the public sportsbook header", () => {
    renderWithQueryClient(<SportsbookPageClient />);
    const opsLinks = screen
      .queryAllByRole("link")
      .filter((node) => node.getAttribute("href") === "/ops/sportsbook");
    expect(opsLinks).toHaveLength(0);
  });

  it("shows the preview empty state when public tickets are disabled", () => {
    renderWithQueryClient(<SportsbookPageClient />);
    expect(screen.getByText("Sportsbook is in preview")).toBeDefined();
  });

  it("does NOT render market id / ticket id inspectors anywhere on the public page", () => {
    renderWithQueryClient(<SportsbookPageClient />);
    expect(screen.queryByLabelText("Market id")).toBeNull();
    expect(screen.queryByLabelText("Ticket id")).toBeNull();
    expect(screen.queryByText("Operator writes")).toBeNull();
    expect(screen.queryByText("Top-level SportsHub limits")).toBeNull();
  });

  it("loads bucketed events when sportsbook is enabled", async () => {
    state.sportsbook = {
      ...state.sportsbook,
      enabled: true,
      frontendEnabled: true,
      disabledReason: undefined
    };
    renderWithQueryClient(<SportsbookPageClient />);
    // Header status flips to "Tickets live"
    expect(screen.getByText("Tickets live")).toBeDefined();
    // Lobby context and board render because at least one fixture sits in the future.
    expect(await screen.findByText("Featured market")).toBeDefined();
    expect(screen.getByText("Market board")).toBeDefined();
    expect(screen.getByRole("tab", { name: /All/i })).toBeDefined();
    expect(screen.getAllByText("Upcoming").length).toBeGreaterThan(0);
    // Past bucket is hidden on the board by default; that's the intended
    // public behavior — past events do not crowd the live + upcoming feed.
    expect(screen.queryByText("Recently settled")).toBeNull();
  });
});
