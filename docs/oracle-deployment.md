# Oracle VM deployment

This runbook deploys the PinDash API and BullMQ worker to one Ubuntu VM. Caddy
terminates HTTPS for `api.comparatif-devis.fr`; the worker remains private.
Supabase provides PostgreSQL and private object storage, and Upstash provides
Redis.

## 1. Create the VM and DNS

1. Create an Ubuntu VM in Oracle Cloud. An Ampere A1 instance is supported by
   the multi-architecture Node image.
2. In the Oracle network security list, allow inbound TCP `22`, `80`, and `443`.
   UDP `443` is optional for HTTP/3.
3. In Cloudflare DNS, create an `A` record named `api` pointing to the VM's
   public IPv4 address. Use **DNS only** until Caddy has issued its certificate.
4. Never send or commit the SSH private key. Keep it on the administrator's
   computer with restrictive file permissions.

## 2. Install the runtime

Connect over SSH, then install Docker and the Compose plugin:

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2 git
sudo systemctl enable --now docker
```

Clone the repository using an authorized GitHub SSH key or credential helper.
Do not place a GitHub token directly in the clone URL.

```bash
git clone https://github.com/yakuza-scusa/PinDash.git
cd PinDash
cp .env.oracle.example .env.production
chmod 600 .env.production
nano .env.production
```

Fill every required value in `.env.production`. Use the existing Supabase,
Upstash, Pinterest, and Resend credentials. Generate fresh production-only
values for `SESSION_SECRET` and `TOKEN_ENCRYPTION_KEY`.

## 3. Start and verify

```bash
sudo docker compose -f compose.production.yml up -d --build
sudo docker compose -f compose.production.yml ps
curl --fail https://api.comparatif-devis.fr/api/v1/health/ready
```

Both `api` and `worker` must be running and the API must report ready. Caddy
stores and renews its TLS certificates in Docker volumes. The Compose services
run as an unprivileged user with a read-only filesystem and no Linux
capabilities.

Useful operational commands:

```bash
sudo docker compose -f compose.production.yml logs --tail=100 api worker caddy
git pull --ff-only
sudo docker compose -f compose.production.yml up -d --build
```

Logs must never be copied into tickets without checking them for personal data.

## 4. Connect the public web application

Set this Netlify production variable and redeploy the web application:

```env
NEXT_PUBLIC_API_URL=https://api.comparatif-devis.fr/api/v1
```

Add this exact URI to the Pinterest application's redirect URI list:

```text
https://api.comparatif-devis.fr/api/v1/pinterest/oauth/callback
```

After HTTPS and OAuth work, the Cloudflare record may be proxied. Keep TLS mode
set to **Full (strict)**.

## 5. Production acceptance

- Sign in through the public Netlify application and verify the secure session.
- Connect the Trial Pinterest account and load its boards.
- Upload an owned image, approve it, and publish one Trial Pin.
- Confirm the Pinterest Pin ID in history.
- Test token refresh, disconnection, export, and workspace deletion.
- Configure external uptime checks and encrypted database exports before
  treating the environment as production.
