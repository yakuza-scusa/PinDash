# PinDash production domains

PinDash uses dedicated subdomains of `comparatif-devis.fr` so browser sessions
remain first-party across the web application and API.

| Service              | Public address                    | Provider       |
| -------------------- | --------------------------------- | -------------- |
| Web                  | `https://app.comparatif-devis.fr` | Netlify        |
| API                  | `https://api.comparatif-devis.fr` | Container host |
| Authentication email | `auth.comparatif-devis.fr`        | Resend         |

The BullMQ worker is private and does not receive a public hostname.

## Required public configuration

```env
WEB_URL=https://app.comparatif-devis.fr
PUBLIC_API_URL=https://api.comparatif-devis.fr
NEXT_PUBLIC_API_URL=https://api.comparatif-devis.fr/api/v1
PINTEREST_REDIRECT_URI=https://api.comparatif-devis.fr/api/v1/pinterest/oauth/callback
AUTH_EMAIL_FROM=PinDash <login@auth.comparatif-devis.fr>
```

`PUBLIC_API_URL` is the API origin without `/api/v1`; server-generated callback
URLs append that prefix. `NEXT_PUBLIC_API_URL` includes `/api/v1` because the web
client calls versioned endpoints directly.

Secrets such as database credentials, Redis credentials, Pinterest secrets,
email API keys, session secrets, and encryption keys must remain in provider
secret stores and must never be committed.
