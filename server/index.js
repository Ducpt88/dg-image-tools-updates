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
  listEvents,
  getStats
} = require('./store');

const app = express();
const PORT = Number(process.env.PORT || 3030);
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-before-production';
const ROUTER_IMAGE_ENDPOINT = process.env.ROUTER_IMAGE_ENDPOINT || 'http://localhost:20128/v1/images/generations';
const ROUTER_API_KEY = process.env.ROUTER_API_KEY || '';
const SHEETS_WEBHOOK_URL = process.env.SHEETS_WEBHOOK_URL || '';
const USER_API = '/api/9router/user';
const ADMIN_API = '/api/9router/admin';
const LOCAL_ADMIN_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(express.json({ limit: '2mb' }));
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
    <p><a href="/image">Mo danh muc image</a></p>
  </main>
</body>
</html>`);
});

app.get('/image', (_req, res) => {
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
    <p>Danh muc image dang ket noi voi API cua app desktop.</p>
  </main>
</body>
</html>`);
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

  if (!req.get('authorization') && LOCAL_ADMIN_HOSTS.has(hostname)) {
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
      size: req.body.size,
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

app.post(`${USER_API}/auth/login`, loginHandler);
app.get(`${USER_API}/auth/me`, requireAuth, meHandler);
app.post(`${USER_API}/images/generations`, requireAuth, imageGenerationHandler);

app.get(`${ADMIN_API}/stats`, allowLocalAdmin, requireAdminAccess, statsHandler);
app.get(`${ADMIN_API}/users`, allowLocalAdmin, requireAdminAccess, listUsersHandler);
app.post(`${ADMIN_API}/users`, allowLocalAdmin, requireAdminAccess, createUserHandler);
app.patch(`${ADMIN_API}/users/:id`, allowLocalAdmin, requireAdminAccess, updateUserHandler);
app.get(`${ADMIN_API}/events`, allowLocalAdmin, requireAdminAccess, eventsHandler);

// Backward-compatible aliases for older builds.
app.post('/api/auth/login', loginHandler);
app.get('/api/auth/me', requireAuth, meHandler);
app.post('/api/images/generations', requireAuth, imageGenerationHandler);
app.get('/api/admin/stats', allowLocalAdmin, requireAdminAccess, statsHandler);
app.get('/api/admin/users', allowLocalAdmin, requireAdminAccess, listUsersHandler);
app.post('/api/admin/users', allowLocalAdmin, requireAdminAccess, createUserHandler);
app.patch('/api/admin/users/:id', allowLocalAdmin, requireAdminAccess, updateUserHandler);
app.get('/api/admin/events', allowLocalAdmin, requireAdminAccess, eventsHandler);

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
