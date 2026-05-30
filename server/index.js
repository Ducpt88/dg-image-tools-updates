require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const path = require('node:path');
const crypto = require('node:crypto');
const {
  ensureAdminUser,
  authenticateUser,
  createUser,
  createOrUpdateSalesUser,
  updateUser,
  getUserById,
  listUsers,
  publicUser,
  setAdminTwoFactor,
  prepareUserForImage,
  recordImageEvent,
  recordSecurityEvent,
  listEvents,
  getStats,
  getUpdatePolicy,
  updateUpdatePolicy,
  createOrder,
  listOrders,
  getOrderByCode,
  markOrderPaid,
  attachOrderAccount
} = require('./store');

const app = express();
const PORT = Number(process.env.PORT || 3030);
const isProduction = process.env.NODE_ENV === 'production';
const DEFAULT_JWT_SECRET = 'change-this-secret-before-production';
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
const ROUTER_PROVIDER = String(process.env.ROUTER_PROVIDER || '').trim().toLowerCase();
const OPENAI_IMAGE_ENDPOINT = 'https://api.openai.com/v1/images/generations';
const configuredRouterImageEndpoint = String(process.env.ROUTER_IMAGE_ENDPOINT || '').trim();
const isOpenAiEndpoint = (url, provider = '') => String(provider || '').toLowerCase() === 'openai'
  || String(url || '').includes('api.openai.com');
const isOpenAiImageProvider = configuredRouterImageEndpoint
  ? isOpenAiEndpoint(configuredRouterImageEndpoint, ROUTER_PROVIDER)
  : ROUTER_PROVIDER === 'openai';
const ROUTER_IMAGE_ENDPOINT = configuredRouterImageEndpoint
  || (isOpenAiImageProvider ? OPENAI_IMAGE_ENDPOINT : 'http://localhost:20128/v1/images/generations');
const ROUTER_IMAGE_FALLBACK_ENDPOINT = String(
  process.env.ROUTER_IMAGE_FALLBACK_ENDPOINT || ''
).trim();
const EMERGENCY_ROUTER_IMAGE_ENDPOINT = String(
  process.env.EMERGENCY_ROUTER_ENDPOINT
  || process.env.EMERGENCY_ROUTER_IMAGE_ENDPOINT
  || process.env.ROUTER_IMAGE_EMERGENCY_ENDPOINT
  || 'https://chatty-kids-like.loca.lt/v1/images/generations'
).trim();
const ROUTER_IMAGE_ENDPOINTS = [...new Set([
  EMERGENCY_ROUTER_IMAGE_ENDPOINT,
  ROUTER_IMAGE_FALLBACK_ENDPOINT,
  ROUTER_IMAGE_ENDPOINT
].filter(Boolean))];
let preferredRouterImageEndpoint = process.env.ROUTER_IMAGE_PREFERRED_ENDPOINT
  || ROUTER_IMAGE_ENDPOINT;
const ROUTER_IMAGE_MODEL = process.env.ROUTER_IMAGE_MODEL || (isOpenAiImageProvider ? 'gpt-image-1' : '');
const ROUTER_QUOTA_ENDPOINT = process.env.ROUTER_QUOTA_ENDPOINT || '';
const ROUTER_QUOTA_TOTAL = Number(process.env.ROUTER_QUOTA_TOTAL || 0);
const ROUTER_API_KEY = process.env.ROUTER_API_KEY || '';
const ROUTER_PROXY_API_KEY = process.env.ROUTER_PROXY_API_KEY || ROUTER_API_KEY;
const DEFAULT_SHEETS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbxID7hjhZVqvorp0OI9yHTyZhBd-DBjpjqO73J7KQSyQpTQsY-WcGQnhhHADokMsUN3/exec';
const SHEETS_WEBHOOK_URL = process.env.SHEETS_WEBHOOK_URL || DEFAULT_SHEETS_WEBHOOK_URL;
const ADMIN_ALERT_EMAIL = process.env.ADMIN_ALERT_EMAIL || 'hoangvant77internet@gmail.com';
const SALES_SHEET_ID = process.env.SALES_SHEET_ID || '1YL2mY6uYJCNrLASNjev7g7XDiPYVi4wBy8S_V7Ntlzg';
const BANK_ID = process.env.BANK_ID || '';
const BANK_ACCOUNT_NO = process.env.BANK_ACCOUNT_NO || '5550124510199';
const BANK_ACCOUNT_NAME = process.env.BANK_ACCOUNT_NAME || 'Hoang Van Duc';
const SEPAY_BANK_CODE = process.env.SEPAY_BANK_CODE || process.env.BANK_ID || 'MB';
const SITE_IMAGE_URL = process.env.SITE_IMAGE_URL || 'https://ducpt.com/image';
const APP_GUIDE_URL = process.env.APP_GUIDE_URL || SITE_IMAGE_URL;
const ZALO_GROUP_URL = process.env.ZALO_GROUP_URL || 'https://zalo.me/g/5mnnl6aynxzvsyu5gyl5';
const USER_APP_DOWNLOAD_URL = process.env.USER_APP_DOWNLOAD_URL || 'https://github.com/Ducpt88/dg-image-tools-releases/releases/latest';
const GUIDE_VIDEO_URL = process.env.GUIDE_VIDEO_URL || 'https://youtu.be/LWln6jaNbiw';
const SUPPORT_PHONE = process.env.SUPPORT_PHONE || '0963249467';
const PAYMENT_IMAGES = {};
const IMAGE_SITE_DIR = path.join(__dirname, '..', 'image');
const USER_API = '/api/9router/user';
const ADMIN_API = '/api/9router/admin';
const LOCAL_ADMIN_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const ADMIN_PAGE_USER = String(process.env.ADMIN_PAGE_USER || 'admin@example.com').trim();
const ADMIN_PAGE_PASSWORD = String(process.env.ADMIN_PAGE_PASSWORD || 'image-dg09');
const ADMIN_PAGE_PROTECTION_ENABLED = process.env.ADMIN_PAGE_PROTECTION !== 'false';
const ADMIN_2FA_ISSUER = process.env.ADMIN_2FA_ISSUER || 'DG Image Tools Admin';

const isConfiguredSecret = (value) => {
  const secret = String(value || '').trim();
  if (!secret) {
    return false;
  }

  return !/^(replace-with|change-this|your-|dummy|test|example|placeholder)/i.test(secret);
};

if (isProduction && (!process.env.JWT_SECRET || JWT_SECRET === DEFAULT_JWT_SECRET)) {
  throw new Error('Production requires a strong JWT_SECRET. Refusing to start with the default secret.');
}

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'", "'unsafe-inline'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", 'data:', 'https://img.vietqr.io', 'https://qr.sepay.vn'],
      "connect-src": ["'self'", 'https://script.google.com', 'https://script.googleusercontent.com']
    }
  }
}));
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  const origin = req.get('origin') || '';
  const allowedOrigins = new Set([
    'https://api.ducpt.com',
    'https://ducpt.com',
    'https://www.ducpt.com',
    'http://localhost:3030'
  ]);

  if (allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Device-Id');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
});
app.use(rateLimit({
  windowMs: 60 * 1000,
  limit: 120
}));

const timingSafeEqualText = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const requireAdminPageAuth = (req, res, next) => {
  if (!ADMIN_PAGE_PROTECTION_ENABLED) {
    return next();
  }

  const header = req.get('authorization') || '';
  const encoded = header.startsWith('Basic ') ? header.slice(6) : '';
  let user = '';
  let password = '';

  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    user = separator >= 0 ? decoded.slice(0, separator) : decoded;
    password = separator >= 0 ? decoded.slice(separator + 1) : '';
  } catch {
    // Fall through to the challenge response.
  }

  if (timingSafeEqualText(user, ADMIN_PAGE_USER) && timingSafeEqualText(password, ADMIN_PAGE_PASSWORD)) {
    return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="DG Image Tools Admin", charset="UTF-8"');
  return res.status(401).send('Admin authentication required.');
};

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, service: '9router-backend' });
});

