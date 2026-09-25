# Contributing

Thank you for contributing.

This repository is **SSOT-governed**: changes are only accepted if they preserve the constitution and the executable invariants.

## Core rules

1. **Update SSOT first.**
   - Identify the applicable clauses in the router/pool specifications (`docs/constitution/SSOT.v1.3.md` and `docs/constitution/ExecutableSSOT.v1.3.md`) and document behavioral changes with their tests/ADR. Current deployment and disclosure scope is indexed in `docs/release/STATUS-v1.5.zh-CN.md`; historical version numbers are not a claim of v1.5 implementation parity.
2. **Add/adjust ADRs for architectural changes.**
   - Add a new file under `docs/adr/` using the ADR format in `docs/adr/README.md`.
3. **Tests are non-negotiable.**
   - Unit tests for the new behavior.
   - Invariants remain green (or are extended with explicit rationale).

## Development

Install dependencies:

```bash
make deps
```

Run tests:

```bash
forge test
forge test --match-path "test/invariants/*" -vvv
```

## Style & conventions

- Prefer **custom errors** over revert strings.
- Keep module boundaries strict:
  - `Bank` MUST NOT import `Hub`/`VRFHub`/modules (use interfaces).
  - `modules/*` MUST NOT import `core/*`.
- Use deterministic, replayable logic. Avoid time-dependent behavior unless explicitly part of the SSOT.

## Pull requests

- Include a summary, threat analysis, and SSOT impact.
- Link to relevant ADR(s).
- Ensure CI passes.
