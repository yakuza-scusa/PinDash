# Supabase free-plan setup

Supabase provides PinDash's hosted PostgreSQL database and private media
storage. It does not run the Next.js web process, NestJS API, BullMQ worker, or
Redis queue. Those processes still require a runtime, and BullMQ still requires
a Redis-compatible service.

## 1. Create the Supabase project

1. Create a project near the future API runtime region.
2. Generate and save a strong database password.
3. In **Connect**, copy the **Supavisor Session pooler** URI on port `5432`.
4. Add `sslmode=require&connection_limit=5` to the URI and store it as
   `DATABASE_URL`. URL-encode reserved characters in the password.

Session mode is appropriate for the long-running NestJS API and worker and is
IPv4-accessible on the free plan. Do not expose this URI to the browser.

## 2. Configure private media storage

1. In Storage, create a private bucket named `pindash-media`.
2. Enable the S3 protocol in Storage settings.
3. Generate an S3 access key and secret; save the secret immediately because it
   is displayed once.
4. Configure:

   - `S3_ENDPOINT=https://PROJECT_REF.storage.supabase.co/storage/v1/s3`
   - `S3_REGION` with the project's region
   - `S3_BUCKET=pindash-media`
   - `S3_FORCE_PATH_STYLE=true`
   - the generated `S3_ACCESS_KEY` and `S3_SECRET_KEY`

Keep the bucket private. PinDash produces short-lived previews and controlled
public retrieval links from the API; public bucket access is unnecessary.

## 3. Initialize the hosted database

After placing the Supabase connection URI in the local `.env`, run:

```powershell
npm run db:migrate:deploy
npm run db:seed
```

Before doing this, export the local database if its demo records need to be
preserved. The normal seed is safe for a new empty project.

## 4. Configure the remaining runtime

Use `.env.supabase.example` as the deployment checklist. Supabase does not
replace Redis, so configure a TLS Redis URL for BullMQ. The web, API, and worker
can remain local for the Pinterest Trial video or be deployed to a container
runtime later.

## 5. Validate before Pinterest submission

1. Run the API and worker against Supabase and the hosted Redis service.
2. Upload an owned image and confirm that it is stored in the private bucket.
3. Connect the Pinterest Trial account and load its real boards.
4. Approve and publish one Pin.
5. Confirm a `PublishedPin` record with the returned Pinterest Pin ID.
6. Test token refresh, disconnect, data export, and account deletion.

## Free-plan constraints

- Free projects can pause after inactivity, so the first request after a pause
  may be delayed.
- The free database and storage quotas are suitable for a Trial demonstration,
  not an uptime guarantee.
- Free-plan projects do not include automatic database backups. Export the
  database regularly and before every schema migration.
