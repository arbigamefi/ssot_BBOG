# Release acceptance

- Current source and generated ABIs agree; all contract and frontend package gates pass.
- Every admitted game has a tested terminal path, including maximum-size inputs and timeout recovery.
- Async LP requests, activation, historical recovery, batch allocation and claims reconcile with active NAV. Queued requests remain cancellable until actual activation, including after earliest eligibility; funded new bets continue during every ordinary redemption phase.
- Active reserve (`getSSOT().R` / `activeReserved()`) plus historical remaining reserve equals global `totalReserved()`. New risk cannot spend historical backing; pricing and claims must not double-count liabilities or burn shares again.
- Player-payable fallback and claims preserve the entitled recipient and debt during pause.
- Implement and verify ADR-0035: permanently stuck old positions cannot gate later exits; historical risk/recovery rights survive transfers, full exits and later deposits. Complete external audit before outside LP funding.
- Deployment addresses, Safe configuration, signer, bytecode and parameters match the signed release.
- Web and keeper use the same current release; database starts with the current schema.
- Network acceptance covers VRF, refunds, payout receipts, restart/replay, health and alert delivery.

Follow [the deployment workflow](../deploy/v16-release.md).
