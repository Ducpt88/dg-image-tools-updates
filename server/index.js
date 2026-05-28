require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const path = require('node:path');
const {
  ensureAdminUser,
  authenticateUser,
  createUser,
  updateUser,
  getUserById,
  listUsers,
  publicUser,
  validateUserForUse,
  recordImageEvent,
  recordSecurityEvent,
  listEvents,
  getStats,
  createOrder,
  listOrders
} = require('./store');

const app = express();
const PORT = Number(process.env.PORT || 3030);
const isProduction = process.env.NODE_ENV === 'production';
const DEFAULT_JWT_SECRET = 'change-this-secret-before-production';
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
const ROUTER_IMAGE_ENDPOINT = process.env.ROUTER_IMAGE_ENDPOINT || 'http://localhost:20128/v1/images/generations';
const ROUTER_QUOTA_ENDPOINT = process.env.ROUTER_QUOTA_ENDPOINT || '';
const ROUTER_QUOTA_TOTAL = Number(process.env.ROUTER_QUOTA_TOTAL || 0);
const ROUTER_API_KEY = process.env.ROUTER_API_KEY || '';
const SHEETS_WEBHOOK_URL = process.env.SHEETS_WEBHOOK_URL || '';
const ADMIN_ALERT_EMAIL = process.env.ADMIN_ALERT_EMAIL || 'hoangvant77internet@gmail.com';
const SALES_SHEET_ID = process.env.SALES_SHEET_ID || '1YL2mY6uYJCNrLASNjev7g7XDiPYVi4wBy8S_V7Ntlzg';
const BANK_ID = process.env.BANK_ID || '';
const BANK_ACCOUNT_NO = process.env.BANK_ACCOUNT_NO || '';
const BANK_ACCOUNT_NAME = process.env.BANK_ACCOUNT_NAME || '';
const SITE_IMAGE_URL = process.env.SITE_IMAGE_URL || 'https://ducpt.com/image';
const PAYMENT_IMAGES = {
  monthly: '/image/assets/payment-99000.svg',
  vip: '/image/assets/payment-199000.svg'
};
const IMAGE_SITE_DIR = path.join(__dirname, '..', 'image');
const USER_API = '/api/9router/user';
const ADMIN_API = '/api/9router/admin';
const LOCAL_ADMIN_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

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
      "img-src": ["'self'", 'data:', 'https://img.vietqr.io'],
      "connect-src": ["'self'", 'https://script.google.com', 'https://script.googleusercontent.com']
    }
  }
}));
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  const origin = req.get('origin') || '';
  const allowedOrigins = new Set([
    'https://ducpt.com',
    'https://www.ducpt.com',
    'http://localhost:3030'
  ]);

  if (allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
});
app.use(rateLimit({
  windowMs: 60 * 1000,
  limit: 120
}));

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

const buildVietQrUrl = ({ amount, content }) => {
  if (!BANK_ID || !BANK_ACCOUNT_NO || !amount) {
    return '';
  }

  const query = new URLSearchParams({
    amount: String(amount),
    addInfo: content,
    accountName: BANK_ACCOUNT_NAME || 'DG IMAGE TOOLS'
  });
  return `https://img.vietqr.io/image/${encodeURIComponent(BANK_ID)}-${encodeURIComponent(BANK_ACCOUNT_NO)}-compact2.png?${query.toString()}`;
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

const signToken = (user) => jwt.sign(
  {
    sub: user.id,
    role: user.role,
    email: user.email
  },
  JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
);

const sendSheetEvent = async (event) => {
  if (!SHEETS_WEBHOOK_URL) {
    return;
  }

  try {
    await fetch(SHEETS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });
  } catch (error) {
    console.error('Sheet webhook failed:', error.message);
  }
};

const sendSecurityAlert = async (event) => sendSheetEvent({
  type: 'security_alert',
  alertEmail: ADMIN_ALERT_EMAIL,
  subject: `[DG Image Tools] Canh bao bao mat: ${event.reason}`,
  ...event
});

