# Release acceptance

- Current source and generated ABIs agree; all contract and frontend package gates pass.
- Every admitted game has a tested terminal path, including maximum-size inputs and timeout recovery.
- Async LP requests, activation, historical recovery, batch allocation and claims reconcile with active NAV. Queued requests remain cancellable until actual activation, including after earliest eligibility; funded new bets continue during every ordinary redemption phase.
- Active reserve (`getSSOT().R` / `activeReserved()`) plus historical remaining reserve equals global `totalReserved()`. New risk cannot spend historical backing; pricing and claims must not double-count liabilities or burn shares again.
- Player-payable fallback and claims preserve the entitled recipient and debt during pause; the keeper claims payables for their players and backs off on refusals.
- ADR-0035 holds on the audited source: permanently stuck old positions cannot gate later exits; historical risk/recovery rights survive transfers, full exits and later deposits. Complete external audit before outside LP funding.
- Deployment addresses, Safe configuration, signer, bytecode and parameters match the signed release.
- Web and keeper use the same current release; database starts with the current schema.
- Each pool explicitly configures its minimum total stake in asset base units. USDC minimum is 1 USDC per position (100 rolls can use 0.01 USDC each). The default refund timeout remains 3600 seconds and accepted deadlines cannot change. The 60-second structural floor is not a target-network safety recommendation; any shorter deployment timeout needs measured VRF failure and latency acceptance.
- Before outside LP funding, record the decision on module/hub/pool admission timelocks and independently controlled guardian multisig configuration. Rehearse governance replacing the guardian and unpausing, including loss of old guardian powers and actual claim recovery.
- Capacity acceptance is pending a separately chosen business peak, burst rate, tail latency and cost threshold. Measure ready-to-terminal and missing-VRF refund recovery; refundable locked principal is not an attack-cost guarantee.
- Network acceptance covers VRF, refunds, payout receipts, payable claims, restart/replay, health and alert delivery.
- Compliance controls are enforced server-side before any real-money service: geo-blocking, sanctions screening and player limits.

Follow [the deployment workflow](../deploy/v16-release.md).
