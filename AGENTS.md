# PinDash engineering instructions

## Boundaries

- Keep Pinterest credentials and API calls in `apps/api`; never expose secrets to `apps/web`.
- Keep queue consumers in `apps/worker`; do not publish directly from UI handlers.
- Put shared request/response schemas in `packages/contracts`.
- Put database schema and Prisma lifecycle in `packages/database`.
- Preserve workspace isolation in every database query and API route.
- A Pin may be published only from an immutable, explicitly approved content snapshot.

## Quality gates

- Add or update tests for behavior changes.
- Run `npm run check` and `npm run build` before considering a change complete.
- Do not log tokens, authorization codes, secrets, signed URLs, or complete upstream payloads.
- Use UTC for persisted instants and an IANA timezone for user intent.

## Graphify

When `graphify-out/graph.json` exists, use a scoped Graphify query for orientation before broad searches. Verify relevant relationships in source before editing. After changing code, run `graphify update .` when Graphify is available.
