# Runbook: Stand up the governance Safe (2-of-3, single operator)

Build the 2-of-3 Safe that becomes `gov` for every v1.5 contract at
construction, and make its recovery path real rather than assumed.

## Scope

- **Applies to:** Base mainnet 8453 and Base Sepolia 84532. Safe supports both.
- **Produces:** one Safe address, which is an input to `DeployV15`. Nothing is
  migrated — v1.5 contracts take it in their constructor, so the two-step
  `transferGovernance` / `acceptGovernance` dance never runs.
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

Against the alternative that actually exists today — a single EOA whose key has
lived on an internet-facing host since deployment — this is a real improvement:
taking the protocol now requires compromising two devices of different kinds.
It is not the improvement a three-person quorum would be, and the documentation
should not imply otherwise.

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

The guardian exists so that pausing does not wait for quorum: it is one
transaction from one key, and it can only ever _decline new risk_ — it cannot
unpause, move funds, or change any parameter. Unpausing stays behind the Safe,
because re-admitting risk is the direction that deserves the delay.

For a one-person 2-of-3, this asymmetry is what keeps the multisig from making
incident response slower than the single EOA it replaced.

## Build order

1. **Sepolia first.** Create the rehearsal Safe, run all three steps above.
2. **Mainnet Safe.** Same three signers, threshold 2-of-3, on Base mainnet via
   app.safe.global. Creation is a normal Base transaction — cheap, but it needs
   gas in whichever signer account deploys it.
3. **Record the address.** It is a constructor argument to `DeployV15`, not
   something configured afterwards, so the deploy is blocked until it exists.
4. **After deployment**, set the guardian on each Bank with
   `Bank.setGuardian(address)` from the Safe, then verify:

   ```bash
   cast call $BANK "governance()(address)" --rpc-url $RPC   # the Safe
   cast call $BANK "guardian()(address)"   --rpc-url $RPC   # the guardian EOA
   ```

   These must differ. A guardian equal to governance is not a fast path, it is
   a second copy of the same authority.

## What this does not settle

The old single EOA `0xc8eC9920…24B1b684` remains the signer of historical
release locks, and it lived on an internet-facing host from deployment until
2026-09-20. Moving governance to a Safe makes that irrelevant going forward; it
does not rewrite the past. Whether to retire that key for release signing is a
separate decision from this runbook.
