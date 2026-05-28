# DG Image Tools Release Readiness Report

Date: 2026-05-28

## Executive Summary

Status: **Code-side fixes applied, but do not send to customers until the cloud backend URL is confirmed live.**

The local app UI for user/admin works in mock/runtime tests, and the current user/admin installers were rebuilt. The app now supports cloud admin account management mode and production security guards. However, the configured cloud backend URL still returned 404 during verification, so remote customer use still depends on deploying/fixing that backend endpoint.

## Fixes Applied After Initial Report

1. Production server now refuses to start with missing/default `JWT_SECRET`.
2. Local admin bypass is disabled in production unless `ALLOW_LOCAL_ADMIN=true`.
3. Helmet CSP is enabled instead of fully disabling CSP.
4. Admin desktop now supports cloud customer management mode:
   - Set `ADMIN_MEMBER_SOURCE=cloud` or `ADMIN_CLOUD_MODE=1`.
   - Set `ADMIN_CLOUD_EMAIL` / `ADMIN_CLOUD_PASSWORD` for a cloud admin account.
   - In this mode, admin create/update/list uses `/api/9router/admin/*` on the cloud backend.
5. User build generation now supports cloud tokens correctly. Local validation is only required for local sessions.
6. Admin UI status now shows whether customer data is local or cloud.

## Passed Checks

1. Static JS syntax checks passed:
   - `node --check src/main.js`
   - `node --check src/renderer/renderer.js`
   - `node --check server/index.js`
   - `node --check server/store.js`

2. Production dependency audit passed:
   - `npm audit --omit=dev --json`
   - Result: 0 vulnerabilities.

3. Electron smoke test passed:
   - `npm run smoke`
   - Exit code: 0.
   - Note: Electron printed GPU/disk cache access warnings, but the app smoke test did not fail.

4. User UI behavior test passed with mocked image API:
   - User mode active.
   - Admin button hidden.
   - Private endpoint field disabled.
   - `Áp dụng` does not generate image automatically.
   - `Tạo ảnh` calls generation.
   - `Tạo hàng loạt` calls generation and completes 1/1.

5. Admin UI behavior test passed with mocked admin API:
   - Admin mode active.
   - Member/admin button visible.
   - Connection section visible.
   - Endpoint field enabled.

6. User installer was rebuilt:
   - `dist/DG Image Tools user 1.9-Setup-x64.exe`

## Critical Findings

### R1. Cloud backend URL is not responding as required

Severity: **Critical**

Location:
- `src/main.js:28-32`

Evidence:
```js
const appServerBaseUrl = String(
  process.env.NINE_ROUTER_API_BASE_URL
  || process.env.APP_SERVER_BASE_URL
  || 'https://ducpt-9router-api.onrender.com'
).replace(/\/$/, '');
```

Runtime evidence:
- `https://ducpt-9router-api.onrender.com/healthz` returned 404.
- `https://ducpt-9router-api.onrender.com/api/9router/user/auth/login` returned 404.

Impact:
Remote customers using the shipped user app may fail login and image generation if the default cloud API endpoint is still not serving the expected routes.

Fix:
Deploy the backend at this URL or change the app default to the correct working API URL, then verify:
- `GET /healthz` returns `{ ok: true }`
- `POST /api/9router/user/auth/login` returns a valid login response for a real customer account
- `POST /api/9router/user/images/generations` works with a valid token

### R2. Electron admin can now create cloud users, but must be configured for cloud mode

Severity: **High until configured**

Location:
- `src/main.js:968-973`
- `src/preload.js:14-16`

Previous evidence:
```js
const createMemberUser = async (member) => {
  const user = await adminStore.createUser({
    ...member,
    role: member.role || 'user'
  });
  return { user, dashboard: await getAdminDashboard() };
};
```

Current behavior:
The admin app supports cloud mode when configured with:
- `ADMIN_MEMBER_SOURCE=cloud` or `ADMIN_CLOUD_MODE=1`
- `ADMIN_CLOUD_EMAIL`
- `ADMIN_CLOUD_PASSWORD`

Impact if not configured:
If admin is left in local mode, creating a customer in the Electron admin on your PC stores that customer locally on your PC. A customer on another device will not have that local database.

Fix:
Choose one release model:
- Cloud model: admin must create/update users through the cloud backend API.
- Local-only model: do not sell this as remote account-based software; each device would need local provisioning.

Recommended for revenue/customer support: cloud mode.

## High Findings

### R3. Production JWT default secret

Severity: **Fixed**

Location:
- `server/index.js:27`

Evidence:
```js
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-before-production';
```

Current behavior:
Production now refuses to start if `JWT_SECRET` is missing or still default.

Fix:
In production, fail startup if `JWT_SECRET` is missing or still default.

### R4. Localhost admin bypass must not be exposed through proxy misconfiguration

Severity: **Fixed for default production**

Location:
- `server/index.js:520-536`
- `server/index.js:786-805`

Evidence:
```js
if (!req.get('authorization') && LOCAL_ADMIN_HOSTS.has(hostname)) {
  req.user = { role: 'admin', ... };
}
```

Impact:
This is convenient for local admin, but dangerous if a reverse proxy or deployment makes requests appear as `localhost`. It could expose admin APIs.

Current behavior:
Local admin bypass is only active outside production, or when explicitly enabled with `ALLOW_LOCAL_ADMIN=true`.

## Medium Findings

### R5. Auth token is stored in localStorage

Severity: **Medium**

Location:
- `src/renderer/renderer.js:285`
- `src/renderer/renderer.js:2006`

Evidence:
```js
const token = localStorage.getItem('authToken');
localStorage.setItem('authToken', session.token);
```

Impact:
In Electron this is not as exposed as a public browser site, but if renderer XSS or a malicious local user gets access, the token can be stolen.

Mitigation:
Current CSP and context isolation reduce risk. For stronger security, store tokens through Electron main process or encrypted OS storage.

### R6. Server disables Helmet CSP

Severity: **Medium**

Location:
- `server/index.js:49-50`

Evidence:
```js
app.use(helmet({
  contentSecurityPolicy: false
}));
```

Impact:
The frontend has a meta CSP, but server-delivered pages/admin/sales pages do not get full CSP protection from Helmet.

Fix:
Add a production CSP header appropriate for `/image`, `/sales`, and `/9router-admin`.

## Packaging Notes

The built user app ASAR contains:
- `src/main.js`
- `server/store.js`

The ASAR does not include:
- `server/index.js`
- `.env`

This means the user installer does not appear to ship the backend server file or env secrets. That is good for not leaking server code/env, but it reinforces the need for a working cloud backend for remote customers.

## Final Release Gate

Before sending to customers, verify these exact items:

1. Cloud backend URL is correct and returns `GET /healthz` OK.
2. A customer created from admin can log in from a separate machine/network.
3. That customer can generate one image and quota decreases.
4. Expired/blocked/quota-exhausted accounts are rejected.
5. Admin functions are not available in the user build.
6. `ROUTER_API_KEY` and `JWT_SECRET` are set in production and are not default values.
