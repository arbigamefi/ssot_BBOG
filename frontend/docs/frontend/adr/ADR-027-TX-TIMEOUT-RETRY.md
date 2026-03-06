# ADR-027: Transaction Timeout, Retry, and RPC Rate Limiting

## Context

The current `txPipeline.ts` has three production gaps:

1. **No receipt timeout**: `waitForTransactionReceipt` will wait indefinitely. If a transaction is stuck in the mempool (low gas, nonce gap, network congestion), the UI shows an infinite spinner with no user recourse.

2. **No retry on transient failures**: `simulateAndWrite` makes a single attempt. Transient RPC errors (429 rate limit, 502 gateway timeout, socket hangup) cause immediate failure, even though retrying would likely succeed.

3. **No RPC rate limiting**: Concurrent SDK calls can burst 10+ RPC requests in <100ms, triggering provider rate limits (Alchemy: 330 CU/s, Infura: 10 req/s, public RPCs: ~5 req/s).

## Decision

### Timeout

Add `timeout: 120_000` (2 minutes) to `waitForTransactionReceipt`. On timeout:
- Emit a `TX_TIMEOUT` domain error (severity: warning, retryable: true)
- Journal the timeout event
- The transaction may still confirm later — the timeout only means the UI stops waiting

Rationale for 120s: L2s (Base, Arbitrum) typically confirm in 2-15s. 120s covers extreme network congestion while still providing timely feedback. Users can check the bet status page if they suspect a timeout.

### Retry

For `simulateAndWrite`, retry **once** after a 2-second delay on these error types:
- `HttpRequestError` (network-level failure)
- `RpcRequestError` with codes -32005 (rate limit) or -32603 (internal error)

NOT retried:
- User rejections (already handled as `USER_REJECTED`)
- Contract reverts (deterministic — retry would produce the same result)
- Simulation failures (indicate a state mismatch)

### Rate Limiting

Introduce a simple `minIntervalMs: 200` throttle on outbound RPC calls within the pipeline. This caps at ~5 req/s, safely within all major provider limits.

Implementation: a last-call timestamp with `await sleep(remaining)` before each call. This is intentionally simple — no token bucket or sliding window needed at current scale.

## Alternatives

- **Exponential backoff with jitter**: Overkill for a single retry. If we ever need multi-retry, we can evolve.
- **Queue-based RPC manager**: Adds significant complexity. The simple throttle is sufficient unless we're running 10+ concurrent SDK instances (which we don't).
- **User-configurable timeout**: Adds UI complexity. 120s is a safe default; power users can retry manually.
- **Separate retry for simulation vs. write**: Both share the same transient failure modes. A single retry wrapper suffices.

## Consequences

- Users see a clear timeout error instead of infinite loading
- Transient RPC failures are silently recovered (one retry)
- RPC rate limits are respected, reducing 429 errors
- Journal captures timeout events for post-mortem analysis
- New domain error code: `TX_TIMEOUT`

## Status

Proposed
