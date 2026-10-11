import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";

import en from "../../../i18n/locales/en/common.json";
import zh from "../../../i18n/locales/zh-Hans/common.json";
import { PendingSettlementNotice } from "./pending-settlement-notice";

function withMessages(ui: React.ReactElement, locale: "en" | "zh-Hans" = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : zh}>
      {ui}
    </NextIntlClientProvider>
  );
}

afterEach(() => cleanup());

describe("bets awaiting settlement in the room (ADR-0037 §7)", () => {
  it("names each bet and links to its page, where the void lives", () => {
    withMessages(<PendingSettlementNotice betIds={[7n, 9n]} />);

    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent(
      "Bet #7 has its draw result but has not settled yet. You can keep playing;"
    );
    expect(notice).toHaveTextContent("Bet #9 has its draw result");
    const links = screen.getAllByRole("link", { name: "Open bet details" });
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/portfolio/activity/7",
      "/portfolio/activity/9"
    ]);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders nothing without such a bet, and reads in Chinese too", () => {
    const { container } = withMessages(<PendingSettlementNotice betIds={[]} />);
    expect(container).toBeEmptyDOMElement();
    cleanup();

    withMessages(<PendingSettlementNotice betIds={[7n]} />, "zh-Hans");
    expect(screen.getByRole("status")).toHaveTextContent("第 #7 号投注已有开奖结果");
    expect(screen.getByRole("link", { name: "查看投注详情" })).toHaveAttribute(
      "href",
      "/portfolio/activity/7"
    );
  });
});
