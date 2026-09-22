# Runbook: Stand up the governance Safe (2-of-3, single operator)

Prepare a 2-of-3 Safe and rehearse its recovery path for the v1.5
governance design. This document is a readiness plan, not evidence that a
Safe has been deployed, installed as governance, or exercised successfully.

## Scope

- **Applies to:** Base mainnet 8453 and Base Sepolia 84532. Safe supports both.
- **Produces:** a proposed Safe address and rehearsal evidence. A versioned
  v1.5 deployment/bootstrap workflow is implemented in `script/DeployV15.s.sol`;
  use [the active release workflow](../../deploy/v15-release.md). Script availability
  does not prove that the Safe has accepted governance on any live target.
- **Current deployment limit:** `script/DeployV14.s.sol` requires
  `cfg.deployer == cfg.gov` and performs governance-only wiring from the
  broadcast EOA. It cannot bootstrap contracts with a Safe as governance;
  merely substituting the Safe address into `GOV` fails its preflight.
- **Migration status:** neither new deployment nor transfer of existing
  governance is proven by this plan. Existing-contract migration would need
  reviewed `transferGovernance` actions by current governance, then
  `acceptGovernance` executed by the Safe for each contract, with readback.
  A constructor-based Safe design instead needs a working bootstrap path that
  performs all privileged wiring through the correct authority.
- **Does not cover:** the guardian. That is a separate plain EOA set afterwards
  with `Bank.setGuardian`, and it is not a Safe signer. See
  `keeper-key-separation.md` for how its key is generated and handled.

## The honest version of what this buys

All three signers are held by one person. That is worth stating plainly,
because a 2-of-3 Safe held this way is **not** the same security property as
three independent people.

**It does protect against:**

- One device being compromised. A laptop with malware cannot produce a second
  signature from a hardware wallet whose key never leaves the device.
- One key leaking. A key pasted somewhere it should not have been — as happened
  with a keeper key on 2026-09-20 — no longer hands over the protocol.
- One device being lost or bricked. Two remain, and two is quorum.

**It does not protect against:**

- The operator being phished, socially engineered, or coerced. One person
  approving on two devices is still one person deciding.
- A wrong decision. All three signers will happily approve the same mistake.
- Every backup sitting in one place. A single fire or burglary can take out
  the whole quorum — which is what the storage rule below exists to prevent.

Historical operations records describe governance under a single EOA whose
key resided on an internet-facing host. Replacing that authority with a
verified 2-of-3 Safe would require two device signatures for normal governance
actions. This remains a planned improvement until contract governance, Safe
owners/threshold, execution and recovery are verified; it does not establish
a three-person quorum or erase prior credential exposure.

## Signer design

Three signers, deliberately of three different **kinds**, so that one class of
compromise cannot reach more than one of them.

| #   | Kind                              | Role             | Touches                       |
| --- | --------------------------------- | ---------------- | ----------------------------- |
| 1   | Hardware wallet (Ledger / Trezor) | Everyday primary | Every governance action       |
| 2   | Phone wallet (separate device)    | Everyday second  | Every governance action       |
| 3   | Offline cold key                  | Recovery only    | Nothing, until 1 or 2 is gone |

Signers 1 and 2 give quorum for routine work. Signer 3 stays offline and exists
so that losing one everyday signer is an inconvenience rather than an incident.

Do **not** generate three keys on the same machine. Three files in one home
directory is a 2-of-3 Safe with the security of a 1-of-1: whoever takes that
machine takes quorum. Signers do not need to be freshly generated at all —
an existing hardware wallet account is a perfectly good signer, and the Safe
only ever sees addresses.

## The failure mode this design has to survive

**Losing two signers means losing governance permanently.** There is no
recovery path behind a 2-of-3 other than the signers themselves.

With three independent people that is remote. With one person it is not: the
same fire, the same burglary, the same flooded apartment can take the hardware
wallet and the phone together, and then signer 3 alone cannot reach quorum.

So the rule is about **seed storage, not device storage**:

