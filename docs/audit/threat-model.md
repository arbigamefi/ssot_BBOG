# Threat Model (v1.2)

## Assets

1. **Underlying ERC20 ASSET in each Bank(asset)**
2. **LP shares (ERC4626-like)**
3. **Player escrow + reserved liabilities (stake/reserve)**
4. **Protocol liabilities (PF)**
5. **External liabilities (XP: referral/kickback)**
6. **Native-token VRF fees + refund credits** (ETH paid at bet placement; `refundCredit` claimable)

## Trust assumptions

- **VRF provider** (e.g., Chainlink VRF v2.5+ Wrapper) provides unpredictability.
- ERC20 `ASSET` behaves as a standard token (no fee-on-transfer, no rebase), unless explicitly adapted.
- Native token transfers may fail for some receivers; this is handled via `refundCredit`.

## Adversaries

- Malicious player trying to extract more than allowed by game rules.
- Malicious LP trying to front-run withdrawals and drain solvency.
- Malicious governance actor trying to exfiltrate funds (backdoor).
- Malicious/buggy VRF provider attempting to brick callbacks (DoS) or grief via expensive callbacks.
- Reentrancy and callback-based attacks on transfers.

## Security objectives

- **Solvency:** `NAV >= R` always (per asset).
- **Liveness:** any accepted bet can reach Settled/Refunded without admin cooperation.
- **No backdoor:** no privileged path can move `ASSET` out of Bank while violating SSOT.
- **Determinism:** payouts are reproducible from on-chain state (params + snapshot + random words).
- **ETH accounting correctness (adapter mode):** wrapper collects only charged VRF fees; VRFHub holds only refund credits.

## Key mitigations

- Bank SSOT enforced via invariants + hard checks (A1–A4).
- Hub is the only authority for bet funds, minimizing the call surface.
- VRFHub fulfill never reverts, preventing callback bricking.
- Charged VRF fee: overpayment refunded best-effort; failures accrue `refundCredit` (debt-out liveness).
- Adapter mode: additional invariants ensure Hub/adapter retain no ETH and credits are claimable.
- XP buckets: accrue during settlement, but do not block settlement (no external transfers required).
- Permissionless finalize/refund: avoids admin gating.
- Bucket moves for unlock/sync: no transfers; safe during pause.

## Remaining risks / out of scope

- Governance compromise (keys stolen) can still set bad parameters; mitigated by operational security.
- Oracle/VRF assumptions: VRF malfunction is treated as external.
- Token non-standard behavior: fee-on-transfer/rebasing assets require dedicated adapters.
- MEV / front-running: economics are robust, but UX-level mitigation is out of scope for core SSOT.
