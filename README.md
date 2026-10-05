# PinDash

PinDash is a professional Pinterest publishing dashboard built against Pinterest API v5. The first milestone is a review-ready MVP: authenticate, connect Pinterest with OAuth, list boards, upload an image, explicitly approve a Pin, publish it once, and display the verified result.

## Architecture

```text
Browser → Next.js web → NestJS API → PostgreSQL
                           ├──────→ Redis/BullMQ → Worker
                           ├──────→ S3-compatible media storage
                           └──────→ Pinterest API v5
```

The API owns authorization, OAuth credentials, publishing state, and all Pinterest calls. The browser never receives Pinterest secrets. Immediate and scheduled publication will share the worker path to ensure consistent idempotency and recovery.

## Workspace layout

```text
apps/web       Next.js frontend
apps/api       NestJS/Fastify REST API
apps/worker    BullMQ publishing worker
packages/contracts  shared schemas and types
packages/database   Prisma schema and client
docs/           architecture and engineering decisions
```

## Prerequisites

- Node.js 22 LTS
- npm 10+
- Docker Desktop with Compose

## Local setup

```bash
cp .env.example .env
npm install
npm run dev:infra
npm run db:generate
npm run db:migrate
npm run dev
```

Local services:

- Web: http://localhost:3000
- API: http://localhost:4000/api/v1
- API health: http://localhost:4000/api/v1/health
- MinIO console: http://localhost:9001

## Quality checks

```bash
npm run check
npm run build
```

## Security baseline

- OAuth exchanges occur only in the API.
- Access and refresh tokens will use envelope encryption.
- Mutating publishing requests require an idempotency key.
- Every Pin must have an immutable user-approval snapshot.
- Logs must redact credentials, OAuth codes, tokens, and signed media URLs.
- Development, staging/Sandbox, and production credentials remain separate.

See [docs/architecture.md](docs/architecture.md) and [docs/decisions](docs/decisions) for the detailed design.

For the zero-cost hosted database and media configuration, see
[docs/supabase-free-deployment.md](docs/supabase-free-deployment.md) and
[.env.supabase.example](.env.supabase.example).
