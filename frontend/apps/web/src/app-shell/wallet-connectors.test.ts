import { afterEach, expect, it, vi } from "vitest";
import { browserWalletWhenAvailable } from "./wallet-connectors";

afterEach(() => vi.unstubAllGlobals());

it("lists the generic browser provider only when present", () => {
  const options = { appName: "ArbiGameFi", projectId: "test-project" };
  vi.stubGlobal("ethereum", undefined);
  expect(browserWalletWhenAvailable(options).hidden?.()).toBe(true);
  vi.stubGlobal("ethereum", { request: vi.fn() });
  expect(browserWalletWhenAvailable(options).hidden?.()).toBe(false);
});