app.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DucPT</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; color: #172026; background: #f6f7fb; }
    main { max-width: 960px; margin: 0 auto; padding: 72px 24px; }
    h1 { font-size: 42px; margin: 0 0 16px; }
    p { font-size: 18px; line-height: 1.6; color: #4a5560; }
    a { color: #0b6f74; font-weight: 700; text-decoration: none; }
  </style>
</head>
<body>
  <main>
    <h1>DucPT</h1>
    <p>Trang chu va cong API cho DG Image Tools.</p>
    <p><a href="/sales">Mo trang dat mua DG Image Tools</a></p>
    <p><a href="/image">Mo danh muc image</a></p>
  </main>
</body>
</html>`);
});

app.get('/image-info', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DucPT Image</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; color: #172026; background: #ffffff; }
    main { max-width: 960px; margin: 0 auto; padding: 72px 24px; }
    h1 { font-size: 38px; margin: 0 0 16px; }
    p { font-size: 18px; line-height: 1.6; color: #4a5560; }
  </style>
</head>
<body>
  <main>
    <h1>DucPT Image</h1>
    <p>Thong tin ky thuat ve danh muc image dang ket noi voi API cua app desktop.</p>
  </main>
</body>
</html>`);
});

const salePlans = [
  {
    id: 'trial',
    name: 'Dung thu',
    price: 0,
    quotaTotal: 10,
    deviceLimit: 1,
    months: 0.25,
    label: '7 ngay',
    highlight: false,
    features: ['10 anh test app', '1 thiet bi', 'Trai nghiem GEM va auto prompt']
  },
  {
    id: 'monthly',
    name: 'Goi thang',
    price: 99000,
    quotaTotal: 100,
    deviceLimit: 1,
    months: 1,
    label: '1 thang',
    highlight: true,
    features: ['100 anh/thang', '1 thiet bi', 'Phu hop creator/kenh moi']
  },
  {
    id: 'vip',
    name: 'VIP',
    price: 199000,
    quotaTotal: 300,
    deviceLimit: 2,
    months: 1,
    label: '1 thang',
    highlight: false,
    features: ['300 anh/thang', '2 thiet bi', 'Phu hop team lam nhieu kenh']
  }
];

const formatVnd = (value) => `${Number(value || 0).toLocaleString('vi-VN')}d`;

const addDaysIsoDate = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
};

const getPlanDays = (order) => {
  if (order.planId === 'trial') return 7;
  return Math.max(1, Math.round(Number(order.months || 1) * 30));
};

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const buildCustomerEmailHtml = ({ order, password, kind }) => {
  const isTrial = kind === 'trial';
  const title = isTrial
    ? 'Chúc mừng bạn đã đăng ký sử dụng gói dùng thử 0đ DG Image Tools thành công!'
    : 'Chúc mừng bạn đã đăng ký sử dụng DG Image Tools thành công!';
  const accent = isTrial ? '#2563eb' : '#047857';
  const appLogo = 'https://ducpt.com/image/assets/dg-image-tools-icon.png';
  const rows = [
    ['Tài khoản', order.email],
    ['Mật khẩu', password],
    ['Số ảnh được tạo', order.quotaTotal],
    ['Thời gian sử dụng', order.expiresAt],
    ['Link tải', USER_APP_DOWNLOAD_URL],
    ['Link videos', GUIDE_VIDEO_URL]
  ];
  const paidCta = isTrial ? '' : `
    <p style="margin:18px 0 8px;font-size:15px;line-height:1.6;color:#334155;"><strong>Nhóm Zalo hỗ trợ trả phí:</strong></p>
    <a href="${escapeHtml(ZALO_GROUP_URL)}" style="display:inline-block;margin:0 0 14px;padding:12px 18px;border-radius:8px;background:#047857;color:#ffffff;text-decoration:none;font-weight:800;">Vào nhóm Zalo</a>`;

  return `<!doctype html>
<html lang="vi">
  <body style="margin:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #dbe3ef;border-radius:12px;overflow:hidden;">
          <tr><td style="padding:28px 28px 10px;">
            <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 14px;"><tr>
              <td><img src="${appLogo}" alt="DG Image Tools" width="42" height="42" style="display:block;width:42px;height:42px;border-radius:8px;border:0;"></td>
              <td style="padding-left:10px;color:${accent};font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;">DG Image Tools</td>
            </tr></table>
            <h1 style="margin:0 0 12px;font-size:26px;line-height:1.25;color:#0f172a;">${title}</h1>
            <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;">Xin chào ${escapeHtml(order.customerName || 'bạn')}, dưới đây là thông tin tài khoản của bạn.</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0;border:1px solid #dbe3ef;border-radius:10px;overflow:hidden;">
              ${rows.map(([label, value]) => `<tr><td style="padding:12px 14px;background:#f8fafc;border-bottom:1px solid #e5edf7;width:42%;font-size:13px;color:#64748b;font-weight:700;">${escapeHtml(label)}</td><td style="padding:12px 14px;border-bottom:1px solid #e5edf7;font-size:14px;color:#0f172a;font-weight:800;">${escapeHtml(value)}</td></tr>`).join('')}
            </table>
            ${paidCta}
            <p style="margin:18px 0 0;font-size:15px;line-height:1.6;color:#334155;">-----DG Media Holding-----</p>
            <p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:#334155;">Hãy đăng nhập app bằng email này. Nếu cần hỗ trợ tạo tài khoản hoặc cài app, nhắn trực tiếp cho Đức để được hướng dẫn nhanh: <strong>${escapeHtml(SUPPORT_PHONE)}</strong>.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
};

const buildCustomerEmail = ({ order, password, kind }) => {
  const isTrial = kind === 'trial';
  const subject = isTrial
    ? 'Tài khoản dùng thử DG Image Tools của bạn đã sẵn sàng'
    : 'Tài khoản DG Image Tools của bạn đã được kích hoạt';
  const lines = isTrial ? [
    'Chúc mừng bạn đã đăng ký sử dụng gói dùng thử 0đ DG Image Tools thành công!',
    '',
    `Tài khoản : ${order.email}`,
    `Mật khẩu : ${password}`,
    `Số ảnh được tạo: ${order.quotaTotal}`,
    `Thời gian sử dụng : ${order.expiresAt}`,
    `Link tải: ${USER_APP_DOWNLOAD_URL}`,
    `Link videos : ${GUIDE_VIDEO_URL}`,
    '',
    '-----DG Media Holding-----',
    `Hãy đăng nhập app bằng email này. Nếu cần hỗ trợ tạo tài khoản hoặc cài app, nhắn trực tiếp cho Đức để được hướng dẫn nhanh ${SUPPORT_PHONE}`
  ] : [
    'Chúc mừng bạn đã đăng ký sử dụng DG Image Tools thành công!',
    '',
    `Gói: ${order.planName}`,
    `Tài khoản : ${order.email}`,
    `Mật khẩu : ${password}`,
    `Số ảnh được tạo: ${order.quotaTotal}`,
    `Thời gian sử dụng : ${order.expiresAt}`,
    `Link tải: ${USER_APP_DOWNLOAD_URL}`,
    `Link videos : ${GUIDE_VIDEO_URL}`,
    `Nhóm Zalo hỗ trợ trả phí: ${ZALO_GROUP_URL}`,
    '',
    '-----DG Media Holding-----',
    `Hãy đăng nhập app bằng email này. Nếu cần hỗ trợ tạo tài khoản hoặc cài app, nhắn trực tiếp cho Đức để được hướng dẫn nhanh ${SUPPORT_PHONE}`
  ];

  return { subject, body: lines.join('\n'), htmlBody: buildCustomerEmailHtml({ order, password, kind }) };
};

const buildVietQrUrl = ({ amount, content }) => {
  if (!BANK_ACCOUNT_NO || !amount) {
    return '';
  }

  const query = new URLSearchParams({
    acc: BANK_ACCOUNT_NO,
    bank: SEPAY_BANK_CODE,
    amount: String(Math.round(Number(amount || 0))),
    des: content
  });
  return `https://qr.sepay.vn/img?${query.toString()}`;
};

