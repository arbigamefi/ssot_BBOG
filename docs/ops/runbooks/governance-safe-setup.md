# Governance Safe setup

Use the first-deployment flow in [Deploy the current contracts](../../deploy/v16-release.md).
The deployment configuration must identify the final Safe, its expected owners/threshold and control
hashes, as well as the separate guardian and keeper signer. Use the current deployment template;
never substitute a fixture address for a live authority.

1. Establish the intended signer custody and quorum. If one person controls several signers, record
   that fact: separate devices do not create independent decision makers. Keep enough recoverable
   signing material in separate locations to survive the loss of one device or location.
2. Verify the Safe's deployed code, owners, threshold and enabled controls against the deployment
   configuration. Review modules, guard and fallback handler as part of its effective authority.
3. Exercise the intended approval and recovery signing paths on a test network before the Safe
   controls assets. Retain transaction receipts and authority readbacks.
4. Run the deployment dry run and inspect its wiring. The deployment script bootstraps the new
   contracts and stages governance for the Safe. Generate the acceptance transactions with
   `make safe-acceptance-v16`; the Safe owners review and execute them.
5. Run `make release-governance-check` and the release verification steps before importing the
   application release. A configured Safe address or generated acceptance payload does not prove
   that each target has accepted that governance.

For a configuration change, review the target, selector, arguments and affected outstanding
positions before signing. After execution, check the receipt and read the resulting state at a
confirmed block. A GameHub game ID can be registered only once; it cannot be replaced or unregistered.
Registering a new game ID controls future acceptance. Existing bets finalize with their accepted module snapshot.

## Changes that void the first-callback certificate

The [first-callback gas certificate](../../audit/first-callback-gas-certificate-2026-10-07.md) holds only
inside its certified domain. `VerifyCallbackDomainV16` enforces that domain at release time, but
governance can leave it afterwards. Recertify **before** signing any of these changes:

- `Bank.setMinBetAmount` on a casino pool to a value below 99 raw units (the official value is 10,000).
  Below 99, a Dice or Roulette bet can have k = 0, which takes the uncertified k = 0 allocation path.
- Any `GameHub.registerGame`, whether it adds a new module under a new game ID, changes the round ceiling
  or changes the callback gas limit.
- Any `PoolRegistry.registerPool`, `setHubAllowedForPool` or `setPoolActive` that admits or reactivates a
  casino pool. A new pool brings its own Bank and Vault, whose code and constructor `minBetAmount` the
  certificate has not seen.
- Any `GameHub.createReferralConfig`, `setActiveReferralConfig` or `queueEdgeChange`. The certificate lists
  referral and edge parameter changes as voiding it. Treat them as recertification triggers until the
  certificate review confirms that values inside the checked ranges cannot move the bound.

Release verification replays every `GameRegistered` event and checks the live USDC implementation and VRF
provider parameters. After release, however, only this runbook and alerting stand between governance and an
uncertified configuration. The configuration-drift alerts recommended by the architecture decision (K0-4) are not
implemented yet.

The certificate also lapses when the USDC implementation is upgraded, when the VRF wrapper or coordinator
parameters change, or when a network fork changes gas pricing. Those changes happen outside governance,
but they have the same effect. If recertification finds that k = 0 has become reachable, the certificate
must either bound the k = 0 branch or adopt the `_prefixCovers(cutoff, 1)` variant from the ADR-0034
amendment, by a separate decision.

Bank guardians may pause, but only governance may unpause. Keep the guardian and permissionless
keeper keys outside Safe signer custody. See [pause rules](pause-config-drift.md) and
[keeper signer custody](keeper-key-separation.md).
