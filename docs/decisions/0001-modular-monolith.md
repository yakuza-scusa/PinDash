# ADR 0001: Modular monolith with an independent worker

- Status: accepted
- Date: 2026-09-30

## Decision

Use one TypeScript monorepo with a NestJS API, Next.js web application, and an independently deployed BullMQ worker. Share contracts and database tooling through workspace packages.

## Rationale

This structure gives the MVP clear security and deployment boundaries without the coordination overhead of microservices. Publication workers can scale and restart separately from interactive traffic.

## Consequences

- Domain boundaries must be maintained in code review.
- PostgreSQL remains the authoritative state store.
- API and worker releases must remain schema compatible during rollout.
