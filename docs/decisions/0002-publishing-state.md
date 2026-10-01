# ADR 0002: Database-backed publication state

- Status: accepted
- Date: 2026-09-30

## Decision

Persist every publishing intent, approval snapshot, job, attempt, and result in PostgreSQL. Use Redis/BullMQ for delivery, delay, and worker coordination, not as the source of truth.

## Rationale

Pinterest Pin creation is externally mutating and cannot safely be repeated after an ambiguous timeout. Durable state and idempotency controls are required to avoid duplicate Pins.

## Consequences

- Workers must acquire a durable job lock before calling Pinterest.
- Unknown results require reconciliation rather than blind retry.
- Editing a draft invalidates its prior approval.
