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

For a backend that must keep creating images after the local computer is turned off,
do not use `trycloudflare.com` or any local tunnel URL. Use a server-side provider
endpoint instead:

```env
ROUTER_PROVIDER=openai
ROUTER_IMAGE_ENDPOINT=https://api.openai.com/v1/images/generations
ROUTER_IMAGE_PREFERRED_ENDPOINT=primary-openai
ROUTER_IMAGE_FALLBACK_ENDPOINT=
ROUTER_IMAGE_MODEL=gpt-image-1
ROUTER_API_KEY=<server-side provider api key>
```

Recommended high-availability setup:

```env
ROUTER_PROXY_API_KEY=<optional raw proxy access key>
OPENAI_API_KEY=<OpenAI key for primary>
VPS_ROUTER_API_KEY=<9router key on backup VPS>
EMERGENCY_ROUTER_API_KEY=<9router key for emergency tunnel>
ROUTER_IMAGE_PREFERRED_ENDPOINT=primary-openai
ROUTER_IMAGE_TARGETS_JSON=[{"name":"primary-openai","provider":"openai","url":"https://api.openai.com/v1/images/generations","model":"gpt-image-1","keyEnv":"OPENAI_API_KEY"},{"name":"fallback-vps-9router","provider":"9router","url":"https://backup-vps.example.com/v1/images/generations","model":"cx/gpt-5.5-image","keyEnv":"VPS_ROUTER_API_KEY"},{"name":"emergency-local-tunnel","provider":"9router","url":"https://replace-current-tunnel.trycloudflare.com/v1/images/generations","model":"cx/gpt-5.5-image","keyEnv":"EMERGENCY_ROUTER_API_KEY"}]
```

The backend tries targets in order, remembers the latest successful target while the
process is running, and falls through to the next target on network errors or non-OK
upstream responses.

If running 9router directly on the VPS, use the VPS-local router instead:

```env
ROUTER_PROVIDER=9router
ROUTER_IMAGE_ENDPOINT=http://127.0.0.1:20128/v1/images/generations
ROUTER_IMAGE_PREFERRED_ENDPOINT=http://127.0.0.1:20128/v1/images/generations
ROUTER_IMAGE_FALLBACK_ENDPOINT=
ROUTER_API_KEY=<9router api key on the VPS>
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

After the Render service exists, copy its deploy hook URL into this GitHub Actions secret:

```text
RENDER_DEPLOY_HOOK_URL=<Render deploy hook URL>
```

Optional GitHub Actions variable:

```text
BACKEND_HEALTH_URL=https://api.ducpt.com/healthz
```

Then GitHub Actions can deploy and verify the backend online without this computer:

```text
Actions -> Deploy Backend -> Run workflow
```

The deploy workflow also runs automatically when backend, sales page, package, Render config, or workflow files are pushed to `main`.

## Online DNS automation

Current public DNS for `ducpt.com` uses Namecheap nameservers:

```text
dns1.registrar-servers.com
dns2.registrar-servers.com
```

For automation that runs online and does not depend on this computer, move DNS management for `ducpt.com` to Cloudflare once, then use the GitHub Actions workflow in this repo:

```text
.github/workflows/manage-dns.yml
```

Required one-time setup:

1. Add `ducpt.com` to Cloudflare.
2. Copy the two Cloudflare nameservers for the zone.
3. In Namecheap, replace the current nameservers with the Cloudflare nameservers.
4. In Cloudflare, create an API token with `Zone:DNS:Edit` permission for only `ducpt.com`.
5. In GitHub repo settings, add these Actions secrets:

```text
CLOUDFLARE_API_TOKEN=<Cloudflare DNS edit token>
CLOUDFLARE_ZONE_ID=<Cloudflare zone id for ducpt.com>
```

Then run the GitHub Action:

```text
Actions -> Manage DNS -> Run workflow
record_name: api
record_type: CNAME
record_content: ducpt-9router-api.onrender.com
proxied: false
```

Use `proxied: false` until Render shows the custom domain certificate as active. If Render gives a different target for the custom domain, use that exact value as `record_content`.

After it runs, verify from any machine:

```powershell
Resolve-DnsName api.ducpt.com -Type CNAME
```

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
