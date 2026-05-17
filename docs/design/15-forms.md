# 15 · Forms, Numbers & Validation

| Owner | Frontend Lead |
| Status | Active |
| Last Updated | 2026-05-18 |
| Depends on | `02-voice-and-copy.md`, `11-component-library.md`, `13-web3-ux.md`, `14-data-and-state.md` |
| Supersedes | Draft v1 form platform spec |

Forms exist to help users complete money-moving actions without ambiguity. They
are not a separate framework project.

## 1. Scope

This document covers:

- casino bet slips;
- sportsbook ticket slips;
- deposit, withdraw, claim, and referral forms;
- operator forms in `/ops`.

Legal copy and long-form content are outside this document.

## 2. Form Ownership

Prefer feature-owned form state. A form can use `react-hook-form` and `zod`
when that keeps the code simpler, but they are not mandatory for every field or
small control.

Required in all cases:

- typed input/output shape;
- deterministic validation;
- tests for non-trivial parsing or state transitions;
- no duplicated amount parsing logic.

Schemas live next to the feature that owns the form. Shared schema helpers are
allowed only when two or more features use the same rule.

## 3. Bigint Amount Rules

Asset amounts are bigint values at the contract boundary.

- Keep user input as a string while editing.
- Parse with a bigint-safe decimal parser.
- Use decimals from release metadata.
- Reject scientific notation.
- Reject negative values.
- Do not use native `<input type="number">` for asset amounts.
- Do not use `parseFloat`, `Number(...)`, or floating point math for stake,
  payout, balance, fee, allowance, or settlement values.

`Max` sets the exact available bigint after reserving any required fee or
minimum balance. It must not rely on rounded display values.

## 4. Validation Order

Write flows validate in this order:

1. Local shape: required fields, allowed option, valid address or hash.
2. Amount math: min, max, decimals, allowance, balance.
3. Quote or estimate: VRF fee, odds expiry, gas-sensitive preview.
4. Contract simulation or typed SDK preflight.
5. Wallet signature.
6. Receipt and terminal readback.

Do not let a user sign while any earlier layer is unresolved.

## 5. Canonical Write Flow

Casino, sportsbook, earn, and claims use the same product contract:

```text
edit -> validate -> quote -> approve if needed -> simulate/preflight
     -> sign -> mined -> terminal readback -> receipt
```

Casino adds the round states from `casino-placebet-ux.md`:

```text
placing -> waiting_vrf -> settling -> settled | refundable | failed
```

The result receipt is shown only after terminal chain state is known. A
placeholder receipt that says "indexing" is not acceptable for the final result
surface.

## 6. Error Copy

Errors are product copy, not RPC dumps.

Use:

- `Amount above your balance.`
- `Wallet rejected the request.`
- `Result is not indexed yet. Refresh or verify on-chain.`
- `Keeper is delayed. You can settle manually as a fallback.`

Do not show raw viem, wagmi, JSON-RPC, Solidity selector, or stack-trace text in
normal player UI. Raw diagnostics belong in developer details, logs, tests, or
ops-only views.

## 7. Accessibility

Every field has:

- a visible label or `sr-only` label;
- `aria-invalid` when invalid;
- `aria-describedby` pointing to hint and error text;
- a stable id;
- focus-visible styling;
- keyboard-reachable actions.

Do not disable the submit button in a way that hides why the user cannot
continue. If the button is blocked, the blocking reason must be visible nearby.

## 8. Draft Persistence

Persist drafts only when it improves repeat play or prevents obvious loss:

- casino advanced bet options;
- sportsbook partially built ticket;
- operator market form.

Do not persist:

- wallet signatures;
- private keys or secrets;
- approval payloads;
- stale odds beyond their expiry.

Use a namespaced key:

```text
arbigamefi:<chainId>:<feature>:<form>:<scope>
```

## 9. Formatting

Display formatting follows `02-voice-and-copy.md`.

- Amounts trim trailing zeros.
- Addresses use the shared short form.
- Transaction hashes and request ids can be copied and expanded.
- Time copy uses explicit UTC for audit or ops surfaces.

Forms do not invent local formatters. Add shared helpers when a formatter is
missing.

## 10. Do Not Do

- Do not ask users to read docs to know how to place a bet.
- Do not show raw RPC errors in player flows.
- Do not validate currency inputs on every keystroke with flickering errors.
- Do not add a "force submit" escape hatch.
- Do not mix display decimals with contract decimals.
- Do not infer asset metadata from token address when release metadata exists.

## 11. Verification

```bash
rg -nE "type=['\\\"]number['\\\"]" frontend/apps/web/src
rg -nE "parseFloat|Number\\(" frontend/apps/web/src/features frontend/apps/web/src/components
rg -nE "viem@|Contract Call:|execution reverted|JSON-RPC" frontend/apps/web/src
pnpm -C frontend test
```
