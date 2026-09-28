# Frontend architecture and release data

The workspace contains the Next.js web app, permissionless keeper, shared UI,
contract SDK (`@ssot/ssot`), and durable Postgres bet index (`@ssot/bet-index`).
See the [workspace scripts](../../frontend/package.json) and [engineering index](INDEX.md).

## Release metadata

The application uses the current v1.6 release format. Contract addresses, pool
identities, token decimals, and game IDs come from authenticated release metadata.
The [release schema](../../frontend/packages/ssot/src/release/schema.ts) describes
the normalized data consumed by the SDK and app.

The [embedded registry](../../frontend/packages/ssot/src/release/embedded/index.ts)
currently contains no deployment. Development can render the site without a
release; it cannot use fixture addresses for transactions. The local
[release fixture](../../frontend/packages/ssot/src/fixtures/release-v16.fixture.json)
is test data and must not be registered as a deployment.

To import a real deployment, follow the [v1.6 release guide](../deploy/v16-release.md).
The [sync script](../../frontend/scripts/ssot-sync.mjs) verifies the bundle,
trusted signer, current ABI content, and live governance before writing embedded
metadata. `check:release` checks embedded metadata; the default empty registry
passing that check is not launch readiness. Production checks must require each
intended chain through `REQUIRED_EMBEDDED_CHAIN_IDS` and `STRICT_RELEASE=1`.

## ABI and encoding

[Contract ABIs](../../frontend/packages/ssot/src/abis/contracts) are generated once
from the current Foundry build and shared by web and keeper. The
`@ssot/ssot/abis` entrypoint provides `getContractAbis()` without a chain argument;
there is no per-chain ABI copy.

From the repository root, regenerate after changing contract interfaces:

```bash
forge build
python3 script/release/export_frontend_abis.py --source-only
```

The signed release bundle carries ABI copies for validation against this source.
It does not replace the runtime ABI package. Encoding tests require the current
[golden fixture](../../frontend/packages/ssot/src/fixtures/golden-vectors-v16.fixture.json)
and compare exact bytes. Generate release vectors through the contract release
workflow; do not change expected bytes merely to make an SDK test pass.
