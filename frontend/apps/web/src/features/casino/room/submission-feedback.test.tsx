import * as React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BetSubmissionFeedback } from "./submission-feedback";
import zh from "../../../i18n/locales/zh-Hans/common.json";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    key.split(".").reduce((value: any, part) => value[part], zh)
}));

describe("approval transition feedback", () => {
  it("shows the mined approval separately from a bet that was never sent", () => {
    const approvalTxHash = `0x${"ab".repeat(32)}`;
    render(
      <BetSubmissionFeedback
        error={{
          code: "ALLOWANCE_NOT_CONFIRMED",
          details: { chainId: 84532, transactionSubmitted: false, approvalTxHash }
        }}
      />
    );
    expect(screen.getByRole("alert").textContent).toContain("投注尚未发送");
    expect(screen.getByRole("link", { name: "查看授权交易" }).getAttribute("href")).toBe(
      `https://sepolia.basescan.org/tx/${approvalTxHash}`
    );
    expect(screen.queryByRole("button", { name: "检查交易状态" })).toBeNull();
  });
});
