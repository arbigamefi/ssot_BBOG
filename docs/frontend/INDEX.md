# Frontend Engineering Quality SSOT — Index

This directory hosts **engineering-quality SSOT** (a11y, i18n, performance,
security, testing, observability, build, governance, AI-pairing) alongside the
existing release-artifact contract in [`README.md`](./README.md).

For visual / product SSOT (brand, voice, tokens, components), see
[`../design/`](../design/).

The older planning files under `frontend/docs/frontend/` are historical
references for the pre-clean-room frontend. They are not active SSOT unless a
document in `docs/design/` or `docs/frontend/` explicitly cites them.

Most commands in Layer 3/4 are target-state enforcement contracts. If the script
or CI job does not exist yet, the related gate cannot close until it is
implemented.

## Layer 3 · Engineering Quality

- [`20-accessibility.md`](./20-accessibility.md)
- [`21-i18n.md`](./21-i18n.md)
- [`22-performance.md`](./22-performance.md)
- [`23-security.md`](./23-security.md)
- [`24-testing.md`](./24-testing.md)
- [`25-observability.md`](./25-observability.md)

## Layer 4 · Governance & Workflow

- [`30-build-and-release.md`](./30-build-and-release.md)
- [`31-governance.md`](./31-governance.md)
- [`32-ai-pairing.md`](./32-ai-pairing.md)

## Gates

Layer 3 documents must reach `Status: Accepted` before public launch. The
overall gate definition is in `../design/README.md`.
