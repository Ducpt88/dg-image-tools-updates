const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const bcrypt = require('bcryptjs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const defaultDb = {
  users: [],
  events: []
};

const readDb = async () => {
  try {
    const raw = await fs.readFile(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DB_FILE, JSON.stringify(defaultDb, null, 2), 'utf8');
    return structuredClone(defaultDb);
  }
};

const writeDb = async (db) => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
};

const publicUser = (user) => ({
  id: user.id,
  email: user.email,
  role: user.role,
  status: user.status,
  planName: user.planName || 'Gói tháng',
  monthlyPrice: Number(user.monthlyPrice || 99000),
  paymentStatus: user.paymentStatus || 'paid',
  quotaTotal: user.quotaTotal,
  quotaUsed: user.quotaUsed,
  quotaRemaining: Math.max(0, Number(user.quotaTotal || 0) - Number(user.quotaUsed || 0)),
  quotaUnit: 'ảnh',
  expiresAt: user.expiresAt,
  deviceLimit: user.deviceLimit,
  devices: user.devices || [],
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  lastLoginAt: user.lastLoginAt
});

const findUserByEmail = async (email) => {
  const db = await readDb();
  const normalized = String(email || '').trim().toLowerCase();
  return db.users.find((user) => user.email === normalized) || null;
};

const ensureAdminUser = async () => {
  const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || '';

  if (!adminEmail || !adminPassword) {
    return;
  }

  const db = await readDb();
  const existing = db.users.find((user) => user.email === adminEmail);
  if (existing) {
    return;
  }

  const now = new Date().toISOString();
  db.users.push({
    id: crypto.randomUUID(),
    email: adminEmail,
    passwordHash: await bcrypt.hash(adminPassword, 12),
    role: 'admin',
    status: 'active',
    quotaTotal: 999999,
    quotaUsed: 0,
    expiresAt: null,
    deviceLimit: 5,
    devices: [],
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null
  });
  await writeDb(db);
};

const createUser = async ({
  email,
  password,
  role = 'user',
  planName = 'Gói tháng',
  monthlyPrice = 99000,
  paymentStatus = 'paid',
  quotaTotal = 100,
  expiresAt = null,
  deviceLimit = 1
}) => {
  const db = await readDb();
  const normalized = String(email || '').trim().toLowerCase();

  if (!normalized || !password) {
    throw new Error('Email và mật khẩu là bắt buộc.');
  }

  if (db.users.some((user) => user.email === normalized)) {
    throw new Error('Email đã tồn tại.');
  }

  const now = new Date().toISOString();
  const user = {
    id: crypto.randomUUID(),
    email: normalized,
    passwordHash: await bcrypt.hash(password, 12),
    role,
    status: 'active',
    planName,
    monthlyPrice: Number(monthlyPrice) || 0,
    paymentStatus,
    quotaTotal: Number(quotaTotal) || 0,
    quotaUsed: 0,
    expiresAt: expiresAt || null,
    deviceLimit: Number(deviceLimit) || 1,
    devices: [],
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null
  };
  db.users.push(user);
  await writeDb(db);
  return publicUser(user);
};

const updateUser = async (id, changes) => {
  const db = await readDb();
  const user = db.users.find((item) => item.id === id);

  if (!user) {
    throw new Error('Không tìm thấy tài khoản.');
  }

  ['role', 'status', 'planName', 'monthlyPrice', 'paymentStatus', 'quotaTotal', 'quotaUsed', 'expiresAt', 'deviceLimit'].forEach((key) => {
    if (Object.hasOwn(changes, key)) {
      user[key] = ['quotaTotal', 'quotaUsed', 'deviceLimit'].includes(key) ? Number(changes[key]) : changes[key];
    }
  });

  if (changes.password) {
    user.passwordHash = await bcrypt.hash(changes.password, 12);
  }

  if (changes.clearDevices) {
    user.devices = [];
  }

  user.updatedAt = new Date().toISOString();
  await writeDb(db);
  return publicUser(user);
};

