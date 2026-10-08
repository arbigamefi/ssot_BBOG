# Azuro V3 LiquidityTree

The upstream baseline is the verified Base Vault implementation
`0xD1025891129F02f0E66D5126fC73e52Aecb918C3` at reference block 52,126,392.
Source: https://basescan.org/address/0xD1025891129F02f0E66D5126fC73e52Aecb918C3#code

`FixedMath.sol` and `ILiquidityTree.sol` remain byte-for-byte upstream copies.
`LiquidityTree.sol` carries two local optimizations. Each one is a separate, reversible patch:

| Step | Patch | `utils/LiquidityTree.sol` SHA-256 |
| --- | --- | --- |
| Upstream | — | `f8b05891ad5a99dba2b315d69b78c515e8e9319679ba8667e0da4f02bcc9ae57` |
| 1 | `RANGE_SUM.patch` | `26d612e9810943233b1804f71a511ce10dafd12740e4367c32147ef2add06108` |
| 2 (applied) | `UNUSED_SUFFIX.patch` | `15fb55d36409da306ab508ffb497e6eea512a3b239bf19fa67b8a6af74565854` |

To verify the chain, reverse it in a scratch copy of this directory:

```sh
patch -R -p1 < UNUSED_SUFFIX.patch && shasum -a 256 utils/LiquidityTree.sol   # 26d612e9...
patch -R -p1 < RANGE_SUM.patch && shasum -a 256 utils/LiquidityTree.sol       # f8b05891...
```

The patches record provenance. They are not second production implementations or compatibility paths.

## The two patches rest on different arguments

**RANGE_SUM** replaces the recursive raw-node range summation with the equivalent iterative inclusive
segment-tree query. It also removes the query's three redundant internal parameters at both call sites.

- Its argument does not depend on state: both queries select exactly the maximal dyadic cover of the same
  global leaf interval, and both read the same raw node amounts without pushing lazy updates. They agree on any
  storage, including inconsistent lazy parent/child amounts and arithmetic overflow.
- Checked uint128 sums, storage layout, allocation and rounding, the prefix fallback, withdrawal behavior and
  external interfaces are unchanged.
- Qualification: `docs/audit/tree-range-optimization-2026-10-04.md`.

**UNUSED_SUFFIX** changes one statement in `_pushLazy`. At a fork, the right child's amount excludes the
leaves after the range end `r`. When `r >= nextNode - 1`, that suffix lies wholly after the last used leaf, so
the query is skipped and replaced by 0.

- Its argument rests on a vendor-wide invariant, P3': a non-root node whose whole range lies after the last used
  leaf holds zero. Every write keeps P3':
  - `_push` writes only children whose amount is already positive;
  - `_pushLazy` changes only positive nodes or the root;
  - `_updateUp` writes only the path from a used leaf to the root.
- When the lazy range [LIQUIDITYNODES, r] is nonempty, that is once a leaf has been used, the suffix cover at a
  fork lies strictly inside the right child. It never contains the root, so the skipped query is exactly 0, even
  when value was booked into an empty root. The patch therefore does not depend on the Vault's own tree invariant.
- For every such call, storage effects, `updateId` numbering, reverts and interfaces are unchanged.
- One known exception: on a never-used tree whose root holds value booked by `_add`, `_remove` has an empty
  range. Its suffix cover is then the root itself, so the pre-patch code underflows (Panic 0x11) while the patched
  code succeeds. The Vault cannot reach this case, because it never calls `_remove` and settles only at a used
  cutoff below `nextNode`. `AzuroUnusedSuffixEquivalence` pins the exception (independent review, 2026-10-07).
- The new `nextNode - 1` expression would underflow on a tree whose `__liquidityTree_init` never ran. The
  constructor always runs it, so this case is unreachable.
- `_isNeedUpdateWholeLeaves` keeps the same query on purpose:
  - only the k = 0 profit path of the Vault (`_addLimit`) still evaluates it, and that path is outside the
    certified callback domain;
  - the two forms are equal on reachable states;
  - every extra vendor line adds review and provenance cost.

  If the Vault's k > 0 preview skip is ever reverted, reassess this choice.
- Qualification: `docs/audit/preview-skip-first-callback-2026-10-07.md`.

## Vault dependencies on tree internals

`src/core/LiquidityVault.sol` (ADR-0034) depends on these vendor internals:

- `__liquidityTree_init`, `_nodeAddLiquidity`, `_nodeWithdrawPercent` and `nodeWithdrawView`;
- `_addLimit`, which handles k = 0 profit and keeps the vendor preview;
- `_push` followed by `_pushLazy`, which handle k > 0 allocation. They run without the preview, which is proved
  unreachable there under tree invariant I;
- the storage `treeNode`, `nextNode` and `updateId`, and the constants `LIQUIDITYNODES` and `LIQUIDITYLASTNODE`;
- the integer split rule of `_push`, which `_prefixCovers` replays read-only.

## Changing or re-pinning these files

Any change to these files must follow the same procedure as the two patches above:

1. Record it as its own reversible patch.
2. Update `MANIFEST.sha256`, the hash table above and the pin in `test/unit/AzuroTreeProperties.t.sol`.
3. Run `make tree-equivalence-release`, which runs these suites under the release profile (4,096 fuzz runs):
   - `AzuroRangeSumEquivalence`;
   - `AzuroUnusedSuffixEquivalence`;
   - `LiquidityVaultPrefixCapitalTest`, for prefix replay and settlement equivalence;
   - `LiquidityVaultChainedDifferential`;
   - `AzuroTreeProperties`.

   Also run the root and unused-suffix invariants in `BankInvariants` under the nightly profile.

   Only `AzuroUnusedSuffixEquivalence` and the hash pin can see an error inside a patched function. The other
   suites run the same patched code on both sides of their comparison.
4. Requalify the first-callback gas certificate. Any bytecode change voids it.

`MANIFEST.sha256` pins the applied source files and both patches. Check it from this directory with
`shasum -a 256 -c MANIFEST.sha256`. Production imports use this directory, not ignored research artifacts.

## Licensing

Original GPL-3.0 source identifiers are retained. These files are not relicensed under the surrounding project's
license. The unmodified GPL-3.0 text is in `LICENSE` (source: https://www.gnu.org/licenses/gpl-3.0.txt).

## Scope

The project adapter lives in `src/core/LiquidityVault.sol`, and its deliberate adaptations are defined in
`docs/adr/0034-nft-liquidity-deposits.md`. This directory pins the tree only. It does not pin Azuro's complete
Core or qualify its production deployment, and local tree tests alone do not validate our custody or callback
integration.
