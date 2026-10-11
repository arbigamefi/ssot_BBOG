# Real NFT callback integration tests

`test/unit/NftCallbackIntegration.t.sol` exercises the actual Bank, LiquidityVault,
VRFHub, GameHub, SettlementRouter, PoolRegistry, eight game modules, referral registry
and allocation engine. The stage-0 Bank and VRF prototypes have been removed.

Run from the repository root:

```sh
forge test --match-path test/unit/NftCallbackIntegration.t.sol --ignored-error-codes 6335 -vv
```

Compiler: Solidity 0.8.37, optimizer 500, via-IR, Cancun. Release status:
[release notes](../../../docs/release/README.md).

## External models and measurement limits

`ExactGasWrapperFixture.sol` models only the wrapper request/transport boundary. It
uses pinned Chainlink exact-gas forwarding assembly and request overhead arithmetic;
its request pricing and storage are synthetic. `BlacklistToken` models USDC-like
six-decimal cash with programmable failures. Neither replaces actual deployed-wrapper
and token fork qualification. No fixture may be deployed as a compatibility mode.

Base Sepolia block 47,638,466 reported coordinator maximum 2,500,000 and wrapper
overhead 13,400. The request inequality is
`c + floor(c / 63) + 1 + 13400 <= 2500000`; consumer maximum is 2,447,746.
The final release must re-read the provider configuration.

The measured unit is the gas consumed around the exact-gas CALL into inherited
`rawFulfillRandomWords`, including small assembly/CALL overhead. It is not whole
transaction, proof or billing gas. A separate 6,000,000-gas diagnostic delivery
measures successful work beyond the normal budget; that allowance is unavailable
as a request on the pinned coordinator. A retry proves recovery, not normal-path
qualification for an over-budget workload.

## Storage baselines and assertions

The 48-case matrix is 8 games × 1/10/25 rolls × eligible/locked XP. Placement and
late deposits occur in the same test, so it is **storage-dirty path screening**.
`vm.cool` clears account/storage warmth, not EIP-2200 original values.

Sixteen separate `NftCold*` suites perform setup, placement and subsequent deposits
in `setUp`, then fulfill in the later test transaction. Default inputs are sixteen
old deposits, eight later deposits, three XP awards and seed 12345. A separate Keno-25
case uses seventeen old deposits and a preceding partial withdrawal. These are
representative histories, not worst-case enumeration.

Every success must be Settled, use the original module output from the retained
seed, reconcile payout/refund/turnover/full operator allocation and all three XP
awards, clear P/R/K/result count, and reconcile both cash balances. No fallback
refund counts as successful resolution.

Failures cover zero seed, entire Hub delivery failure, module failure/large revert,
expensive token, ack rollback, permissionless same-seed retry/public finalize,
late/duplicate delivery, pause/admission revocation and refund-vs-receipt ordering.
An expected over-budget case passes only when receipt preservation and recovery
assertions succeed. It does not qualify that game/count for production admission.
