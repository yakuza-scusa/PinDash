# Architecture

## Context

PinDash publishes user-approved content through Pinterest API v5. The system is designed as a modular monolith with an independently deployed worker. This keeps the MVP operationally simple without coupling time-sensitive jobs to web requests.

## Components

### Web application

The Next.js application renders the dashboard and public legal pages. It communicates only with the PinDash API and object-storage upload URLs. It does not call Pinterest directly.

### API

The NestJS API owns sessions, workspace authorization, Pinterest OAuth, board reads, draft state, approval snapshots, upload intents, and publication commands. Every route is versioned under `/api/v1`.

### Worker

The worker executes immediate and scheduled publication jobs. It validates the approved version, obtains a lock, refreshes the OAuth token when necessary, calls Pinterest, records the outcome, and emits notifications.

### Database

PostgreSQL is the source of truth. Redis is transport and transient coordination only; a lost Redis job must be recoverable from PostgreSQL state.

### Media storage

Private S3-compatible storage holds original uploads. Short-lived signed URLs support previews and controlled Pinterest ingestion. Production storage must use distinct credentials and server-side encryption.

## Key flows

### Pinterest connection

1. API creates a short-lived, one-use OAuth transaction.
2. User authorizes on Pinterest.
3. API verifies state and exchanges the code server-side.
4. Tokens are encrypted before persistence.
5. Connection metadata is returned without credentials.

### Publication

1. User creates or edits a draft.
2. User explicitly approves the current draft version.
3. API writes an immutable snapshot and an idempotent publication job.
4. Worker validates the snapshot and publishes once.
5. Result and Pinterest Pin ID are persisted and shown in history.

## Trust boundaries

- Browser input is untrusted.
- Uploaded media is untrusted until inspected and scanned.
- Pinterest responses are untrusted external input.
- Queue messages contain identifiers, not credentials or full content.
- Workspace membership is verified at every resource boundary.

## Deployment topology

Deploy `web`, `api`, and `worker` as separate services. Use managed PostgreSQL, managed Redis, S3/R2, a secrets manager, centralized structured logs, error reporting, and an uptime monitor. Staging uses Pinterest Sandbox/Trial credentials; production uses Standard-access credentials.
