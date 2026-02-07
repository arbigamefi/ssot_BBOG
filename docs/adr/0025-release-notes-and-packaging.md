# ADR-0025: Release notes MUST reference the release digest

## Context

ADR-0024 introduces a deterministic **release digest** (a deployment lock) derived from a deployment snapshot.
In practice, operators and auditors consume **human-facing release notes** (GitHub release description, internal memos,
incident response docs).

If release notes do not reference the digest, a reader cannot unambiguously link the notes to a specific locked
deployment. This enables silent "notes drift" (notes edited later without changing the locked artifact), which is
unacceptable for institution-grade operations.

## Decision

1. Every production release MUST have release notes that explicitly include the **release digest**.
2. The repository provides a deterministic notes generator:
   - `make release-notes` (`script/release/GenerateReleaseNotes.s.sol`) which embeds the digest.
3. The strict release gate MUST enforce notes/digest consistency:
   - `STRICT=1 make release-check` requires the notes file and asserts it contains the digest.
4. For audit/ops handoff, the repository provides a single-file bundle:
   - `make release-package` (`script/release/package_release.sh`).

## Consequences

- A release cannot be considered complete unless:
  - snapshot exists,
  - release lock exists and signature validates,
  - release notes exist and reference the digest.
- CI can enforce this by running `STRICT=1 make release-check` on tags.
- Operators can hand auditors a single archive from `make release-package`.

## Alternatives considered

1. **Rely on git tags only** — rejected; tags do not encode chain addresses/parameters.
2. **Put the digest only in the artifact JSON** — rejected; release notes are the primary human artifact.
3. **Manually copy/paste digest into notes** — allowed but error-prone; generator + strict gate are safer.