const validateUserForUse = (user, deviceId, quotaCost = 1) => {
  if (!user || user.status !== 'active') {
    throw new Error('Tài khoản đã bị khóa hoặc không tồn tại.');
  }

  if (user.expiresAt && new Date(user.expiresAt).getTime() < Date.now()) {
    throw new Error('Tài khoản đã hết hạn.');
  }

  if ((Number(user.quotaUsed || 0) + Number(quotaCost || 1)) > Number(user.quotaTotal || 0)) {
    throw new Error('Tài khoản đã hết quota tạo ảnh.');
  }

  if (deviceId) {
    user.devices ||= [];
    if (!user.devices.includes(deviceId)) {
      if (user.devices.length >= Number(user.deviceLimit || 1)) {
        throw new Error('Tài khoản đã vượt giới hạn thiết bị.');
      }
      user.devices.push(deviceId);
    }
  }
};

const authenticateUser = async ({ email, password, deviceId }) => {
  const db = await readDb();
  const normalized = String(email || '').trim().toLowerCase();
  const user = db.users.find((item) => item.email === normalized);

  if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) {
    throw new Error('Email hoặc mật khẩu không đúng.');
  }

  validateUserForUse(user, deviceId);
  user.lastLoginAt = new Date().toISOString();
  user.updatedAt = user.lastLoginAt;
  await writeDb(db);
  return publicUser(user);
};

const getUserById = async (id) => {
  const db = await readDb();
  return db.users.find((user) => user.id === id) || null;
};

const listUsers = async () => {
  const db = await readDb();
  return db.users.map(publicUser);
};

const recordImageEvent = async ({ userId, ok, prompt, error, savedPath, deviceId, quotaCost = 1 }) => {
  const db = await readDb();
  const user = db.users.find((item) => item.id === userId);
  const now = new Date().toISOString();
  const event = {
    id: crypto.randomUUID(),
    userId,
    email: user?.email || '',
    ok: Boolean(ok),
    prompt: String(prompt || '').slice(0, 1000),
    error: error ? String(error).slice(0, 1000) : null,
    savedPath: savedPath || null,
    deviceId: deviceId || null,
    createdAt: now
  };

  db.events.push(event);
  if (user && ok) {
    user.quotaUsed = Number(user.quotaUsed || 0) + Number(quotaCost || 1);
    user.updatedAt = now;
  }

  await writeDb(db);
  return event;
};

const listEvents = async (limit = 200) => {
  const db = await readDb();
  return db.events.slice(-Number(limit || 200)).reverse();
};

const getStats = async () => {
  const db = await readDb();
  const today = new Date().toISOString().slice(0, 10);
  const now = Date.now();
  const sevenDaysFromNow = now + (7 * 24 * 60 * 60 * 1000);
  const activeUsers = db.users.filter((user) => user.status === 'active');

  return {
    users: db.users.length,
    activeUsers: activeUsers.length,
    blockedUsers: db.users.filter((user) => user.status !== 'active').length,
    expiredUsers: db.users.filter((user) => user.expiresAt && new Date(user.expiresAt).getTime() < now).length,
    expiringSoonUsers: db.users.filter((user) => {
      if (!user.expiresAt) {
        return false;
      }

      const expiresAt = new Date(user.expiresAt).getTime();
      return expiresAt >= now && expiresAt <= sevenDaysFromNow;
    }).length,
    estimatedMonthlyRevenue: activeUsers.reduce((total, user) => total + Number(user.monthlyPrice || 0), 0),
    imagesCreated: db.events.filter((event) => event.ok).length,
    imagesToday: db.events.filter((event) => event.ok && event.createdAt.startsWith(today)).length,
    failures: db.events.filter((event) => !event.ok).length
  };
};

module.exports = {
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
};
