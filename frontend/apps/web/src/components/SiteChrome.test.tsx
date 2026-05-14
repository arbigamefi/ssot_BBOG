import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

const state = {
  pathname: "/"
};

vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname
}));

vi.mock("./PrototypeHeader", () => ({
  PrototypeHeader: ({ activeRoute, variant }: any) => (
    <div data-testid={`header-${activeRoute}-${variant}`}>Header</div>
  )
}));

vi.mock("../ssot/release/ReleaseProvider", () => ({
  useRelease: () => ({ readOnly: false, readOnlyReason: null, warnings: [] })
}));

import { SiteChrome } from "./SiteChrome";

describe("SiteChrome", () => {
  afterEach(() => {
    cleanup();
    state.pathname = "/";
  });

  it("passes correct properties for home route", () => {
    state.pathname = "/";
    render(
      <SiteChrome>
        <div>content</div>
      </SiteChrome>
    );

    expect(screen.getByTestId("header-none-transparent")).toBeDefined();
  });

  it("passes correct properties for gameplay routes", () => {
    state.pathname = "/roulette";
    render(
      <SiteChrome>
        <div>content</div>
      </SiteChrome>
    );

    expect(screen.getByTestId("header-roulette-game")).toBeDefined();
  });

  it("detects games directory route", () => {
    state.pathname = "/games";
    render(
      <SiteChrome>
        <div>content</div>
      </SiteChrome>
    );

    expect(screen.getByTestId("header-directory-default")).toBeDefined();
  });

  it("detects sportsbook route", () => {
    state.pathname = "/sportsbook";
    render(
      <SiteChrome>
        <div>content</div>
      </SiteChrome>
    );

    expect(screen.getByTestId("header-sportsbook-default")).toBeDefined();
  });

  it("bypasses chrome on prototype routes", () => {
    state.pathname = "/prototype/ui-ux-v1";
    render(
      <SiteChrome>
        <div>prototype-board</div>
      </SiteChrome>
    );

    expect(screen.getByText("prototype-board")).toBeDefined();
    // Header should not be rendered
    expect(screen.queryByTestId(/header-/)).toBeNull();
  });
});