const normalizePaymentText = (value) => String(value || '').toUpperCase().replace(/\s+/g, ' ').trim();

const extractWebhookText = (payload) => normalizePaymentText([
  payload.content,
  payload.description,
  payload.transaction_content,
  payload.transferContent,
  payload.referenceCode,
  payload.code
].filter(Boolean).join(' '));

const extractWebhookAmount = (payload) => {
  const candidates = [payload.transferAmount, payload.amount, payload.transactionAmount, payload.money, payload.value];
  for (const candidate of candidates) {
    const value = Number(String(candidate || '').replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
};

const getPublicBankInfo = (amount = 0, content = '') => ({
  bankId: BANK_ID,
  accountNo: BANK_ACCOUNT_NO,
  accountName: BANK_ACCOUNT_NAME,
  transferContent: content,
  qrUrl: buildVietQrUrl({ amount, content })
});

const getOrderPaymentInfo = (order) => {
  const paymentRequired = Number(order.price || 0) > 0;
  const bank = getPublicBankInfo(order.price, order.transferContent);

  return {
    ...bank,
    paymentRequired,
    paymentImageUrl: paymentRequired ? PAYMENT_IMAGES[order.planId] || '' : '',
    message: paymentRequired
      ? 'Vui long chuyen khoan theo dung anh QR va noi dung don.'
      : 'Don dung thu 0d da duoc ghi nhan, khong can chuyen khoan.'
  };
};

const renderSalesPage = () => `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DG Image Tools - Tao thumbnail YouTube bang AI</title>
  <meta name="description" content="DG Image Tools ho tro tao thumbnail YouTube, anh marketing, GEM phan tich anh mau, tao hang loat, ghep logo goc va quan ly quota thanh vien.">
  <link rel="canonical" href="${SITE_IMAGE_URL}">
  <style>
    :root { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; background: #f7f3ee; }
    * { box-sizing: border-box; }
    body { margin: 0; background: linear-gradient(#eadfd2 1px, transparent 1px), linear-gradient(90deg, #eadfd2 1px, transparent 1px), #f7f3ee; background-size: 40px 40px; }
    main { max-width: 1120px; margin: 0 auto; padding: 42px 18px 56px; }
    .hero, .band { border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; box-shadow: 0 16px 42px rgba(15,23,42,.08); }
    .hero { display: grid; grid-template-columns: minmax(0,1.05fr) minmax(320px,.95fr); gap: 24px; padding: 28px; align-items: start; }
    h1 { margin: 0 0 12px; font-size: 34px; line-height: 1.12; }
    h2 { margin: 0 0 16px; font-size: 22px; }
    p { margin: 0; color: #475569; line-height: 1.55; }
    .features { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; margin-top: 18px; }
    .feature { border: 1px solid #dbe2ea; border-radius: 8px; padding: 12px; background: #f8fafc; font-weight: 700; }
    .agent { display: grid; grid-template-columns: minmax(0,.9fr) minmax(0,1.1fr); gap: 14px; }
    .agent-output { min-height: 188px; border: 1px solid #dbe2ea; border-radius: 8px; padding: 14px; background: #0f1724; color: #d8f7e7; white-space: pre-wrap; font-family: Consolas, "Liberation Mono", monospace; font-size: 13px; line-height: 1.5; }
    .pricing { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 12px; margin-top: 18px; }
    .plan { border: 1px solid #dbe2ea; border-radius: 8px; padding: 16px; background: #fff; cursor: pointer; }
    .plan.active, .plan.featured { border-color: #1f7aeb; box-shadow: 0 0 0 3px rgba(31,122,235,.12); }
    .plan h3 { margin: 0 0 8px; font-size: 17px; }
    .price { font-size: 26px; font-weight: 900; color: #0f172a; }
    ul { margin: 12px 0 0; padding-left: 18px; color: #475569; }
    li { margin: 6px 0; }
    form { display: grid; gap: 10px; }
    label { display: grid; gap: 5px; color: #475569; font-size: 13px; font-weight: 700; }
    input, textarea, select { width: 100%; min-width: 0; border: 1px solid #dbe2ea; border-radius: 8px; padding: 11px 12px; font: inherit; outline: none; background: #fff; }
    input:focus, textarea:focus, select:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.12); }
    button { height: 42px; border: 0; border-radius: 8px; background: #1f7aeb; color: white; font-weight: 800; cursor: pointer; }
    .band { margin-top: 16px; padding: 22px; }
    .payment { display: none; grid-template-columns: 180px minmax(0,1fr); gap: 16px; align-items: start; margin-top: 14px; border: 1px solid #dbeafe; border-radius: 8px; padding: 14px; background: #f8fbff; }
    .payment.show { display: grid; }
    .payment img { width: 180px; max-width: 100%; border-radius: 8px; background: white; }
    .code { display: inline-flex; border: 1px dashed #1f7aeb; border-radius: 8px; padding: 7px 10px; background: white; color: #174ea6; font-weight: 900; }
    .muted { color: #64748b; font-size: 13px; }
    .status { min-height: 20px; color: #047857; font-weight: 800; }
    @media (max-width: 860px) { .hero, .payment, .agent { grid-template-columns: 1fr; } .pricing, .features { grid-template-columns: 1fr; } h1 { font-size: 28px; } }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <div>
        <h1>DG Image Tools cho thumbnail YouTube va anh marketing</h1>
        <p>Bo cong cu tao anh bang 9Router cho creator, team media va nguoi lam kenh YouTube. App ho tro phan tich anh mau, toi uu prompt theo tung ngach, tao hang loat, kiem soat chu/ngon ngu, ghep logo goc va quan ly quota thanh vien.</p>
        <div class="features">
          <div class="feature">Tao thumbnail cho tai chinh, crypto, review, drama, giao duc, podcast, reaction</div>
          <div class="feature">GEM phan tich anh mau va goi y prompt theo style rieng</div>
          <div class="feature">Tao hang loat, luu file, manifest va lich su loi de de kiem tra</div>
          <div class="feature">Quan ly thanh vien, quota, thiet bi va data khach hang</div>
          <div class="feature">Logo goc duoc ghep sau, khong de AI ve lai sai logo</div>
          <div class="feature">Tu nhan dien co chu/khong chu, ngon ngu va kich thuoc hop le</div>
        </div>
      </div>
      <form id="orderForm">
        <h2>Dat mua va nhan ma chuyen khoan</h2>
        <label>Goi su dung
          <select id="planSelect" name="planId"></select>
        </label>
        <label>Ho ten
          <input name="customerName" required placeholder="Nguyen Van A">
        </label>
        <label>Email cap tai khoan
          <input name="email" type="email" required placeholder="email@example.com">
        </label>
        <label>So dien thoai/Zalo
          <input name="phone" required placeholder="09...">
        </label>
        <label>Ghi chu
          <textarea name="note" rows="3" placeholder="Nhu cau su dung, ten kenh, yeu cau rieng"></textarea>
        </label>
        <button type="submit">Tao don va lay ma chuyen khoan</button>
        <div id="orderStatus" class="status"></div>
      </form>
    </section>

    <section class="band agent">
      <div>
        <h2>Agent tu van goi va noi dung</h2>
        <p>Nhap nhanh ngach YouTube va muc tieu su dung, agent se goi y cach dien form dat mua, goi phu hop va prompt mau de test app.</p>
        <form id="agentForm">
          <label>Ngach/chu de kenh
            <input id="agentNiche" placeholder="Vi du: tai chinh crypto, review san pham, giao duc, drama">
          </label>
          <label>Muc tieu
            <select id="agentGoal">
              <option value="test">Test app truoc khi mua</option>
              <option value="creator">Lam kenh ca nhan deu hang tuan</option>
              <option value="team">Team tao nhieu thumbnail moi ngay</option>
            </select>
          </label>
          <button type="submit">Goi y toi uu</button>
        </form>
      </div>
      <div id="agentOutput" class="agent-output">Agent se goi y goi mua, cach ghi chu va prompt test tai day.</div>
    </section>

    <section class="band">
      <h2>Bang gia</h2>
      <div id="pricing" class="pricing"></div>
      <div id="paymentBox" class="payment">
        <img id="qrImage" alt="QR chuyen khoan" hidden>
        <div>
          <h2>Thong tin chuyen khoan</h2>
          <p>So tien: <strong id="payAmount"></strong></p>
          <p>Noi dung chuyen khoan: <span id="payContent" class="code"></span></p>
          <p id="bankInfo" class="muted"></p>
          <p class="muted">Sau khi chuyen khoan, admin doi soat theo ma don va kich hoat tai khoan/quota cho khach.</p>
        </div>
      </div>
    </section>
  </main>
  <script>
    const plans = ${JSON.stringify(salePlans)};
    const formatVnd = (value) => Number(value || 0).toLocaleString('vi-VN') + 'd';
    const planSelect = document.querySelector('#planSelect');
    const pricing = document.querySelector('#pricing');
    const setPlan = (id) => {
      planSelect.value = id;
      document.querySelectorAll('.plan').forEach((item) => item.classList.toggle('active', item.dataset.id === id));
    };
    plans.forEach((plan) => {
      const option = document.createElement('option');
      option.value = plan.id;
      option.textContent = plan.name + ' - ' + formatVnd(plan.price);
      planSelect.append(option);
      const card = document.createElement('article');
      card.className = 'plan' + (plan.highlight ? ' featured active' : '');
      card.dataset.id = plan.id;
      card.innerHTML = '<h3>' + plan.name + '</h3><div class="price">' + formatVnd(plan.price) + '</div><p>' + plan.quotaTotal + ' anh, ' + plan.deviceLimit + ' thiet bi, ' + plan.label + '</p><ul>' + plan.features.map((item) => '<li>' + item + '</li>').join('') + '</ul>';
      card.addEventListener('click', () => setPlan(plan.id));
      pricing.append(card);
    });
    planSelect.value = plans.find((plan) => plan.highlight)?.id || plans[0].id;
    planSelect.addEventListener('change', () => setPlan(planSelect.value));
    document.querySelector('#agentForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const niche = document.querySelector('#agentNiche').value.trim() || 'kenh YouTube moi';
      const goal = document.querySelector('#agentGoal').value;
      const suggestedPlan = goal === 'team' ? plans.find((plan) => plan.id === 'vip') : (goal === 'test' ? plans.find((plan) => plan.id === 'trial') : plans.find((plan) => plan.id === 'monthly'));
      setPlan(suggestedPlan.id);
      const textMode = /cinematic|du lich|travel|food|am thuc|san pham|product|beauty|fashion/i.test(niche)
        ? 'uu tien anh sach, it chu hoac khong chu neu prompt yeu cau'
        : 'nen co headline lon, ngan, de doc tren mobile';
      document.querySelector('#agentOutput').textContent = [
        'Goi phu hop: ' + suggestedPlan.name + ' - ' + formatVnd(suggestedPlan.price),
        'Ly do: ' + (goal === 'team' ? 'can quota lon va 2 thiet bi cho team.' : goal === 'test' ? 'nen test nhanh truoc khi mua goi thang.' : 'du quota cho creator lam deu hang tuan.'),
        '',
        'Ghi chu nen dien:',
        'Kenh/chu de: ' + niche + '. Can thumbnail dung phong cach YouTube, ' + textMode + ', co the dung anh mau va logo goc.',
        '',
        'Prompt test mau:',
        'Tao thumbnail YouTube 16:9 ve ' + niche + ', mot chu the chinh ro rang, bo cuc CTR sach, mau sac noi bat, cam xuc manh, phu hop nguoi xem mobile.'
      ].join('\\n');
    });
    document.querySelector('#orderForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const status = document.querySelector('#orderStatus');
      status.textContent = 'Dang tao don...';
      const formData = new FormData(event.target);
      const response = await fetch('/api/sales/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(formData.entries()))
      });
      const body = await response.json();
      if (!response.ok) {
        status.textContent = body.message || 'Khong tao duoc don.';
        return;
      }
      const paymentBox = document.querySelector('#paymentBox');
      if (!body.bank.paymentRequired) {
        status.textContent = 'Da luu thong tin dung thu ' + body.order.code + '. Khong can chuyen khoan.';
        paymentBox.classList.remove('show');
        return;
      }
      status.textContent = 'Da tao don ' + body.order.code + '. Vui long quet QR va chuyen khoan dung noi dung.';
      paymentBox.classList.add('show');
      document.querySelector('#payAmount').textContent = formatVnd(body.order.price);
      document.querySelector('#payContent').textContent = body.order.transferContent;
      document.querySelector('#bankInfo').textContent = body.bank.accountNo ? ('Ngan hang: ' + body.bank.bankId + ' | STK: ' + body.bank.accountNo + ' | Ten: ' + body.bank.accountName) : 'Chua cau hinh thong tin ngan hang trong server.';
      const qr = document.querySelector('#qrImage');
      if (body.bank.paymentImageUrl || body.bank.qrUrl) {
        qr.src = body.bank.paymentImageUrl || body.bank.qrUrl;
        qr.hidden = false;
      } else {
        qr.hidden = true;
      }
    });
  </script>
</body>
</html>`;

app.get(['/image', '/sales', '/dat-mua', '/pricing'], (_req, res) => {
  res.type('html').send(renderSalesPage());
});

const signToken = (user, options = {}) => jwt.sign(
  {
    sub: user.id,
    role: user.role,
    email: user.email,
    twoFactor: Boolean(options.twoFactor || user.role !== 'admin')
  },
  JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
);

const signTwoFactorToken = (user, payload = {}) => jwt.sign(
  {
    sub: user.id,
    role: user.role,
    email: user.email,
    ...payload
  },
  JWT_SECRET,
  { expiresIn: '10m' }
);

const base32Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const generateTotpSecret = () => {
  const bytes = crypto.randomBytes(20);
  let bits = '';
  let output = '';
  for (const byte of bytes) {
    bits += byte.toString(2).padStart(8, '0');
    while (bits.length >= 5) {
      output += base32Alphabet[parseInt(bits.slice(0, 5), 2)];
      bits = bits.slice(5);
    }
  }
  if (bits.length) {
    output += base32Alphabet[parseInt(bits.padEnd(5, '0'), 2)];
  }
  return output;
};

const decodeBase32 = (secret) => {
  const clean = String(secret || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  const bytes = [];
  for (const char of clean) {
    const value = base32Alphabet.indexOf(char);
    if (value < 0) continue;
    bits += value.toString(2).padStart(5, '0');
    while (bits.length >= 8) {
      bytes.push(parseInt(bits.slice(0, 8), 2));
      bits = bits.slice(8);
    }
  }
  return Buffer.from(bytes);
};

const generateTotpCode = (secret, step = Math.floor(Date.now() / 30000)) => {
  const key = decodeBase32(secret);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hash = crypto.createHmac('sha1', key).update(counter).digest();
  const offset = hash[hash.length - 1] & 0xf;
  const binary = ((hash[offset] & 0x7f) << 24)
    | ((hash[offset + 1] & 0xff) << 16)
    | ((hash[offset + 2] & 0xff) << 8)
    | (hash[offset + 3] & 0xff);
  return String(binary % 1000000).padStart(6, '0');
};

const verifyTotpCode = (secret, code) => {
  const cleanCode = String(code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleanCode)) {
    return false;
  }

  const currentStep = Math.floor(Date.now() / 30000);
  return [-1, 0, 1].some((drift) => timingSafeEqualText(generateTotpCode(secret, currentStep + drift), cleanCode));
};

const buildOtpAuthUrl = (user, secret) => {
  const label = `${ADMIN_2FA_ISSUER}:${user.email}`;
  const query = new URLSearchParams({
    secret,
    issuer: ADMIN_2FA_ISSUER,
    algorithm: 'SHA1',
    digits: '6',
    period: '30'
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${query.toString()}`;
};

const sendSheetEvent = async (event) => {
  if (!SHEETS_WEBHOOK_URL) {
    return false;
  }

  try {
    const response = await fetch(SHEETS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });
    if (!response.ok) {
      console.error('Sheet webhook failed:', response.status, await response.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (error) {
    console.error('Sheet webhook failed:', error.message);
    return false;
  }
};

const queueSheetEvent = (event) => {
  sendSheetEvent(event).catch((error) => {
    console.error('Sheet event queue failed:', error.message);
  });
};

const sendSecurityAlert = async (event) => sendSheetEvent({
  type: 'security_alert',
  alertEmail: ADMIN_ALERT_EMAIL,
  subject: `[DG Image Tools] Canh bao bao mat: ${event.reason}`,
  ...event
});

const sendCustomerEmail = async ({ order, password, kind }) => {
  const email = buildCustomerEmail({ order, password, kind });
  const sent = await sendSheetEvent({
    type: 'customer_email',
    sheetId: SALES_SHEET_ID,
    to: order.email,
    customerName: order.customerName,
    orderCode: order.code,
    planName: order.planName,
    quotaTotal: order.quotaTotal,
    expiresAt: order.expiresAt,
    subject: email.subject,
    body: email.body,
    htmlBody: email.htmlBody
  });
  return { ...email, sent, sentAt: sent ? new Date().toISOString() : null };
};

const queueCustomerEmail = ({ order, password, kind }) => {
  sendCustomerEmail({ order, password, kind })
    .then((email) => {
      if (!email.sentAt) return;
      return attachOrderAccount(order.code, { emailedAt: email.sentAt });
    })
    .catch((error) => {
      console.error('Customer email queue failed:', error.message);
    });
};

const activateOrderAccount = async (order, kind) => {
  const expiresAt = addDaysIsoDate(getPlanDays(order));
  const account = await createOrUpdateSalesUser({
    email: order.email,
    planName: order.planName,
    monthlyPrice: order.price,
    paymentStatus: kind === 'trial' ? 'trial' : 'paid',
    quotaTotal: order.quotaTotal,
    expiresAt,
    deviceLimit: order.deviceLimit
  });
  const password = account.accountPassword;
  const enrichedOrder = { ...order, expiresAt, accountEmail: account.email, accountUserId: account.id };
  const activatedOrder = await attachOrderAccount(order.code, { user: account, expiresAt });
  queueCustomerEmail({ order: enrichedOrder, password, kind });
  return activatedOrder;
};

const readQuotaNumber = (data, keys) => {
  for (const key of keys) {
    const value = key.split('.').reduce((target, part) => target?.[part], data);
    if (Number.isFinite(Number(value))) {
      return Number(value);
    }
  }

  return null;
};

const cleanObject = (value) => Object.fromEntries(
  Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== '')
);

const normalizeOpenAiImageSize = (value) => {
  const sizeValue = String(value || 'auto').trim();
  const allowed = new Set(['auto', '1024x1024', '1536x1024', '1024x1536']);

  if (allowed.has(sizeValue)) {
    return sizeValue;
  }

  const match = sizeValue.match(/^(\d+)x(\d+)$/i);
  if (!match) {
    return 'auto';
  }

  const width = Number(match[1]);
  const height = Number(match[2]);

  if (width > height) {
    return '1536x1024';
  }

  if (height > width) {
    return '1024x1536';
  }

  return '1024x1024';
};

const normalizeOpenAiImageModel = (model) => {
  const requested = String(model || '').trim();

  if (ROUTER_IMAGE_MODEL) {
    return ROUTER_IMAGE_MODEL;
  }

  if (!requested || requested.startsWith('cx/')) {
    return 'gpt-image-1';
  }

  return requested;
};

const normalizeTargetModel = (target, requestedModel) => {
  if (target?.model) {
    return target.model;
  }

  if (isOpenAiEndpoint(target?.url, target?.provider)) {
    const requested = String(requestedModel || '').trim();
    if (!requested || requested.startsWith('cx/')) {
      return 'gpt-image-1';
    }
    return requested;
  }

  return requestedModel;
};

const parseRouterTargetsJson = () => {
  const raw = String(process.env.ROUTER_IMAGE_TARGETS_JSON || process.env.ROUTER_IMAGE_ENDPOINTS_JSON || '').trim();
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return (Array.isArray(parsed) ? parsed : [parsed])
      .map((target, index) => ({
        name: String(target.name || target.id || `target-${index + 1}`),
        url: String(target.url || target.endpoint || '').trim(),
        provider: String(target.provider || '').trim().toLowerCase(),
        model: String(target.model || '').trim(),
        key: String(target.key || '').trim(),
        keyEnv: String(target.keyEnv || target.key_env || '').trim()
      }))
      .filter((target) => target.url);
  } catch (error) {
    console.error('Invalid ROUTER_IMAGE_TARGETS_JSON:', error.message);
    return [];
  }
};

const getRouterTargetKey = (target) => {
  if (target?.key) {
    return isConfiguredSecret(target.key) ? target.key : '';
  }

  if (target?.keyEnv && process.env[target.keyEnv]) {
    return isConfiguredSecret(process.env[target.keyEnv]) ? process.env[target.keyEnv] : '';
  }

  return isConfiguredSecret(ROUTER_API_KEY) ? ROUTER_API_KEY : '';
};

const legacyRouterTargets = () => ROUTER_IMAGE_ENDPOINTS.map((url, index) => ({
  name: index === 0 ? 'primary' : `fallback-${index}`,
  url,
  provider: isOpenAiEndpoint(url, ROUTER_PROVIDER) ? 'openai' : ROUTER_PROVIDER,
  model: index === 0 ? ROUTER_IMAGE_MODEL : '',
  key: '',
  keyEnv: ''
}));

const getRouterImageTargets = () => {
  const parsedTargets = parseRouterTargetsJson();
  const targets = parsedTargets.length ? parsedTargets : legacyRouterTargets();
  const uniqueTargets = [];
  const seen = new Set();

  for (const target of targets) {
    const dedupeKey = `${target.provider || ''}|${target.url}|${target.model || ''}|${target.keyEnv || ''}`;
    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      uniqueTargets.push(target);
    }
  }

  const preferredIndex = uniqueTargets.findIndex((target) => target.url === preferredRouterImageEndpoint || target.name === preferredRouterImageEndpoint);
  if (preferredIndex > 0) {
    const [preferred] = uniqueTargets.splice(preferredIndex, 1);
    uniqueTargets.unshift(preferred);
  }

  return uniqueTargets;
};

const hasRouterImageAuth = () => getRouterImageTargets().some((target) => Boolean(getRouterTargetKey(target)));

const buildImagePayload = (body, target = null) => {
  if (target ? isOpenAiEndpoint(target.url, target.provider) : isOpenAiImageProvider) {
    const quality = body.quality && body.quality !== 'auto' ? body.quality : undefined;
    const background = body.background && body.background !== 'auto' ? body.background : undefined;

    return cleanObject({
      model: target ? normalizeTargetModel(target, body.model) : normalizeOpenAiImageModel(body.model),
      prompt: body.prompt,
      n: body.n || 1,
      size: normalizeOpenAiImageSize(body.size),
      quality,
      background,
      output_format: body.output_format || 'png',
      image: body.image
    });
  }

  return cleanObject({
    model: target ? normalizeTargetModel(target, body.model) : body.model,
    prompt: body.prompt,
    n: body.n || 1,
    size: normalizeImageSize(body.size),
    quality: body.quality,
    background: body.background,
    image_detail: body.image_detail,
    output_format: body.output_format,
    image: body.image
  });
};

const getEndpointLabel = (value) => {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return String(value || '').replace(/\/[^/]*$/, '/...');
  }
};

const getFetchErrorMessage = (error) => [
  error.message,
  error.cause?.message,
  error.cause?.code
].filter(Boolean).join(' | ');

const fetchRouterImage = async (body) => {
  let upstream = null;
  let rawText = '';
  let lastFetchError = null;
  let lastTarget = null;
  const targets = getRouterImageTargets();

  for (const target of targets) {
    lastTarget = target;
    const targetKey = getRouterTargetKey(target);
    const payload = buildImagePayload(body, target);
    try {
      upstream = await fetch(target.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(targetKey ? { Authorization: `Bearer ${targetKey}` } : {}),
          Accept: isOpenAiEndpoint(target.url, target.provider) ? 'application/json' : 'text/event-stream'
        },
        body: JSON.stringify(payload)
      });
      rawText = await upstream.text();

      if (upstream.ok) {
        preferredRouterImageEndpoint = target.name || target.url;
        return { upstream, rawText, endpoint: target.url, target };
      }

      if (target === targets.at(-1)) {
        return { upstream, rawText, endpoint: target.url, target };
      }
    } catch (error) {
      lastFetchError = error;
      if (target === targets.at(-1)) {
        error.endpoint = target.url;
        error.targetName = target.name;
        throw error;
      }
    }
  }

  if (lastFetchError) {
    lastFetchError.endpoint = lastTarget?.url;
    lastFetchError.targetName = lastTarget?.name;
    throw lastFetchError;
  }

  return { upstream, rawText, endpoint: lastTarget?.url, target: lastTarget };
};

const parseRouterQuota = (data, fallbackUsed = 0) => {
  const quotaTotal = readQuotaNumber(data, [
    'quotaTotal',
    'quota.total',
    'quota.limit',
    'credits.total',
    'credits.limit',
    'usage.limit',
    'limit',
    'total'
  ]);
  const quotaUsed = readQuotaNumber(data, [
    'quotaUsed',
    'quota.used',
    'credits.used',
    'usage.used',
    'used'
  ]);
  const quotaRemaining = readQuotaNumber(data, [
    'quotaRemaining',
    'quota.remaining',
    'credits.remaining',
    'usage.remaining',
    'remaining',
    'balance'
  ]);
  const resolvedTotal = quotaTotal ?? (quotaRemaining !== null && quotaUsed !== null ? quotaRemaining + quotaUsed : null);
  const resolvedUsed = quotaUsed ?? (resolvedTotal !== null && quotaRemaining !== null ? Math.max(0, resolvedTotal - quotaRemaining) : fallbackUsed);

  return {
    quotaTotal: resolvedTotal,
    quotaUsed: resolvedUsed,
    quotaRemaining: quotaRemaining ?? (resolvedTotal !== null ? Math.max(0, resolvedTotal - resolvedUsed) : null),
    raw: data
  };
};

const requireAuth = async (req, res, next) => {
  try {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';

    if (!token) {
      return res.status(401).json({ message: 'Thiếu token đăng nhập.' });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    const user = await getUserById(payload.sub);

    if (!user) {
      return res.status(401).json({ message: 'Phiên đăng nhập không hợp lệ.' });
    }

    req.auth = payload;
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn.' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Không có quyền admin.' });
  }

  if (req.user.twoFactorEnabled && !req.auth?.twoFactor) {
    return res.status(403).json({ message: 'Admin can xac thuc 2FA.' });
  }

  return next();
};

const allowLocalAdmin = (req, _res, next) => {
  const hostname = String(req.hostname || '').toLowerCase();
  const localAdminAllowed = !isProduction || process.env.ALLOW_LOCAL_ADMIN === 'true';

  if (localAdminAllowed && !req.get('authorization') && LOCAL_ADMIN_HOSTS.has(hostname)) {
    req.user = {
      id: 'local-admin',
      email: 'local-admin@9router.local',
      role: 'admin',
      status: 'active',
      quotaTotal: 999999,
      quotaUsed: 0,
      expiresAt: null,
      deviceLimit: 999,
      devices: [],
      createdAt: null,
      updatedAt: null,
      lastLoginAt: null
    };
  }

  next();
};

const requireAdminAccess = (req, res, next) => {
  if (req.user) {
    return requireAdmin(req, res, next);
  }

  return requireAuth(req, res, () => requireAdmin(req, res, next));
};

const loginHandler = async (req, res) => {
  try {
    const user = await authenticateUser({
      email: req.body.email,
      password: req.body.password,
      deviceId: req.body.deviceId
    });

    if (user.role === 'admin') {
      if (user.twoFactorEnabled) {
        return res.json({
          requiresTwoFactor: true,
          tempToken: signTwoFactorToken(user, { type: 'admin_2fa' }),
          user
        });
      }

      const setupSecret = generateTotpSecret();
      return res.json({
        requiresTwoFactorSetup: true,
        tempToken: signTwoFactorToken(user, { type: 'admin_2fa_setup', twoFactorSecret: setupSecret }),
        setupSecret,
        otpauthUrl: buildOtpAuthUrl(user, setupSecret),
        user
      });
    }

    res.json({
      token: signToken(user),
      user
    });
  } catch (error) {
    const event = await recordSecurityEvent({
      email: req.body.email,
      deviceId: req.body.deviceId,
      reason: 'login_failed',
      severity: 'medium',
      appFlavor: 'backend',
      detail: {
        ip: req.ip,
        userAgent: req.get('user-agent') || '',
        error: error.message
      }
    });
    await sendSecurityAlert(event);
    res.status(401).json({ message: error.message });
  }
};

const verifyTwoFactorHandler = async (req, res) => {
  try {
    const payload = jwt.verify(req.body.tempToken || '', JWT_SECRET);
    if (!payload || payload.role !== 'admin' || !['admin_2fa', 'admin_2fa_setup'].includes(payload.type)) {
      return res.status(401).json({ message: 'Phien 2FA khong hop le.' });
    }

    const user = await getUserById(payload.sub);
    if (!user || user.role !== 'admin' || user.status !== 'active') {
      return res.status(401).json({ message: 'Tai khoan admin khong hop le.' });
    }

    const secret = payload.type === 'admin_2fa_setup' ? payload.twoFactorSecret : user.twoFactorSecret;
    if (!secret || !verifyTotpCode(secret, req.body.code)) {
      const event = await recordSecurityEvent({
        userId: user.id,
        email: user.email,
        deviceId: req.body.deviceId,
        reason: 'admin_2fa_failed',
        severity: 'high',
        appFlavor: 'backend',
        detail: { ip: req.ip, userAgent: req.get('user-agent') || '' }
      });
      await sendSecurityAlert(event);
      return res.status(401).json({ message: 'Ma 2FA khong dung.' });
    }

    const finalUser = payload.type === 'admin_2fa_setup'
      ? await setAdminTwoFactor(user.id, { secret, enabled: true })
      : publicUser(user);

    return res.json({
      token: signToken(finalUser, { twoFactor: true }),
      user: finalUser
    });
  } catch (error) {
    return res.status(401).json({ message: error.message || 'Phien 2FA da het han.' });
  }
};

const meHandler = (req, res) => {
  res.json({ user: publicUser(req.user) });
};

const rawRouterImageProxyHandler = async (req, res) => {
  try {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';

    if (!isConfiguredSecret(ROUTER_PROXY_API_KEY) || token !== ROUTER_PROXY_API_KEY) {
      return res.status(401).json({ message: 'Unauthorized.' });
    }

    const { upstream, rawText } = await fetchRouterImage(req.body || {});
    return res.status(upstream.status).type(upstream.headers.get('content-type') || 'application/json').send(rawText);
  } catch (error) {
    return res.status(502).json({ message: getFetchErrorMessage(error) || error.message });
  }
};

const imageGenerationHandler = async (req, res) => {
  const deviceId = req.body.deviceId || req.get('x-device-id') || null;

  try {
    await prepareUserForImage({ userId: req.user.id, deviceId });

    if (!hasRouterImageAuth()) {
      const event = await recordImageEvent({
        userId: req.user.id,
        ok: false,
        prompt: req.body.prompt,
        error: 'Server chua cau hinh API key tao anh hop le.',
        deviceId
      });
      await sendSheetEvent(event);
      return res.status(503).json({ message: 'Server chua cau hinh API key tao anh hop le.' });
    }

    const { upstream, rawText } = await fetchRouterImage(req.body);

    if (!upstream.ok) {
      const event = await recordImageEvent({
        userId: req.user.id,
        ok: false,
        prompt: req.body.prompt,
        error: rawText || `HTTP ${upstream.status}`,
        deviceId
      });
      await sendSheetEvent(event);
      return res.status(upstream.status).type('application/json').send(rawText || JSON.stringify({ message: 'Tao anh that bai.' }));
    }

    const event = await recordImageEvent({
      userId: req.user.id,
      ok: true,
      prompt: req.body.prompt,
      deviceId
    });
    await sendSheetEvent(event);
    return res.status(upstream.status).type(upstream.headers.get('content-type') || 'application/json').send(rawText);
  } catch (error) {
    const detail = getFetchErrorMessage(error);
    const failedEndpoint = error.endpoint || preferredRouterImageEndpoint || ROUTER_IMAGE_ENDPOINT;
    const message = detail === 'fetch failed'
      ? `fetch failed: ${getEndpointLabel(failedEndpoint)}`
      : `${detail || error.message}: ${getEndpointLabel(failedEndpoint)}`;
    const event = await recordImageEvent({
      userId: req.user.id,
      ok: false,
      prompt: req.body.prompt,
      error: message,
      deviceId
    });
    await sendSheetEvent(event);
    return res.status(502).json({ message });
  }
};

const statsHandler = async (_req, res) => {
  res.json(await getStats());
};

const routerQuotaHandler = async (_req, res) => {
  const stats = await getStats();

  if (!isConfiguredSecret(ROUTER_API_KEY)) {
    return res.status(503).json({ message: 'Server chua cau hinh API key tao anh hop le.' });
  }

  if (ROUTER_QUOTA_ENDPOINT) {
    try {
      const upstream = await fetch(ROUTER_QUOTA_ENDPOINT, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${ROUTER_API_KEY}`
        }
      });
      const rawText = await upstream.text();
      const body = rawText ? JSON.parse(rawText) : {};

      if (!upstream.ok) {
        return res.status(upstream.status).json({
          message: body.message || body.error || rawText || 'Khong lay duoc quota 9router.'
        });
      }

      return res.json({
        source: '9router',
        ...parseRouterQuota(body, stats.imagesCreated)
      });
    } catch (error) {
      return res.status(502).json({ message: error.message || 'Khong lay duoc quota 9router.' });
    }
  }

  return res.json({
    source: ROUTER_QUOTA_TOTAL ? 'configured' : 'local-usage',
    quotaTotal: ROUTER_QUOTA_TOTAL || null,
    quotaUsed: stats.imagesCreated,
    quotaRemaining: ROUTER_QUOTA_TOTAL ? Math.max(0, ROUTER_QUOTA_TOTAL - stats.imagesCreated) : null
  });
};