const readQuotaNumber = (data, keys) => {
  for (const key of keys) {
    const value = key.split('.').reduce((target, part) => target?.[part], data);
    if (Number.isFinite(Number(value))) {
      return Number(value);
    }
  }

  return null;
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

const meHandler = (req, res) => {
  res.json({ user: publicUser(req.user) });
};

const imageGenerationHandler = async (req, res) => {
  const deviceId = req.body.deviceId || req.get('x-device-id') || null;

  try {
    validateUserForUse(req.user, deviceId);

    if (!ROUTER_API_KEY) {
      throw new Error('Server chưa cấu hình ROUTER_API_KEY.');
    }

    const payload = {
      model: req.body.model,
      prompt: req.body.prompt,
      n: req.body.n || 1,
      size: normalizeImageSize(req.body.size),
      quality: req.body.quality,
      background: req.body.background,
      image_detail: req.body.image_detail,
      output_format: req.body.output_format
    };

    if (req.body.image) {
      payload.image = req.body.image;
    }

    const upstream = await fetch(ROUTER_IMAGE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ROUTER_API_KEY}`,
        Accept: 'text/event-stream'
      },
      body: JSON.stringify(payload)
    });
    const rawText = await upstream.text();

    if (!upstream.ok) {
      const event = await recordImageEvent({
        userId: req.user.id,
        ok: false,
        prompt: req.body.prompt,
        error: rawText || `HTTP ${upstream.status}`,
        deviceId
      });
      await sendSheetEvent(event);
      return res.status(upstream.status).type('application/json').send(rawText || JSON.stringify({ message: 'Tạo ảnh thất bại.' }));
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
    const event = await recordImageEvent({
      userId: req.user.id,
      ok: false,
      prompt: req.body.prompt,
      error: error.message,
      deviceId
    });
    await sendSheetEvent(event);
    return res.status(403).json({ message: error.message });
  }
};

const statsHandler = async (_req, res) => {
  res.json(await getStats());
};

const routerQuotaHandler = async (_req, res) => {
  const stats = await getStats();

  if (!ROUTER_API_KEY) {
    return res.status(503).json({ message: 'Server chua cau hinh ROUTER_API_KEY.' });
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
    const order = await createOrder({
      ...req.body,
      planId: selectedPlan.id,
      planName: selectedPlan.name,
      price: selectedPlan.price,
      quotaTotal: selectedPlan.quotaTotal,
      deviceLimit: selectedPlan.deviceLimit,
      months: selectedPlan.months
    });
    await sendSheetEvent({
      type: 'sales_order',
      sheetId: SALES_SHEET_ID,
      paymentRequired: Number(order.price || 0) > 0,
      ...order
    });
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

app.post(`${USER_API}/auth/login`, loginHandler);
app.get(`${USER_API}/auth/me`, requireAuth, meHandler);
app.post(`${USER_API}/images/generations`, requireAuth, imageGenerationHandler);

app.get(`${ADMIN_API}/stats`, allowLocalAdmin, requireAdminAccess, statsHandler);
app.get(`${ADMIN_API}/router-quota`, allowLocalAdmin, requireAdminAccess, routerQuotaHandler);
app.get(`${ADMIN_API}/users`, allowLocalAdmin, requireAdminAccess, listUsersHandler);
app.post(`${ADMIN_API}/users`, allowLocalAdmin, requireAdminAccess, createUserHandler);
app.patch(`${ADMIN_API}/users/:id`, allowLocalAdmin, requireAdminAccess, updateUserHandler);
app.get(`${ADMIN_API}/events`, allowLocalAdmin, requireAdminAccess, eventsHandler);
app.get(`${ADMIN_API}/orders`, allowLocalAdmin, requireAdminAccess, listOrdersHandler);
app.post('/api/sales/orders', createOrderHandler);

// Backward-compatible aliases for older builds.
app.post('/api/auth/login', loginHandler);
app.get('/api/auth/me', requireAuth, meHandler);
app.post('/api/images/generations', requireAuth, imageGenerationHandler);
app.get('/api/admin/stats', allowLocalAdmin, requireAdminAccess, statsHandler);
app.get('/api/admin/router-quota', allowLocalAdmin, requireAdminAccess, routerQuotaHandler);
app.get('/api/admin/users', allowLocalAdmin, requireAdminAccess, listUsersHandler);
app.post('/api/admin/users', allowLocalAdmin, requireAdminAccess, createUserHandler);
app.patch('/api/admin/users/:id', allowLocalAdmin, requireAdminAccess, updateUserHandler);
app.get('/api/admin/events', allowLocalAdmin, requireAdminAccess, eventsHandler);
app.get('/api/admin/orders', allowLocalAdmin, requireAdminAccess, listOrdersHandler);

app.use('/image/assets', express.static(path.join(IMAGE_SITE_DIR, 'assets'), {
  maxAge: '7d',
  immutable: true
}));
app.use('/9router-admin', express.static(path.join(__dirname, 'public', 'admin')));
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));

app.use((_req, res) => {
  res.status(404).json({ message: 'Not found' });
});

ensureAdminUser().then(() => {
  app.listen(PORT, () => {
    console.log(`9Router backend listening on http://localhost:${PORT}`);
  });
});
