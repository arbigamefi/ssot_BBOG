# ADR-004: Transaction Pipeline (Plan → Simulate → Stepper → Receipt → Reconcile)

## Context
Writes are multi-step (approve → execute) and payable (VRF fee). We need deterministic UX and auditability.

## Decision
All write actions MUST use a unified pipeline:
- `plan*()` produces steps + preview
- `simulate` before each step
- Stepper UI executes steps explicitly
- On receipt, reconcile with events
- Record a journal entry bound to release digest

## Consequences
- Higher up-front engineering, lower incident rate and support load
