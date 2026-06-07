import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as React from "react";

import { LocaleSheetSwitcher, LocaleSwitcher } from "./LocaleSwitcher";

const mocks = vi.hoisted(() => ({
  locale: "en",
  refresh: vi.fn()
}));

vi.mock("@ssot/ui", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ")
}));

vi.mock("@heroicons/react/24/outline", () => ({
  CheckIcon: ({ className }: { className?: string }) => (
    <svg aria-hidden="true" className={className} />
  ),
  ChevronDownIcon: ({ className }: { className?: string }) => (
    <svg aria-hidden="true" className={className} />
  ),
  GlobeAltIcon: ({ className }: { className?: string }) => (
    <svg aria-hidden="true" className={className} />
  ),
  XMarkIcon: ({ className }: { className?: string }) => (
    <svg aria-hidden="true" className={className} />
  )
}));

vi.mock("next-intl", () => ({
  useLocale: () => mocks.locale,
  useTranslations: () => (key: string) =>
    ({
      label: "Language",
      "nav.closeMenu": "Close"
    })[key] ?? key
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mocks.refresh
  })
}));

describe("LocaleSwitcher", () => {
  afterEach(() => {
    cleanup();
    mocks.locale = "en";
    mocks.refresh.mockClear();
    document.cookie = "arbi-locale=; Path=/; Max-Age=0";
  });

  it("opens the shared popover menu and persists a selected locale", () => {
    render(<LocaleSwitcher compact />);

    fireEvent.click(screen.getByRole("button", { name: "Language" }));

    expect(screen.getByRole("menu", { name: "Language" })).toBeDefined();
    expect(
      screen.getByRole("menuitemradio", { name: /English/i }).getAttribute("aria-checked")
    ).toBe("true");

    fireEvent.click(screen.getByRole("menuitemradio", { name: /简体中文/i }));

    expect(document.cookie).toContain("arbi-locale=zh-Hans");
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu", { name: "Language" })).toBeNull();
  });

  it("uses the shared sheet interaction for the mobile language picker", () => {
    render(<LocaleSheetSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: "Language" }));

    expect(screen.getByRole("dialog", { name: "Language" })).toBeDefined();
    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.getByRole("radio", { name: /Português/i })).toBeDefined();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Language" })).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });
});
