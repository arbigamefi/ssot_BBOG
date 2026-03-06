# ADR-012: Wallet Stack and Provider Boundaries

## Context
We need a wallet connection experience but must prevent wallet/RPC logic from leaking into feature UIs.

## Decision
- Use **wagmi** (with viem under the hood) for wallet connection.
- `apps/web` owns only the **Provider wiring** (e.g., `WagmiConfig`).
- All contract reads/writes **must** go through `@ssot/ssot` SDK.

## Alternatives
- Ethers v5/v6 (rejected): less aligned with modern viem tooling.

## Consequences
We need ESLint boundaries to allow wagmi imports only in provider setup modules.

## Status
Accepted
