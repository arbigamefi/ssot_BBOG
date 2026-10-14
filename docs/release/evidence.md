# Evidence index

Release, audit and review evidence is produced under the git-ignored `dist/` and then archived; the repository
records where it is and what its bytes are. This file and [`evidence-index.sha256`](evidence-index.sha256) are the
index. Git history is the archive of everything that was committed; this index covers what never was.

## Where the evidence is

The archive root is `~/arbigamefi-archive/` on the Owner's workstation. Each dated folder holds tarballs whose member
paths keep their repository prefix (`dist/`, `deployments/`, `broadcast/`), a per-member manifest
(`*MANIFEST.sha256`) and, where useful, a list of top-level paths (`*PATHS.txt`). `evidence-index.sha256` lists the
SHA-256 of every file under the archive root.

**Durable copy: pending.** The root exists only on that workstation's disk. The Owner copies the whole root to
storage of their choice and records the date and location here; until then a disk failure loses the unpublished
evidence. Some members must stay private: `deployments.tar.gz` contains `deployments/base-sepolia-v16.env`,
`deploy-copy-1b7419bca.tar.gz` contains `deploy-params.env`, and logs from before 2026-09-27 may contain RPC keys.
Store and share the archives accordingly.

| Folder                         | Contents                                                                                                                                                                                                                                                                                |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `2026-10-11-superseded/`       | Material moved out of `dist/`, `deployments/` and `broadcast/` after the 1b7419bca deployment: 68 top-level paths, 8,621 files and 5 symlinks (`README.md`, `PATHS.txt`)                                                                                                                |
| `2026-10-11-clean-slate/`      | The clean slate of launch candidate §4: all git refs (`all-refs-2026-10-11.bundle`, 25 refs, complete history), the remaining `dist/` (2,545 files), `deployments/` (28 files), the isolated deploy copy of 1b7419bca (3,605 files) and the uncommitted worktree changes (`worktrees/`) |
| `2026-10-11-post-clean-slate/` | Evidence made after the clean slate: the launch candidate plan review, the B0 design reviews and the external pre-review package (117 files)                                                                                                                                            |
| `2026-10-12-freeze/`           | The launch candidate's freeze run on `1a5e9df00` with certificate v5 (`dist/freeze-2026-10-12/`, the 249 files of its seal; the matrix's isolated build output is left out)                                                                                                      |
| `2026-10-12-certificate-v5-review/` | Freeze delta 1 (`dist/freeze-2026-10-12-delta-1/`, commit `56527403e`) and the certificate v5 review package (`dist/certificate-v5-review-2026-10-12/` and its tarball), 36 files |
| `2026-10-14-audit-delivery/` | Freeze delta 2 (`dist/freeze-2026-10-12-delta-2/`, commits `0be336e40`–`fcbb2ad61`), the source audit package of `fcbb2ad61` and the launch candidate's external audit delivery (`dist/external-audit-delivery-2026-10-14/` and its tarball), 41 files |
| `2026-10-14-mainnet-certificate-inputs/` | The Base mainnet inputs for the first-callback certificate: provider and USDC readings, the code comparison with Base Sepolia, the token bound repriced on the mainnet runtimes and a draft domain file (`dist/mainnet-certificate-inputs-2026-10-14/`), 36 files |
| `2026-10-14-audit-addendum-1/` | Freeze delta 3 (`dist/freeze-2026-10-12-delta-3/`, commits `15470d28c`–`39da7a67a`: off-chain code, workflows and documents only), the source audit package of `39da7a67a` and external audit addendum 1 (`dist/external-audit-addendum-1-2026-10-14/` and its tarball), 30 files |

## Verify

All archive files against the index, from the archive root:

```sh
cd ~/arbigamefi-archive
shasum -a 256 -c /path/to/repository/docs/release/evidence-index.sha256
```

Every member of one archive, after extracting it into a new, empty directory:

```sh
mkdir /tmp/restore-dist && cd /tmp/restore-dist
tar -xzf ~/arbigamefi-archive/2026-10-11-clean-slate/dist.tar.gz
shasum -a 256 -c ~/arbigamefi-archive/2026-10-11-clean-slate/dist.MANIFEST.sha256
```

The superseded manifest also records its 5 symlinks as `link  <path> -> <target>` lines, which `shasum` reports as
5 improperly formatted lines; the symlinks point at absolute paths of the original workstation. Extract one item
only with `tar -xzf <archive> <member path>`. The bundle: `git bundle verify <bundle>` inside any clone, then
`git clone <bundle>` or `git fetch <bundle> 'refs/*:refs/archived/*'`.

