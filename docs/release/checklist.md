# Release acceptance

NFT-deposit/callback core and application interfaces are implemented and locally verified. Full gas qualification and this release checklist remain pending.
Use the [detailed plan](../design/lp-accounting-and-callback-implementation.md) for scenario evidence.

- Pin the original Azuro V3 tree/interface/math sources, provenance and license. Review every adapter
  difference; run differential, lazy-propagation, sparse-tree and arithmetic-bound cases.
- Prove feasibility first: complete wrapper-to-ack gas with tree and two custodians; Bank initcode,
  Vault/runtime sizes and construction. Qualify each admitted game's round limit.
- Verify L/K/G/P/R, both cash balances and all debt movements. Exclude pending principal from LP capital.
  Prove exact asset receipt, non-capital surplus and the special empty-root protocol-capital branch.
- Exercise new NFT per deposit, 24-hour exact boundary, partial-success relock, rollback on failure,
  transferred deadlines, only-owner withdrawal, operator transfer authority and malicious receiver callbacks.
- Check 1e12 withdrawal fractions, floor rounding, zero-percent/zero-amount partial rejection, mature
  zero-value NFT closure and full burn. Bound available cash by L−K with no extra LP withdrawal buffer.
- Prove immutable per-bet cutoffs and the original whole-tree fallback. A successful withdrawal immediately
  reduces capital and has no future claim. No queue, batch, historical-right or ERC20 LP path remains.
- Prove adequate-capital betting continues across LP actions. Keep the G-based bet-risk rule and separate
  PF/XP outflow policy; K>0 prevents total capital withdrawal without a last-share rule.
- Persist canonical randomness across whole-Hub failures; retry only that seed. Terminal state, both custody
  updates and acknowledgment are atomic. Known-unbooked results gate LP funding; internal settlement still works.
- Measure cold/sparse tree, loss/profit fallback, failed payout and failure-return overhead. Unknown
  errors cannot convert winners to refunds. A known normal gas failure is not a keeper operating model.
- Preserve the mature NFT transfer/exit and empty-prefix entry ordering witnesses. The user accepted
  the existing rule; verify matching public disclosures. The 24-hour cooldown and atomic callback
  do not remove this risk, and its acceptance does not close gas, external audit or network gates.
- Preserve fixed refund deadlines, fixed-player debt and pause-safe settlement/retry/refund/payment paths.
- Validate real Anvil SDK/browser and PostgreSQL/keeper flows, NFT ownership and cash ledgers, same-receipt
  terminal events, WS reconnect, HTTP catch-up, duplicate/reorg and process restart. Report skips explicitly.
- Remove obsolete source/tests/ABI/schema/tool fields. Regenerate one release format and exercise negative
  drift/signature tests. No migration or compatibility deployment is required.
- Freeze actual source/tree, vendored sources, ABIs, dependencies and configuration after integration.
- Deploy fresh contracts. Authenticate Safe, signer, wrapper/Router, Bank↔Vault/asset, both codehashes,
  amount precision, limits and matching web/keeper images. Verify Vault source and Bank child creation.
- Replay complete Hub/pool/Sports authorization sets from creation at the signed verification block;
  unavailable history rejects the release.
- Explicitly confirm USDC minimum 0.01 per round and maximum 25 rounds (25 minimum-size rounds total
  0.25 USDC; no additional position-total minimum), one-hour refund default, risk/PF-XP
  buffers, constant 86,400-second cooldown and all-open capacity. Business peak is still unselected.
- Before outside LP funds, decide module/Hub admission governance and guardian custody; rehearse Safe
  guardian replacement/unpause. Complete independent/external audit and fresh network acceptance.
- Apply the operational and service launch requirements in the [release guide](README.md).

Wallet/Safe signatures and deployment execution are separate from local implementation tests.
