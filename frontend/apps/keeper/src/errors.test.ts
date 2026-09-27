import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import {
  HttpRequestError,
  LimitExceededRpcError,
  RpcRequestError,
  SocketClosedError,
  WebSocketRequestError
} from "viem";
import { beforeAll, describe, expect, it } from "vitest";

import { describeError, redactUrls } from "./errors.js";

const KEY = "rpc-api-key-that-must-not-be-logged";
const WS_URL = `wss://base-mainnet.g.alchemy.com/v2/${KEY}`;
const HTTP_URL = `https://base-mainnet.infura.io/v3/${KEY}`;

/** What Node's WebSocket fires when the server answers the upgrade with HTTP 429. */
async function rejectedHandshakeEvent() {
  const server = createServer();
  server.on("upgrade", (_request, socket) =>
    socket.end("HTTP/1.1 429 Too Many Requests\r\ncontent-length: 0\r\n\r\n")
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    return await new Promise<Event>((resolve) => {
      const socket = new WebSocket(`ws://127.0.0.1:${port}/v2/${KEY}`);
      socket.addEventListener("error", resolve, { once: true });
    });
  } finally {
    server.close();
  }
}

describe("describeError", () => {
  let handshakeEvent: Event;
  beforeAll(async () => {
    handshakeEvent = await rejectedHandshakeEvent();
  });

  it("describes the empty-message ErrorEvent of a rejected WebSocket handshake", () => {
    // The production symptom: this event's message is "" and says nothing about the 429.
    expect((handshakeEvent as Event & { message: string }).message).toBe("");

    expect(describeError(handshakeEvent)).toBe("ErrorEvent: error event without a message");
  });

  it("drops the URL viem puts in a closed socket's message", () => {
    const error = new SocketClosedError({ url: WS_URL });
    expect(error.message).toContain(KEY);

    expect(describeError(error)).toBe("SocketClosedError: The socket has been closed.");
  });

  it("names the closed socket under a failed WebSocket request", () => {
    const error = new WebSocketRequestError({
      body: { method: "eth_subscribe" },
      cause: new SocketClosedError({ url: WS_URL }),
      url: WS_URL
    });

    const description = describeError(error);
    expect(description).toBe(
      "WebSocketRequestError: WebSocket request failed. <- SocketClosedError: The socket has been closed."
    );
    expect(description).not.toContain(KEY);
  });

  it("keeps the status and details of an HTTP failure but not its URL", () => {
    const error = new HttpRequestError({
      body: { method: "eth_blockNumber" },
      details:
        '{"code":429,"message":"Monthly capacity limit exceeded. Visit https://dashboard.example/billing"}',
      status: 429,
      url: HTTP_URL
    });
    expect(error.message).toContain(KEY);

    expect(describeError(error)).toBe(
      'HttpRequestError [status=429]: HTTP request failed. Details: {"code":429,"message":"Monthly capacity limit exceeded. Visit [redacted-url]"}'
    );
  });

  it("keeps the RPC code and provider text of a rate limit without the request", () => {
    const error = new LimitExceededRpcError(
      new RpcRequestError({
        body: { method: "eth_blockNumber" },
        error: { code: -32005, message: "daily request count exceeded, request rate limited" },
        url: HTTP_URL
      })
    );
    expect(error.message).toContain(KEY);

    const description = describeError(error);
    expect(description).toBe(
      "LimitExceededRpcError [code=-32005]: Request exceeds defined limit. Details: daily request count exceeded, request rate limited"
    );
    expect(description).not.toContain("eth_blockNumber");
  });

  it("describes the JSON-RPC error object a rejected eth_subscribe hands over", () => {
    expect(
      describeError({
        code: 429,
        message: "Monthly capacity limit exceeded. Visit https://dashboard.example/billing"
      })
    ).toBe("Error [code=429]: Monthly capacity limit exceeded. Visit [redacted-url]");
  });

  it("adds the network error hidden under fetch failed", () => {
    const refused = Object.assign(new AggregateError([], ""), { code: "ECONNREFUSED" });
    const error = new HttpRequestError({
      cause: new TypeError("fetch failed", { cause: refused }),
      url: HTTP_URL
    });

    expect(describeError(error)).toBe(
      "HttpRequestError: HTTP request failed. Details: fetch failed <- AggregateError [code=ECONNREFUSED]: (no message)"
    );
  });

  it("describes plain errors, empty errors and thrown non-errors", () => {
    expect(describeError(new Error("postgres unavailable"))).toBe("Error: postgres unavailable");
    expect(describeError(Object.assign(new Error(""), { code: "ECONNRESET" }))).toBe(
      "Error [code=ECONNRESET]: (no message)"
    );
    expect(describeError("boom")).toBe("boom");
    expect(describeError("")).toBe("(empty string)");
    expect(describeError(undefined)).toBe("undefined");
    expect(describeError(null)).toBe("null");
    expect(describeError(42)).toBe("42");
  });

  it("stays on one bounded line", () => {
    const error = new Error(`first line\nsecond line ${"x".repeat(1_000)}`);

    const description = describeError(error);
    expect(description).not.toContain("\n");
    expect(description.startsWith("Error: first line second line x")).toBe(true);
    expect(description).toHaveLength(500);
  });

  it("never throws, even for a cyclic cause or a hostile getter", () => {
    const cyclic = new Error("loops") as Error & { cause?: unknown };
    cyclic.cause = cyclic;
    const hostile = {
      get message(): string {
        throw new Error("getter failed");
      }
    };

    expect(describeError(cyclic)).toBe("Error: loops");
    expect(describeError(hostile)).toBe("(error could not be described)");
  });
});

describe("redactUrls", () => {
  it("removes every URL, credentials and query strings included", () => {
    expect(
      redactUrls(`ws ${WS_URL}, http ${HTTP_URL}?apikey=abc, db postgres://keeper:pw@db:5432/bets.`)
    ).toBe("ws [redacted-url], http [redacted-url], db [redacted-url].");
  });
});
