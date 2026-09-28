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
confirmed block. In particular, replacing a GameHub module affects finalization of existing bets.

Bank guardians may pause, but only governance may unpause. Keep the guardian and permissionless
keeper keys outside Safe signer custody. See [pause rules](pause-config-drift.md) and
[keeper signer custody](keeper-key-separation.md).