### Restore drill, 2026-10-11

| Archive                                                                     | Method                                                                                                | Result                                 |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------- |
| all 21 files under the root                                                 | `shasum -a 256 -c evidence-index.sha256`                                                              | 21 OK                                  |
| `2026-10-11-superseded/superseded-2026-10-11.tar.gz`                        | extracted into a new directory, `shasum -c`                                                           | 8,621 OK; 5 symlink lines, as expected |
| `2026-10-11-clean-slate/dist.tar.gz`                                        | extracted into a new directory, `shasum -c`                                                           | 2,545 OK                               |
| `2026-10-11-post-clean-slate/dist.tar.gz`                                   | extracted into a new directory, `shasum -c`                                                           | 117 OK                                 |
| `2026-10-12-freeze/dist.tar.gz` (2026-10-12)                                | extracted into a new directory, `shasum -c`                                                           | 249 OK                                 |
| `2026-10-12-certificate-v5-review/dist.tar.gz` (2026-10-12)                 | extracted into a new directory, `shasum -c`                                                           | 36 OK                                  |
| `2026-10-14-audit-delivery/dist.tar.gz` (2026-10-14) | extracted into a new directory, `shasum -c` | 41 OK |
| `2026-10-14-mainnet-certificate-inputs/dist.tar.gz` (2026-10-14) | extracted into a new directory, `shasum -c` | 36 OK |
| `2026-10-14-audit-addendum-1/dist.tar.gz` (2026-10-14) | extracted into a new directory, `shasum -c` | 30 OK |
| `2026-10-11-clean-slate/deployments.tar.gz`, `deploy-copy-1b7419bca.tar.gz` | members hashed in memory against their manifests, never written to disk (they hold environment files) | 28 and 3,605 equal, none unlisted      |
| `2026-10-11-clean-slate/all-refs-2026-10-11.bundle`                         | `git bundle verify`                                                                                   | complete history, 25 refs              |

## Sealed evidence

The seal of each evidence directory is a manifest inside it; its own SHA-256 is what reports cite. Relative paths
are archive member paths.