const normalizeImageSize = (value) => {
  const sizeValue = String(value || 'auto').trim();
  if (!sizeValue || sizeValue === 'auto') {
    return 'auto';
  }

  const match = sizeValue.match(/^(\d+)x(\d+)$/i);
  if (!match) {
    return sizeValue;
  }

  const width = Number(match[1]);
  const height = Number(match[2]);
  const safeCommonSizes = {
    '1920x1080': '1536x864',
    '1080x1920': '864x1536'
  };
  const mapped = safeCommonSizes[`${width}x${height}`];
  if (mapped) {
    return mapped;
  }

  if (width % 16 === 0 && height % 16 === 0) {
    return `${width}x${height}`;
  }

  return `${Math.max(16, width - (width % 16))}x${Math.max(16, height - (height % 16))}`;
};

const listUsersHandler = async (_req, res) => {
  res.json({ users: await listUsers() });
};

const createUserHandler = async (req, res) => {
  try {
    res.status(201).json({ user: await createUser(req.body) });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updateUserHandler = async (req, res) => {
  try {
    res.json({ user: await updateUser(req.params.id, req.body) });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const eventsHandler = async (req, res) => {
  res.json({ events: await listEvents(req.query.limit) });
};

const createOrderHandler = async (req, res) => {
  try {
    const selectedPlan = salePlans.find((plan) => plan.id === req.body.planId) || salePlans[1];
    let order = await createOrder({
      ...req.body,
      planId: selectedPlan.id,
      planName: selectedPlan.name,
      price: selectedPlan.price,
      quotaTotal: selectedPlan.quotaTotal,
      deviceLimit: selectedPlan.deviceLimit,
      months: selectedPlan.months
    });
    queueSheetEvent({
      type: 'sales_order',
      sheetId: SALES_SHEET_ID,
      paymentRequired: Number(order.price || 0) > 0,
      ...order
    });

    if (Number(order.price || 0) <= 0) {
      order = await activateOrderAccount(order, 'trial');
      queueSheetEvent({
        type: 'sales_trial_registered',
        sheetId: SALES_SHEET_ID,
        ...order
      });
    }

    res.status(201).json({
      order,
      bank: getOrderPaymentInfo(order)
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const listOrdersHandler = async (req, res) => {
  res.json({ orders: await listOrders(req.query.limit) });
};

const getUpdatePolicyHandler = async (req, res) => {
  const policy = await getUpdatePolicy();
  const flavor = String(req.query.flavor || '').toLowerCase();
  const channelAllowed = policy.channel === 'all' || !flavor || policy.channel === flavor;
  res.json({ updatePolicy: { ...policy, enabled: policy.enabled && channelAllowed } });
};

const updatePolicyHandler = async (req, res) => {
  try {
    res.json({ updatePolicy: await updateUpdatePolicy(req.body || {}) });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const listEmailHistoryHandler = async (req, res) => {
  const orders = await listOrders(req.query.limit || 300);
  const users = await listUsers();
  const usersByEmail = new Map(users.map((user) => [String(user.email || '').toLowerCase(), user]));
  const emails = orders
    .filter((order) => order.customerEmailSentAt)
    .map((order) => {
      const user = usersByEmail.get(String(order.accountEmail || order.email || '').toLowerCase()) || null;
      const quotaUsed = Number(user?.quotaUsed || 0);
      const lastLoginAt = user?.lastLoginAt || null;
      const usageStatus = quotaUsed > 0
        ? 'Đã sử dụng app'
        : lastLoginAt
          ? 'Đã đăng nhập, chưa tạo ảnh'
          : 'Chưa đăng nhập';
      const recommendedAction = quotaUsed > 0
        ? 'Không cần xử lý'
        : lastLoginAt
          ? 'Nhắn hướng dẫn tạo ảnh đầu tiên'
          : 'Gọi/Zalo nhắc khách kiểm tra email, spam và gửi lại thông tin đăng nhập nếu cần';

      return {
        id: order.id,
        sentAt: order.customerEmailSentAt,
        to: order.email,
        customerName: order.customerName,
        orderCode: order.code,
        planName: order.planName,
        quotaTotal: order.quotaTotal,
        quotaUsed,
        lastLoginAt,
        usageStatus,
        recommendedAction,
        expiresAt: order.expiresAt,
        status: order.status,
        accountEmail: order.accountEmail || user?.email || order.email
      };
    })
    .sort((left, right) => new Date(right.sentAt).getTime() - new Date(left.sentAt).getTime());

  res.json({ emails });
};

const paymentStatusHandler = async (req, res) => {
  const order = await getOrderByCode(req.params.code);
  if (!order) {
    return res.status(404).json({ paid: false, status: 'not_found', paymentStatus: 'not_found' });
  }

  const paid = order.status === 'paid' || Boolean(order.paidAt);
  return res.json({ paid, status: order.status, paymentStatus: order.status, order });
};

const sepayWebhookHandler = async (req, res) => {
  const payload = req.body || {};
  const webhookText = extractWebhookText(payload);
  const amount = extractWebhookAmount(payload);
  const orders = await listOrders(500);
  const matchedOrder = orders.find((order) => {
    if (order.status === 'paid' || Number(order.price || 0) <= 0) return false;
    const code = normalizePaymentText(order.transferContent || order.code);
    return code && webhookText.includes(code) && amount >= Number(order.price || 0);
  });

  if (!matchedOrder) {
    await recordSecurityEvent({
      type: 'sepay_webhook_unmatched',
      ok: false,
      provider: 'sepay',
      reason: 'No pending order matched webhook content/amount',
      amount,
      content: webhookText.slice(0, 500)
    }).catch(() => {});
    return res.json({ success: true, matched: false });
  }

  let order = await markOrderPaid(matchedOrder.code, {
    provider: 'sepay',
    amount,
    content: webhookText,
    payload
  });
  order = await activateOrderAccount(order, 'paid');
  queueSheetEvent({
    type: 'sales_payment_paid',
    sheetId: SALES_SHEET_ID,
    ...order
  });
  return res.json({ success: true, matched: true, orderCode: order.code });
};

app.post(`${USER_API}/auth/login`, loginHandler);
app.post(`${USER_API}/auth/2fa/verify`, verifyTwoFactorHandler);
app.get(`${USER_API}/auth/me`, requireAuth, meHandler);
app.post('/v1/images/generations', rawRouterImageProxyHandler);
app.post(`${USER_API}/images/generations`, requireAuth, imageGenerationHandler);
app.get('/api/9router/update-policy', getUpdatePolicyHandler);

app.get(`${ADMIN_API}/stats`, allowLocalAdmin, requireAdminAccess, statsHandler);
app.get(`${ADMIN_API}/router-quota`, allowLocalAdmin, requireAdminAccess, routerQuotaHandler);
app.get(`${ADMIN_API}/users`, allowLocalAdmin, requireAdminAccess, listUsersHandler);
app.post(`${ADMIN_API}/users`, allowLocalAdmin, requireAdminAccess, createUserHandler);
app.patch(`${ADMIN_API}/users/:id`, allowLocalAdmin, requireAdminAccess, updateUserHandler);
app.get(`${ADMIN_API}/events`, allowLocalAdmin, requireAdminAccess, eventsHandler);
app.get(`${ADMIN_API}/orders`, allowLocalAdmin, requireAdminAccess, listOrdersHandler);
app.get(`${ADMIN_API}/email-history`, allowLocalAdmin, requireAdminAccess, listEmailHistoryHandler);
app.put(`${ADMIN_API}/update-policy`, allowLocalAdmin, requireAdminAccess, updatePolicyHandler);
app.post('/api/sales/orders', createOrderHandler);
app.get('/api/sales/orders/:code/payment-status', paymentStatusHandler);
app.post('/api/sepay/webhook', sepayWebhookHandler);
app.post('/api/webhooks/sepay', sepayWebhookHandler);
app.post('/api/sales/sepay/webhook', sepayWebhookHandler);

// Backward-compatible aliases for older builds.
app.post('/api/auth/login', loginHandler);
app.post('/api/auth/2fa/verify', verifyTwoFactorHandler);
app.get('/api/auth/me', requireAuth, meHandler);
app.post('/api/images/generations', requireAuth, imageGenerationHandler);
app.get('/api/update-policy', getUpdatePolicyHandler);
app.get('/api/admin/stats', allowLocalAdmin, requireAdminAccess, statsHandler);
app.get('/api/admin/router-quota', allowLocalAdmin, requireAdminAccess, routerQuotaHandler);
app.get('/api/admin/users', allowLocalAdmin, requireAdminAccess, listUsersHandler);
app.post('/api/admin/users', allowLocalAdmin, requireAdminAccess, createUserHandler);
app.patch('/api/admin/users/:id', allowLocalAdmin, requireAdminAccess, updateUserHandler);
app.get('/api/admin/events', allowLocalAdmin, requireAdminAccess, eventsHandler);
app.get('/api/admin/orders', allowLocalAdmin, requireAdminAccess, listOrdersHandler);
app.get('/api/admin/email-history', allowLocalAdmin, requireAdminAccess, listEmailHistoryHandler);
app.put('/api/admin/update-policy', allowLocalAdmin, requireAdminAccess, updatePolicyHandler);

app.use('/image/assets', express.static(path.join(IMAGE_SITE_DIR, 'assets'), {
  maxAge: '7d',
  immutable: true
}));
app.use('/9router-admin', requireAdminPageAuth, express.static(path.join(__dirname, 'public', 'admin')));
app.use('/admin', requireAdminPageAuth, express.static(path.join(__dirname, 'public', 'admin')));

app.use((_req, res) => {
  res.status(404).json({ message: 'Not found' });
});

ensureAdminUser().then(() => {
  app.listen(PORT, () => {
    console.log(`9Router backend listening on http://localhost:${PORT}`);
  });
});
