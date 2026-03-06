# ADR-005: Custom Errors → DomainError Mapping

## Context
SSOT contracts use custom errors. Raw selectors are not user-friendly and harm audit clarity.

## Decision
SDK decodes revert data and maps to `DomainError { code, message, severity, retryable, details }`. UI MUST only render DomainError.

## Consequences
- Requires ABI availability in SDK layer
- Enhances support & incident triage