| Evidence                                        | Archive                        | Seal                                                                  | SHA-256                                                            |
| ----------------------------------------------- | ------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Independent audit of 1b7419bca                  | clean-slate `dist.tar.gz`      | `dist/independent-audit-2026-10-10/MANIFEST.sha256`                   | `864b383f17af6755ecbb0aeef9888443b6109c80f0e6fbaf978f8153abc886a4` |
| Fix review 1                                    | clean-slate `dist.tar.gz`      | `dist/independent-audit-2026-10-10/fix-review/MANIFEST.sha256`        | `fceaf5fe5fe270ac3993667ee858a208bc27c456a1478f6d263de1c84629050f` |
| Fix review 2                                    | clean-slate `dist.tar.gz`      | `dist/independent-audit-2026-10-10/fix-review-2/MANIFEST.sha256`      | `c9f4f4d19433b017510fe2724f874f46cb7d045b8f84470d8715887048da447d` |
| Fix review 3                                    | clean-slate `dist.tar.gz`      | `dist/independent-audit-2026-10-10/fix-review-3/MANIFEST.sha256`      | `ea540b0823d08ae88072101f23264c83ff12d1f262a21b1ab2609f010e8039a6` |
| External audit delivery r2                      | clean-slate `dist.tar.gz`      | `dist/external-audit-delivery-2026-10-10-r2.tar.gz`                   | `7cdf82498b4fbc5c9d3c6dfd9d56afaa305851c69b28d60c1e8246a033f46d43` |
| Architecture decision freeze                    | clean-slate `dist.tar.gz`      | `dist/architecture-decision-freeze-2026-10-08/MANIFEST.sha256`        | `59bf47f203f250b5a2f301eacfe81a3c9dc8d7f2d08c2b077fda6a76a0b1da8a` |
| Freeze v9 (252 frozen files)                    | clean-slate `dist.tar.gz`      | `dist/freeze-2026-10-08/FREEZE_MANIFEST-v9.sha256`                    | `c29bd4332802bf52937ccdaac47ba7345bc6a1853670b729221a007bf9e5ca6e` |
| Freeze v9 commit record                         | clean-slate `dist.tar.gz`      | `dist/freeze-2026-10-08/EVIDENCE-v9-commit.sha256`                    | `784a1bf6784cadfc6c0c3164706eab73af2d21bc7d1844eb2bc7b2172346fa82` |
| Certificate v4 review                           | clean-slate `dist.tar.gz`      | `dist/independent-review-certificate-v4-2026-10-08/MANIFEST.sha256`   | `d6c1619c1ea0d3414c5609ee34cc5520d8c89740b52b1c54115b73372784eb85` |
| Certificate v4 landing and errata               | clean-slate `dist.tar.gz`      | `dist/landing-2026-10-08/EVIDENCE-r3.sha256`                          | `0a00c87e440f0efb96d7d5ba9cd592f2065a13ec461def2eeb1e42b0d14ec76e` |
| Fresh Base Sepolia preflight r2                 | clean-slate `dist.tar.gz`      | `dist/fresh-deploy-preflight-2026-10-10-r2/EVIDENCE.sha256`           | `9997c01666ae53d1f3811a74d3a1624069a38232b619375471a160f7b17f2ba6` |
| 1b7419bca deployment and acceptance (abandoned) | clean-slate `dist.tar.gz`      | `dist/deploy-1b7419bca-2026-10-10/EVIDENCE-post-acceptance.sha256`    | `0f5c75e016ee87b5acd43d1fb2cc21298c48608bc23fa7eb48a6275bb32fb6d0` |
| Retirement of the 2026-10-02 deployment         | clean-slate `dist.tar.gz`      | `dist/retire-2026-10-02-deployment/EVIDENCE-post-execution.sha256`    | `7ef08b92e7d4a8024d2a3631df2f69570ebfcbd4d63413ac858a0f18876d9310` |
| Launch candidate plan review                    | post-clean-slate `dist.tar.gz` | `dist/independent-review-launch-candidate-2026-10-11/MANIFEST.sha256` | `6dfae1498f63077da0923ef04407148c38fb569d6b3021745819219a6dfdbaa5` |
| B0 design review                                | post-clean-slate `dist.tar.gz` | `dist/independent-review-b0-2026-10-11/MANIFEST.sha256`               | `71de1eb573020ab674bbd30aaac3d89bf0f7dea46472583c00ef59fdd1ae7ac1` |
| B0 design review r2                             | post-clean-slate `dist.tar.gz` | `dist/independent-review-b0-2026-10-11/r2/MANIFEST.sha256`            | `6c9ffcee957885c20881eae03b9427b51bafa8d6a83073079554f24caf691c6d` |
| External pre-review package (B0)                | post-clean-slate `dist.tar.gz` | `dist/external-prereview-b0-2026-10-11.tar.gz`                        | `850d34d7bfe4a58df9c898986f44c9fef72b4053a63c526a21648e8ffc33218f` |
| Freeze run of the launch candidate (`1a5e9df00`) | 2026-10-12-freeze `dist.tar.gz` | `dist/freeze-2026-10-12/EVIDENCE.sha256`                              | `9290496745124977e01669ae90e7b78b64e618631a7478861dbda2e12d0bf4f2` |
| Certificate v5                                  | 2026-10-12-freeze `dist.tar.gz` | `dist/freeze-2026-10-12/certificate/MANIFEST.sha256`                  | `5726389a84ea2348d3801328914e2cbf85354314bde83466cbce9d078f79f674` |
| Freeze delta 1 (`56527403e`)                    | 2026-10-12-certificate-v5-review `dist.tar.gz` | `dist/freeze-2026-10-12-delta-1/EVIDENCE.sha256`        | `476b63d8234af1a1a2b251e54d83b69b1a5e54e5d1c3cd4473fdb91cf4aa773c` |
| Certificate v5 review package                   | 2026-10-12-certificate-v5-review `dist.tar.gz` | `dist/certificate-v5-review-2026-10-12.tar.gz`          | `267e4de506e2e116dfbff1f884d9d2e840e2016199d791d46f50779ad2ef7c4b` |
| Freeze delta 2 (`fcbb2ad61`) | 2026-10-14-audit-delivery `dist.tar.gz` | `dist/freeze-2026-10-12-delta-2/EVIDENCE.sha256` | `d9bde3251031555d3d9cae02bd8a62e42599aabcc261b09baa8ed5aed8458fbf` |
| External audit delivery (launch candidate) | 2026-10-14-audit-delivery `dist.tar.gz` | `dist/external-audit-delivery-2026-10-14.tar.gz` | `774a0d0027b8da3021321817e8bd63d20733d2ac730c0959f3d05363108fc7d4` |
| Base mainnet certificate inputs | 2026-10-14-mainnet-certificate-inputs `dist.tar.gz` | `dist/mainnet-certificate-inputs-2026-10-14/EVIDENCE.sha256` | `e6d56207415da3f1a8e1a8de765e742b89ca5bf6dba541f305b95444a82b272f` |
| Freeze delta 3 (`39da7a67a`) | 2026-10-14-audit-addendum-1 `dist.tar.gz` | `dist/freeze-2026-10-12-delta-3/EVIDENCE.sha256` | `eeb7f844d40cc442c2c8b453d09c7c9375881baecfbb5a1eb326137e2d84e8c7` |
| External audit addendum 1 | 2026-10-14-audit-addendum-1 `dist.tar.gz` | `dist/external-audit-addendum-1-2026-10-14.tar.gz` | `751a948a6bac4ef94b57db4c580a59133da5fc018ddc76afeed74ea97179a376` |

