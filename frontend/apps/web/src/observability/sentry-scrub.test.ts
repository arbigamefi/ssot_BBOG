import { describe, expect, it } from "vitest";

import { scrubSentryEvent, scrubSentryText } from "./sentry-scrub";

describe("Sentry scrubbing", () => {
  it("redacts wallet-like addresses in strings", () => {
    expect(scrubSentryText("player=0xd66218cd2fecc6b17b1871c5465a902a0e5abfb9")).toBe(
      "player=0xREDACTED"
    );
  });

  it("redacts sensitive URL query params", () => {
    expect(scrubSentryText("/api?signature=0xabc123&ok=1&private_key=secret")).toBe(
      "/api?signature=REDACTED&ok=1&private_key=REDACTED"
    );
  });

  it("walks nested event payloads without dropping fields", () => {
    const event = scrubSentryEvent({
      request: {
        url: "https://app.example/portfolio/0xd66218cd2fecc6b17b1871c5465a902a0e5abfb9"
      },
      breadcrumbs: [
        {
          message: "connected 0xc8ec9920d573893e888db5d30b2b3b3824b1b684"
        }
      ]
    });

    expect(event.request.url).toContain("0xREDACTED");
    expect(event.breadcrumbs[0]?.message).toContain("0xREDACTED");
  });
});
