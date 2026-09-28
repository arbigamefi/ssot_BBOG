# ADR-NNNN · &lt;Short Title&gt;

| Status | Draft \| Proposed \| Accepted \| Superseded \| Withdrawn \| Deprecated |
| Date | YYYY-MM-DD |
| Owner | &lt;name / role&gt; |
| Reviewers | &lt;names / roles&gt; |
| Supersedes | (optional) ADR-NNNN |
| Superseded by | (optional) ADR-NNNN |
| Affects | (list SSOT documents this change touches) |

## 1. Context

Describe the situation that prompts this decision. Cite evidence: code
paths, audit findings, RUM data, support tickets, etc. Keep this section
factual; opinions belong in §3.

## 2. Decision

A single declarative sentence stating what is being decided.

> Example: Product UI uses the shared design tokens for colors and spacing.

## 3. Rationale

Explain why this decision was chosen over alternatives. Bullet form is
encouraged.

## 4. Alternatives Considered

| Alternative | Pros | Cons | Why not chosen |
| ----------- | ---- | ---- | -------------- |
| Option A    | ...  | ...  | ...            |
| Option B    | ...  | ...  | ...            |

## 5. Consequences

Positive:

- ...

Negative:

- ...

Neutral:

- ...

## 6. Implementation and Validation

Identify the implementation entry points and the rules each must preserve.
Describe the relevant checks and their evidence. Distinguish required checks
from checks that have actually run; do not infer deployment status from an ADR.

## 7. SSOT Documents Affected

- `docs/design/<doc>.md` — what changes here
- `docs/frontend/<doc>.md` — what changes here

## 8. Acceptance Criteria

- [ ] Implementation merged.
- [ ] SSOT documents updated.
- [ ] Tests cover the new state.
- [ ] CI rule (if applicable) lands.
- [ ] Failure behavior and recovery boundaries documented.

## 9. References

- Link to related issues / PRs / RFCs / external standards.

---

**Notes for ADR authors**

- Number ADRs monotonically across the entire `docs/design/adr/` directory.
- Once `Status: Accepted`, do not edit substantively — supersede with a
  new ADR instead.
- Keep ADRs short and self-contained. If a section grows beyond one
  screen, it probably belongs in an SSOT document.
- Link ADRs from the affected SSOT documents (`Supersedes:` / "Last
  Updated" with ADR number) so future readers find the reasoning.