Certificate v5 reproduces with `python3 script/certificate/certify.py <new directory>` on a checkout of `1a5e9df00`
(`docs/audit/first-callback-gas-certificate-2026-10-07.md`, section 8). Certificate v4 reproduces from these archives
with `python3 script/certificate/reproduce_first_callback_v4.py` on a
checkout of commit `4a5762aa3`, the last one with the v4 contracts (see the certificate's section 8).

## Deleted GitHub releases and tags

Deleted on 2026-10-11 (launch candidate §4, item 6). The assets are members of the clean-slate `dist.tar.gz`.

| Tag                             | Commit                                     | Asset                                                               | SHA-256                                                            |
| ------------------------------- | ------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `base-sepolia-v16-20261002`     | `5efbb07cd991b61b8074be7d1a3803b5dba46392` | `dist/ssot-release-chain-84532-47577983-0x7e7c13d4.tar.gz`          | `b04832d239610b7fa6eedfecffea91ae473684d4e6358e8c0fb70563080e8499` |
| `v1.6.0-base-sepolia-1b7419bca` | `1b7419bca85c3f1397f42da489be5d53b7ef282a` | `dist/ssot-release-v1.6.0-base-sepolia-1b7419bca-0x7b7764be.tar.gz` | `e3432dcbea16a0bb2dce10a6097f82f72c882f46c632c8a8eb08ab76e8763016` |
| `v1.6.0-base-sepolia-3e36a4bfc` | `3e36a4bfc390a2a3ab0051e17f74903149914a8c` | `dist/ssot-release-v1.6.0-base-sepolia-3e36a4bfc-0x7b7764be.tar.gz` | `9744d9284f9f8df755c102577c6892b08a60719fb6066e34324844aa60502db8` |

The commits remain in the repository history and in the bundle. The 16 deleted local branches and the stash are in
the bundle as well. So is `k0-4/config-drift-alerts` (head `15761dbc8d10f029d1c45ec6c8871709bd4d9724`, one commit, not in
`master`), deleted locally and on GitHub on 2026-10-14 after A11 rebuilt the monitor on `master`.

## Freeze procedure

These rules govern the launch candidate's freeze, certificate v5 and every later freeze (freeze sign-off FZ-9,
review S-11, fix review 3 W-1(3)).

1. A freeze names a commit, its tree, a manifest of every frozen file with its SHA-256, the toolchain in
   `deps.lock`, and each gate run (CI run IDs, local logs) with the counts it reported.
2. A sealed evidence directory is never changed. A correction or a rerun goes into a new directory that names the
   one it supersedes.
3. Changing a frozen file after a gate ran on it needs a freeze delta: the diff, or the copy as frozen, of each
   changed file; the new manifest; and, for every gate whose result is carried over, why the change cannot affect
   it. Results from before and after a delta are never added together.
4. A delta that changes only workflow files names, for each file, the run that executed it after the change. Local
   gates do not read workflows, so they are no evidence for such a delta.
5. Within a day of being sealed, new evidence is archived into a new dated folder under the archive root (a tarball
   with its repository prefix, a per-member manifest, and a restore check), its files are added to
   `evidence-index.sha256`, and a row is added here. The Owner then refreshes the durable copy.

`script/release/run_freeze.sh` performs rule 1 for the local gates on a clean worktree: it records the commit, its
tree and a manifest of every tracked file, checks the manifest between groups of stages, runs the regression,
nightly, tree, admission, certificate-tool and ops gates, the fork gates (the 137-case callback matrix, the void
branch with the pinned USDC, the direct wrapper) and computes the first-callback certificate on the same tree
(`script/certificate/certify.py`). It runs through `script/tools/with-ops-rpc.sh alchemy base-sepolia` and removes the
endpoint from every log it writes. The GitHub runs at the same commit are recorded next to its output.