- Back up the recovery seed of **each** signer offline — steel plate or paper,
  never a photo, never a password manager that syncs, never a cloud note.
- Store them in **at least two physically separate locations**, in different
  buildings. Two seeds in one drawer is one location.
- Losing a _device_ must never mean losing a _signer_. A drowned phone is
  recoverable from its seed; a drowned phone whose seed was only on that phone
  is a lost signer.

Under this rule the quorum survives losing any one location outright.

## Recovery rehearsal (do not skip)

An untested recovery path does not exist. After the Safe is created and before
it holds anything:

1. Create a throwaway Safe on **Base Sepolia** with the same three signers and
   the same 2-of-3 threshold.
2. Execute one transaction with signers 1 + 2. This is the everyday path.
3. Now pretend signer 1 is gone. Execute another transaction with signers
   **2 + 3**, using the cold key for real — importing it, signing, and putting
   it back offline.

Step 3 is the whole point. It is where you find out that the cold key's seed
was written down wrong, that the derivation path differs, or that the wallet
software cannot import it. Finding that out on Sepolia costs nothing; finding
it out during an incident costs the protocol.

Repeat the rehearsal after any signer change.

## Why the guardian matters more, not less, for a single operator

Collecting two signatures means physically reaching two devices. That is fine
for a parameter change and bad for an emergency.

The guardian in the planned v1.5 Bank source permits a pause without quorum.
That pause blocks new holds, deposit/mint, LP withdraw/redeem, protocol-fee
claims and accrued XP claims. Held-bet settlement/refund remains available
subject to hub conditions. The guardian cannot unpause, transfer funds or
change parameters. If governance is the Safe, unpausing and guardian
assignment/revocation require Safe execution with its owner quorum.

For a one-person 2-of-3, this asymmetry is what keeps the multisig from making
incident response slower than the single EOA it replaced.

## Build order

1. **Sepolia first.** Create the rehearsal Safe, run all three steps above.
2. **Mainnet Safe.** Same three signers, threshold 2-of-3, on Base mainnet via
   app.safe.global. Creation is a normal Base transaction — cheap, but it needs
   gas in whichever signer account deploys it.
3. **Record the Safe address, owners and threshold.** Complete the versioned
   deployment/bootstrap or migration design before using this address as
   protocol governance. Keep the v1.5 deployment blocked until that workflow
   can initialize all privileged wiring and verify every target's authority;
   the existing `DeployV14` script is not that workflow.
4. **Rehearse protocol governance on Sepolia.** Use the implemented deployment
   or migration path, then execute a harmless reviewed governance action via
   the Safe. Verify the target contract sees the Safe as its immediate caller,
   the Safe execution succeeds, and the changed state is read back. A relayer's
   outer transaction sender is not the governance identity.
5. **After a verified guardian-capable Bank deployment**, prepare its guardian
   assignment and execute it through the Safe using the
   [EOA/Safe action procedure](pause-config-drift.md#execute-a-governance-action-eoa-or-safe):

   ```bash
   # Transaction Builder target: this Bank; value: 0; data: this output.
   cast calldata "setGuardian(address)" "$GUARDIAN"
   # Read back after the required Safe owner quorum executes successfully.
   cast call "$BANK" "governance()(address)" --rpc-url "$RPC"
   cast call "$BANK" "guardian()(address)" --rpc-url "$RPC"
   ```

   Verify governance is the approved Safe and guardian is the separate approved
   EOA. On Sepolia, rehearse guardian pause, Safe revocation, and Safe unpause in
   that order; confirm the revoked guardian cannot pause again. Record receipt,
   Safe transaction and readback evidence before declaring readiness.

## What this does not settle

Historical release locks identify the old EOA `0xc8eC9920…24B1b684`, and the
2026-09-20 operations record describes its prior host residency. This plan
does not verify its current roles or credential copies. A verified governance
transfer would remove only the transferred on-chain authority; release signing,
other retained roles and old-key copies require separate inventory and
retirement decisions. Safe creation alone does not complete that migration.
