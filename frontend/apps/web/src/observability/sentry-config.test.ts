import { beforeEach, describe, expect, it } from "vitest";

import { getSentryEnvironment, getSentryRelease } from "./sentry-config";

const originalEnv = process.env;

describe("sentry config helpers", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_BUILD_SHA;
    delete process.env.NEXT_PUBLIC_ENV;
    delete process.env.NEXT_PUBLIC_SENTRY_RELEASE;
  });

  it("uses explicit public release tags before generic build sha", () => {
    process.env.NEXT_PUBLIC_BUILD_SHA = "build-1";
    process.env.NEXT_PUBLIC_SENTRY_RELEASE = "release-1";

    expect(getSentryRelease()).toBe("release-1");
  });

  it("falls back to public build sha for release tags", () => {
    process.env.NEXT_PUBLIC_BUILD_SHA = "build-1";

    expect(getSentryRelease()).toBe("build-1");
  });

  it("uses explicit public environment before node environment", () => {
    process.env.NEXT_PUBLIC_ENV = "production";

    expect(getSentryEnvironment()).toBe("production");
  });
});
