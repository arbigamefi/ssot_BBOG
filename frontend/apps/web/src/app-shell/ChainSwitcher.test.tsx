import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as React from "react";

import { ActiveChainProvider, useActiveChain } from "./ActiveChainProvider";
import { ChainSwitcher } from "./ChainSwitcher";

vi.mock("@ssot/ui", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ")
}));

vi.mock("@heroicons/react/24/outline", () => ({
  ArrowsRightLeftIcon: ({ className }: { className?: string }) => (
    <svg aria-hidden="true" className={className} />
  ),
  CheckIcon: ({ className }: { className?: string }) => (
    <svg aria-hidden="true" className={className} />
  ),
  ChevronDownIcon: ({ className }: { className?: string }) => (
    <svg aria-hidden="true" className={className} />
  )
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    ({
      "network.label": "Network",
      "walletMenu.chainSection": "Network"
    })[key] ?? key
}));

function Probe() {
  const { selectedChainId } = useActiveChain();
  return <p data-testid="selected-chain">{selectedChainId}</p>;
}

function renderSwitcher(initialChainId = "8453") {
  return render(
    <ActiveChainProvider initialChainId={initialChainId}>
      <ChainSwitcher />
      <Probe />
    </ActiveChainProvider>
  );
}

describe("ChainSwitcher", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("opens the supported chain list and updates the active app chain", () => {
    renderSwitcher("8453");

    expect(screen.getByTestId("selected-chain").textContent).toBe("8453");
    fireEvent.click(screen.getByRole("button", { name: "Network" }));

    expect(screen.getByRole("radiogroup")).toBeDefined();
    expect(screen.getByRole("radio", { name: /Base Mainnet/i }).getAttribute("aria-checked")).toBe(
      "true"
    );

    fireEvent.click(screen.getByRole("radio", { name: /Base Sepolia/i }));

    expect(screen.getByTestId("selected-chain").textContent).toBe("84532");
    expect(screen.queryByRole("radiogroup")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Network" }));
    expect(screen.getByRole("radio", { name: /Base Sepolia/i }).getAttribute("aria-checked")).toBe(
      "true"
    );
  });
});
