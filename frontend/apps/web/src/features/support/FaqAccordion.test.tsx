import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FaqAccordion } from "./FaqAccordion";

vi.mock("@ssot/ui", () => ({
  cn: (...v: Array<string | false | null | undefined>) => v.filter(Boolean).join(" ")
}));

vi.mock("@heroicons/react/24/outline", () => ({
  ChevronDownIcon: ({ className }: { className?: string }) => <svg className={className} />
}));

const ITEMS = [
  { q: "How do I start playing?", a: "Connect a wallet and pick a game." },
  { q: "What is house edge?", a: "Built-in margin shown per game." }
];

const STRINGS: Record<string, string> = {
  "faq.eyebrow": "Help center",
  "faq.title": "Help & FAQ",
  "faq.description": "Everything you need.",
  "contact.title": "Still need help?",
  "contact.description": "Reach the team.",
  "contact.discord": "Discord",
  "contact.email": "Email support",
  "contact.status": "System status",
  "contact.docs": "Docs"
};

// The hook is scoped to `support`. `t.raw("items")` must resolve the FAQ
// array (support.items) — NOT `t.raw("faq.items")`, which doesn't exist.
vi.mock("next-intl", () => ({
  useTranslations: () => {
    const t = (key: string) => STRINGS[key] ?? key;
    (t as unknown as { raw: (key: string) => unknown }).raw = (key: string) =>
      key === "items" ? ITEMS : undefined;
    return t;
  }
}));

describe("FaqAccordion", () => {
  afterEach(() => cleanup());

  it("renders FAQ items from support.items (correct key path)", () => {
    render(<FaqAccordion />);
    expect(screen.getByText("How do I start playing?")).toBeDefined();
    expect(screen.getByText("What is house edge?")).toBeDefined();
  });

  it("expands an item to reveal its answer", () => {
    render(<FaqAccordion />);
    // First item open by default; second collapsed.
    expect(screen.queryByText("Built-in margin shown per game.")).toBeNull();
    fireEvent.click(screen.getByText("What is house edge?"));
    expect(screen.getByText("Built-in margin shown per game.")).toBeDefined();
  });
});
