# PinDash V1 — Project Checklist

Last updated: 1 October 2026

Use this file as the source of truth for V1 progress. Mark a task complete only after its implementation and relevant validation pass.

## 1. Foundation and architecture

- [x] Create npm workspace monorepo
- [x] Create Next.js web application
- [x] Create NestJS API application
- [x] Create independent worker application
- [x] Create shared contracts package
- [x] Create Prisma database package
- [x] Define PostgreSQL data model
- [x] Add Redis, PostgreSQL, and MinIO Docker Compose configuration
- [x] Add environment variable template
- [x] Add formatting, linting, type-checking, testing, and build scripts
- [x] Document modular-monolith architecture
- [x] Document publication state machine
- [x] Install Docker Desktop on the development machine
- [x] Create local `.env` with secure generated secrets
- [x] Start PostgreSQL, Redis, and MinIO locally
- [x] Generate and apply the initial Prisma migration
- [x] Add seed data for development and demos
- [x] Add continuous integration workflow

## 2. UI system and application routes

- [x] Create PinDash design tokens and responsive UI system
- [x] Create desktop sidebar and mobile navigation
- [x] Create dashboard overview page
- [x] Create calendar page
- [x] Create Pins page
- [x] Create draft list page
- [x] Create media library page
- [x] Create Pinterest connections page
- [x] Create workspace settings page
- [x] Create help and support page
- [x] Create Pin composer page
- [x] Use real Next.js routes instead of anchor placeholders
- [x] Add active navigation states
- [x] Add responsive mobile layouts
- [x] Replace static dashboard metrics with API data
- [x] Replace static Pins and drafts lists with API data
- [x] Add loading skeletons to all data-driven pages
- [x] Add consistent empty, error, offline, and expired-session states
- [x] Complete WCAG 2.2 AA accessibility review
- [x] Add end-to-end browser tests for primary routes

## 3. Application authentication

- [x] Add database-backed session model
- [x] Hash session tokens before database storage
- [x] Add HttpOnly and SameSite session cookies
- [x] Add session authentication guard
- [x] Add current-session endpoint
- [x] Add logout endpoint
- [x] Add development-only owner/workspace bootstrap
- [x] Disable development sign-in in production
- [x] Select production identity provider or passwordless email service
- [x] Implement production sign-in and callback flow
- [x] Implement email verification
- [x] Add session rotation after authentication
- [x] Add CSRF protection to cookie-authenticated mutations
- [x] Add per-IP and per-user authentication rate limits
- [x] Add first-run onboarding and legal acceptance

## 4. Pinterest OAuth and connections

- [x] Create Pinterest OAuth module
- [x] Generate cryptographically secure OAuth state
- [x] Store only the OAuth state hash
- [x] Expire OAuth transactions after 10 minutes
- [x] Prevent reuse of OAuth transactions
- [x] Exchange authorization codes server-side
- [x] Encrypt Pinterest tokens with AES-256-GCM
- [x] Keep tokens and client secret out of browser responses
- [x] Store scopes and token expiry metadata
- [x] Add workspace-scoped connection listing
- [x] Add connected-account UI
- [ ] Add Pinterest Trial App ID and client secret
- [ ] Register the exact OAuth redirect URI in Pinterest Developer Portal
- [ ] Confirm required scopes with the Trial application
- [ ] Complete a real OAuth connection test
- [x] Implement continuous refresh-token rotation
- [x] Refresh access tokens before expiry
- [x] Handle refresh-token race conditions atomically
- [x] Add disconnect endpoint and confirmation dialog
- [x] Remove encrypted credentials on disconnect
- [x] Add revoked, expiring, and refresh-failed UI states
- [x] Add OAuth success, denial, invalid-state, expired-state, and reused-state tests

## 5. Pinterest boards

- [x] Add authenticated board proxy endpoint
- [x] Verify connection ownership before loading boards
- [x] Decrypt access tokens only inside the API
- [x] Load live boards in the Pin composer
- [x] Display Pinterest connection selector
- [x] Display Pinterest board selector
- [x] Add Pinterest bookmark pagination
- [x] Add board search and filtering
- [x] Display board privacy/type metadata
- [x] Add short-lived board caching
- [x] Handle Pinterest 401, 403, 429, and 5xx responses
- [ ] Test board loading with the real Trial account

## 6. Pin drafts and composer

- [x] Add shared Pin draft validation schemas
- [x] Validate title, description, alt text, and destination URL
- [x] Restrict destination links to HTTP and HTTPS
- [x] Allow incomplete drafts before media and board selection
- [x] Add workspace-scoped draft creation endpoint
- [x] Add workspace-scoped draft update endpoint
- [x] Add workspace-scoped draft list endpoint
- [x] Increment draft version when content changes
- [x] Invalidate existing approval when a draft changes
- [x] Connect composer Save Draft action to the API
- [x] Add live title and description preview
- [x] Add title and description character counters
- [x] Load an existing draft into the composer
- [x] Implement debounced autosave
- [x] Connect the Drafts page to the draft API
- [x] Connect the Pins page to publication history
- [x] Add duplicate-draft action
- [x] Add delete-draft action and confirmation
- [x] Add timezone-aware schedule fields
- [x] Add server-side schedule validation

## 7. Media library and uploads

