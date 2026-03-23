import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

const state = {
  pathname: "/"
};

vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname
}));

vi.mock("./LandingShell", () => ({
  LandingShell: ({ children }: any) => <div data-testid="landing-shell">{children}</div>
}));

vi.mock("./RoomShell", () => ({
  RoomShell: ({ children }: any) => <div data-testid="room-shell">{children}</div>
}));

vi.mock("./TrustShell", () => ({
  TrustShell: ({ children }: any) => <div data-testid="trust-shell">{children}</div>
}));

import { SiteChrome } from "./SiteChrome";

describe("SiteChrome", () => {
  afterEach(() => {
    cleanup();
    state.pathname = "/";
  });

  it("uses landing shell on home route", () => {
    state.pathname = "/";
    render(
      <SiteChrome>
        <div>content</div>
      </SiteChrome>
    );

    expect(screen.getByTestId("landing-shell")).toBeDefined();
  });

  it("uses room shell on gameplay routes", () => {
    state.pathname = "/roulette";
    render(
      <SiteChrome>
        <div>content</div>
      </SiteChrome>
    );

    expect(screen.getByTestId("room-shell")).toBeDefined();
  });

  it("does not treat legacy compat room routes as canonical gameplay shells", () => {
    state.pathname = "/games/roulette";
    render(
      <SiteChrome>
        <div>content</div>
      </SiteChrome>
    );

    expect(screen.getByTestId("trust-shell")).toBeDefined();
    expect(screen.queryByTestId("room-shell")).toBeNull();
  });

  it("uses trust shell on trust routes", () => {
    state.pathname = "/bets";
    render(
      <SiteChrome>
        <div>content</div>
      </SiteChrome>
    );

    expect(screen.getByTestId("trust-shell")).toBeDefined();
  });

  it("bypasses chrome on prototype routes", () => {
    state.pathname = "/prototype/ui-ux-v1";
    render(
      <SiteChrome>
        <div>prototype-board</div>
      </SiteChrome>
    );

    expect(screen.getByText("prototype-board")).toBeDefined();
    expect(screen.queryByTestId("landing-shell")).toBeNull();
    expect(screen.queryByTestId("room-shell")).toBeNull();
    expect(screen.queryByTestId("trust-shell")).toBeNull();
  });
});
