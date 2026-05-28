# Deploy backend API

`ducpt.com` is currently a GitHub Pages site, so it cannot run the Node/Express API. Keep the sales page at:

```text
https://ducpt.com/image/
```

Run the backend on a Node host and point this subdomain to it:

```text
https://api.ducpt.com
```

## Required environment variables

Set these on the backend host only. Do not put them in the Electron app or GitHub Pages.

```env
NODE_ENV=production
DATA_DIR=/var/data
JWT_SECRET=<long random secret>
JWT_EXPIRES_IN=7d
ADMIN_EMAIL=<admin email>
ADMIN_PASSWORD=<admin password>
ALLOW_LOCAL_ADMIN=false
ROUTER_IMAGE_ENDPOINT=<old 9router image endpoint>
ROUTER_API_KEY=<old 9router api key>
SITE_IMAGE_URL=https://ducpt.com/image
```

Optional:

```env
ROUTER_QUOTA_ENDPOINT=<9router quota endpoint>
SHEETS_WEBHOOK_URL=<google apps script webhook>
SECURITY_ALERT_WEBHOOK_URL=<alert webhook>
ADMIN_ALERT_EMAIL=hoangvant77internet@gmail.com
```

## Render setup

1. Create a new Render Blueprint from this GitHub repo.
2. Use `render.yaml`.
3. Fill all `sync: false` env vars.
4. Add custom domain `api.ducpt.com` to the Render web service.
5. In the DNS manager for `ducpt.com`, add the CNAME record Render gives for `api.ducpt.com`.
6. Wait for Render TLS certificate to become active.

## Verify

These must work before sending the user app to customers:

```text
https://api.ducpt.com/healthz
https://api.ducpt.com/api/9router/user/auth/login
https://api.ducpt.com/api/9router/user/images/generations
https://api.ducpt.com/api/9router/admin/users
```

Expected quick checks:

```powershell
Invoke-RestMethod https://api.ducpt.com/healthz
Invoke-WebRequest https://api.ducpt.com/api/9router/user/auth/login -Method Options
```

