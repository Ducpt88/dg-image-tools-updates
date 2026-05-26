# 9Router Backend + Admin

Backend này đặt giữa app Electron và API 9Router:

`Electron app -> ducpt.com backend -> 9Router API -> Electron app`

## Chạy local

1. Tạo file `.env` từ `.env.example`.
2. Điền `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ROUTER_API_KEY`.
3. Chạy:

```bash
npm run server
```

Admin dashboard:

```text
http://localhost:3030/9router-admin
```

## Route chính

```text
POST /api/9router/user/auth/login
GET  /api/9router/user/auth/me
POST /api/9router/user/images/generations
GET  /api/9router/admin/stats
GET  /api/9router/admin/users
POST /api/9router/admin/users
PATCH /api/9router/admin/users/:id
GET  /api/9router/admin/events
```

## Google Sheets webhook

Tạo Google Apps Script gắn với Sheet, deploy dạng Web App, rồi đưa URL vào:

```env
SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/.../exec
```

Apps Script mẫu:

```js
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('events')
    || SpreadsheetApp.getActiveSpreadsheet().insertSheet('events');
  const data = JSON.parse(e.postData.contents || '{}');

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['createdAt', 'email', 'ok', 'deviceId', 'prompt', 'error']);
  }

  sheet.appendRow([
    data.createdAt || new Date().toISOString(),
    data.email || '',
    data.ok ? 'OK' : 'ERROR',
    data.deviceId || '',
    data.prompt || '',
    data.error || ''
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## Ghi chú bảo mật

- Không đưa `ROUTER_API_KEY` vào app Electron.
- App client có thể bị sửa, nên quota/thiết bị/hết hạn phải kiểm tra ở backend.
- Đổi `JWT_SECRET` thành chuỗi dài ngẫu nhiên trước khi public.
- Nên triển khai sau HTTPS/reverse proxy trên `ducpt.com`.
