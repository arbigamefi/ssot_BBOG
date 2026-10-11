import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import en from "../../../i18n/locales/en/common.json";
import zh from "../../../i18n/locales/zh-Hans/common.json";
import { PlaceBetButton } from "./place-bet-button";
import { PoolStatusNotice } from "./submission-feedback";

vi.mock("@ssot/ui", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ")
}));

function withMessages(ui: React.ReactElement, locale: "en" | "zh-Hans" = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : zh}>
      {ui}
    </NextIntlClientProvider>
  );
}

afterEach(() => cleanup());

describe("per-player open-bet cap in the room (ADR-0037 §5)", () => {
  it("says how many bets are open and what to do, with a way to check again", () => {
    const refresh = vi.fn();
    withMessages(
      <PoolStatusNotice status="playerLimit" symbol="USDC" openBets={2} onRefresh={refresh} />
    );
    expect(
      screen.getByText("You have 2 open bets in this pool. Place the next one after one settles.")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "View your open bets" })).toHaveAttribute(
      "href",
      "/portfolio/activity"
    );
  });

  it("keeps submit disabled at the cap and names the reason on the button", () => {
    const onClick = vi.fn();
    withMessages(
      <PlaceBetButton
        gameSlug="dice"
        hasAccount
        isPending={false}
        winChance={50}
        state={{ status: "idle" }}
        poolAvailability="playerLimit"
        onClick={onClick}
      />
    );
    const button = screen.getByRole("button", { name: "Wait for a bet to settle" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("tells players an inactive pool takes no new bets", () => {
    withMessages(<PoolStatusNotice status="inactive" symbol="USDC" />);
    expect(
      screen.getByText(
        "The USDC pool is not taking new bets right now. Bets already placed still settle."
      )
    ).toBeInTheDocument();
  });

  it("formats the cap line in Chinese too", () => {
    withMessages(<PoolStatusNotice status="playerLimit" symbol="USDC" openBets={2} />, "zh-Hans");
    expect(screen.getByRole("status").textContent).toContain("2");
  });
});
