vi.mock("@ssot/ssot/release", async () => {
  const actual = await vi.importActual<typeof import("@ssot/ssot/release")>("@ssot/ssot/release");
  const { createReleaseModuleMock } = await import("../../test/current-release");
  return { ...actual, ...createReleaseModuleMock() };
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { createCurrentRelease } from "../../test/current-release";
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

import { ReleaseProvider, resolveSportsbookAccess, useRelease } from "./ReleaseProvider";

const BASE_RELEASE = createCurrentRelease(84532);

describe("resolveSportsbookAccess", () => {
  it("keeps sportsbook entry disabled by default", () => {
    const access = resolveSportsbookAccess(
      {
        ...BASE_RELEASE,
        contracts: {
          ...BASE_RELEASE.contracts,
          sportsHub: "0x6666666666666666666666666666666666666666"
        },
        sports: {
          enabled: true,
          sportsHub: "0x6666666666666666666666666666666666666666",
          riskEngine: "0x7777777777777777777777777777777777777777",
          oddsSignerSetHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          resultReporterSetHash:
            "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          resultReporterThreshold: "1",
          resultChallengeTimeoutSeconds: "604800",
          resultChallenger: "0x8888888888888888888888888888888888888888",
          resultArbitrator: "0x9999999999999999999999999999999999999999",
          maxStake: "1000000",
          maxPayout: "2000000",
          maxMarketReserved: "3000000",
          maxOutcomeReserved: "4000000",
          maxEventReserved: "5000000"
        }
      },
      undefined
    );

    expect(access.enabled).toBe(false);
    expect(access.frontendEnabled).toBe(false);
    expect(access.hasSportsRelease).toBe(true);
    expect(access.disabledReason).toContain("NEXT_PUBLIC_SPORTSBOOK_ENABLED");
  });

  it("requires enabled SportsHub metadata even when the frontend flag is true", () => {
    const access = resolveSportsbookAccess(BASE_RELEASE, "true");

    expect(access.enabled).toBe(false);
    expect(access.frontendEnabled).toBe(true);
    expect(access.hasSportsRelease).toBe(false);
    expect(access.disabledReason).toContain("SportsHub metadata");
  });

  it("enables sportsbook entry only when both the flag and release metadata are present", () => {
    const access = resolveSportsbookAccess(
      {
        ...BASE_RELEASE,
        sports: {
          enabled: true,
          sportsHub: "0x6666666666666666666666666666666666666666",
          riskEngine: "0x7777777777777777777777777777777777777777",
          oddsSignerSetHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          resultReporterSetHash:
            "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          resultReporterThreshold: "1",
          maxStake: "1000000",
          maxPayout: "2000000",
          maxMarketReserved: "3000000",
          maxOutcomeReserved: "4000000",
          maxEventReserved: "5000000"
        }
      },
      "true"
    );

    expect(access.enabled).toBe(true);
    expect(access.frontendEnabled).toBe(true);
    expect(access.hasSportsRelease).toBe(true);
    expect(access.disabledReason).toBeUndefined();
  });
});

function ReleaseProbe() {
  const release = useRelease();
  return (
    <div>
      <span data-testid="chain-id">{release.chainId}</span>
      <span data-testid="read-only">{String(release.readOnly)}</span>
      <span data-testid="release-read-only">{String(release.releaseReadOnly)}</span>
      <span data-testid="wallet-mismatch">{String(release.walletChainMismatch)}</span>
      <span data-testid="reason">{release.readOnlyReason ?? ""}</span>
    </div>
  );
}

describe("ReleaseProvider", () => {
  afterEach(cleanup);

  it("keeps an unregistered chain read-only without claiming a deployment exists", () => {
    render(
      <ReleaseProvider chainId={99999}>
        <ReleaseProbe />
      </ReleaseProvider>
    );
    expect(screen.getByTestId("read-only").textContent).toBe("true");
    expect(screen.getByTestId("release-read-only").textContent).toBe("true");
    expect(screen.getByTestId("reason").textContent).toContain(
      "No embedded release for chainId=99999"
    );
  });

  it("keeps reads available while blocking writes on wallet chain mismatch", () => {
    render(
      <ReleaseProvider chainId={84532} selectedChainName="Base Sepolia" walletChainId={8453}>
        <ReleaseProbe />
      </ReleaseProvider>
    );

    expect(screen.getByTestId("chain-id").textContent).toBe("84532");
    expect(screen.getByTestId("read-only").textContent).toBe("true");
    expect(screen.getByTestId("release-read-only").textContent).toBe("false");
    expect(screen.getByTestId("wallet-mismatch").textContent).toBe("true");
    expect(screen.getByTestId("reason").textContent).toContain("Base Sepolia");
  });
});