- [x] Define media asset database model
- [x] Create initial media library UI
- [x] Create upload drop-zone UI
- [x] Add upload-intent endpoint
- [x] Generate private S3/MinIO signed upload URLs
- [x] Connect browser upload to object storage
- [x] Validate file signatures instead of extensions alone
- [x] Validate supported MIME types and maximum size
- [x] Validate image dimensions
- [x] Strip EXIF metadata where practical
- [x] Add malware scanning state
- [x] Generate safe previews and thumbnails
- [x] Persist completed media assets
- [x] Connect media library page to the API
- [x] Add unused-media deletion flow
- [x] Add short-lived Pinterest retrieval URLs

## 8. Approval and confirmation

- [x] Define approval snapshot database model
- [x] Create Pin review/confirmation page
- [x] Show account, board, media, text, link, and publish time summary
- [x] Require explicit user confirmation
- [x] Store immutable approved-content snapshot
- [x] Record approver and draft version
- [x] Prevent approval of incomplete or invalid drafts
- [x] Disable double submission
- [x] Add approval audit events
- [x] Add approval state-transition tests

## 9. Pinterest publishing

- [x] Define publication job and attempt database models
- [x] Define published Pin result model
- [x] Define publication statuses
- [x] Create typed Pinterest API client package
- [x] Implement `POST /v5/pins` for image Pins
- [x] Add internal idempotency key generation
- [x] Route immediate publishing through the job queue
- [x] Lock publication jobs to prevent duplicates
- [x] Revalidate approval snapshot before publishing
- [x] Store Pinterest Pin ID and safe result metadata
- [x] Retrieve the Pin after creation to confirm success
- [x] Display publishing progress and result page
- [x] Display safe, actionable publishing errors
- [x] Classify retryable and permanent errors
- [x] Respect `Retry-After` and rate-limit headers
- [x] Add exponential backoff with jitter
- [x] Reconcile unknown outcomes before retrying
- [x] Add dead-letter handling
- [x] Add image-Pin integration tests with sanitized fixtures
- [ ] Complete one real Trial/Sandbox Pin creation

## 10. Scheduling and worker

- [x] Create independent worker application
- [x] Define scheduled job database fields and indexes
- [x] Add BullMQ and Redis connection
- [x] Add scheduler that releases due database jobs
- [x] Add worker job locking
- [x] Implement timezone and daylight-saving conversion
- [x] Add scheduled Pin cancellation
- [x] Add safe retry and reconciliation flow
- [x] Add dead-letter queue
- [x] Connect calendar to scheduled Pin API data
- [x] Add schedule, reschedule, and cancel confirmation dialogs
- [x] Test worker restart and duplicate-prevention behavior

## 11. Notifications and audit

- [x] Define audit-event database model
- [x] Define notification database model
- [x] Record authentication audit events
- [x] Record connection and disconnection audit events
- [x] Record draft, approval, scheduling, and publishing audit events
- [x] Add in-app notification center
- [x] Notify on published, failed, revoked, and action-required states
- [x] Add notification preferences
- [ ] Add optional transactional failure email
- [x] Redact tokens, authorization codes, and signed URLs from logs

## 12. Public pages and compliance

- [x] Create public product landing page
- [x] Create Privacy Policy page on the application domain
- [x] Create Terms of Service page
- [x] Create support page inside the dashboard
- [x] Add public support contact page
- [x] Add Pinterest disconnection instructions
- [x] Add user-data export
- [x] Add account/workspace deletion flow
- [x] Define retention periods
- [x] Create privacy data inventory
- [x] Add Content Security Policy and security headers
- [ ] Add production TLS and HSTS configuration
- [ ] Review Pinterest brand and Developer Guidelines compliance

## 13. Observability and production readiness

- [x] Add structured JSON logging
- [x] Add request correlation IDs
- [x] Add sensitive-data log redaction
- [ ] Add OpenTelemetry traces
- [ ] Add Sentry error reporting
- [x] Add API and worker health checks
- [ ] Monitor OAuth failures and token refresh failures
- [ ] Monitor Pinterest 401, 403, 429, and 5xx responses
- [ ] Monitor queue depth and oldest waiting job
- [ ] Add uptime monitoring
- [ ] Add encrypted database backups
- [ ] Test backup restoration
- [x] Add dependency, secret, and container scanning
- [x] Separate development, staging, and production secrets

## 14. Pinterest Standard-access video

- [ ] Deploy a staging environment on a public HTTPS domain
- [ ] Configure staging Pinterest Trial credentials
- [ ] Prepare an owned demo image and destination URL
- [ ] Verify Privacy Policy, Terms, and support links
- [ ] Rehearse sign-in and complete OAuth flow
- [ ] Rehearse live board loading
- [ ] Rehearse media upload and Pin composition
- [ ] Rehearse explicit review and approval
- [ ] Rehearse one-click Pin publishing
- [ ] Verify the returned Pin ID and history entry
- [ ] Rehearse Pinterest disconnection/data controls
- [ ] Record a clean 3–5 minute demonstration
- [ ] Verify the recording exposes no credentials or personal information
- [ ] Submit the Standard-access application

## 15. Current next milestone

- [x] Install/start PostgreSQL and apply the initial schema
- [ ] Configure Pinterest Trial credentials
- [ ] Test real OAuth and live board loading
- [x] Implement secure image upload
- [ ] Build explicit review and immediate Pin publishing

## Validation record

- [x] Monorepo production build passes
- [x] API TypeScript validation passes
- [x] Web TypeScript validation passes
- [x] Shared contract tests pass
- [x] Token encryption test passes
- [x] All current Next.js routes build successfully
- [x] Runtime database integration tests pass
- [ ] Pinterest Sandbox/Trial end-to-end test passes
- [x] Full approval-MVP browser test passes
