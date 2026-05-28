const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const bcrypt = require('bcryptjs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const MAX_BACKUPS = Number(process.env.DATA_BACKUP_LIMIT || 80);
const FALLBACK_ADMIN_EMAIL = 'admin@example.com';
const FALLBACK_ADMIN_PASSWORD = 'image-dg09';

const defaultDb = {
  users: [],
  events: [],
  orders: []
};

const readDb = async () => {
  try {
    const raw = await fs.readFile(DB_FILE, 'utf8');
    try {
      return JSON.parse(raw);
    } catch (error) {
      await fs.mkdir(BACKUP_DIR, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      await fs.writeFile(path.join(BACKUP_DIR, `db-corrupt-${stamp}.json`), raw, 'utf8');
      throw new Error(`Database khach hang bi loi dinh dang JSON. Da sao luu ban loi vao ${BACKUP_DIR}.`);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }

    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DB_FILE, JSON.stringify(defaultDb, null, 2), 'utf8');
    return structuredClone(defaultDb);
  }
};

const writeDb = async (db) => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(BACKUP_DIR, { recursive: true });

  try {
    const existing = await fs.readFile(DB_FILE, 'utf8');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await fs.writeFile(path.join(BACKUP_DIR, `db-${stamp}.json`), existing, 'utf8');

    const backups = (await fs.readdir(BACKUP_DIR))
      .filter((name) => /^db-.+\.json$/.test(name))
      .sort();
    await Promise.all(backups.slice(0, Math.max(0, backups.length - MAX_BACKUPS)).map((name) => (
      fs.unlink(path.join(BACKUP_DIR, name)).catch(() => {})
    )));
  } catch {
    // First write, no previous database to back up yet.
  }

  const tempFile = `${DB_FILE}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(db, null, 2), 'utf8');
  await fs.rename(tempFile, DB_FILE);
};

const getStorageInfo = () => ({
  dataDir: DATA_DIR,
  dbFile: DB_FILE,
  backupDir: BACKUP_DIR,
  backupLimit: MAX_BACKUPS
});

const publicUser = (user) => ({
  id: user.id,
  email: user.email,
  role: user.role,
  status: user.status,
  planName: user.planName || 'Gói tháng',
  monthlyPrice: Number(user.monthlyPrice || 0),
  paymentStatus: user.paymentStatus || 'paid',
  quotaTotal: user.quotaTotal,
  quotaUsed: user.quotaUsed,
  quotaRemaining: Math.max(0, Number(user.quotaTotal || 0) - Number(user.quotaUsed || 0)),
  quotaUnit: 'ảnh',
  durationDays: Number(user.durationDays || 0),
  activatedAt: user.activatedAt || null,
  expiresAt: user.expiresAt,
  deviceLimit: user.deviceLimit,
  devices: user.devices || [],
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  lastLoginAt: user.lastLoginAt,
  twoFactorEnabled: Boolean(user.twoFactorEnabled)
});

const addDaysIso = (startIso, days) => {
  const duration = Number(days || 0);
  if (!Number.isFinite(duration) || duration <= 0) {
    return null;
  }

  const start = new Date(startIso);
  start.setUTCDate(start.getUTCDate() + duration);
  return start.toISOString();
};

const activateUserIfNeeded = (user, nowIso = new Date().toISOString()) => {
  if (!user || user.role === 'admin') {
    return false;
  }

  let changed = false;
  if (!user.activatedAt) {
    user.activatedAt = nowIso;
    changed = true;
  }

  const durationDays = Number(user.durationDays || 0);
  if (durationDays > 0 && !user.expiresAt) {
    user.expiresAt = addDaysIso(user.activatedAt, durationDays);
    changed = true;
  }

  return changed;
};

const findUserByEmail = async (email) => {
  const db = await readDb();
  const normalized = String(email || '').trim().toLowerCase();
  return db.users.find((user) => user.email === normalized) || null;
};

const ensureAdminUser = async () => {
  const db = await readDb();
  const ensureAdmin = async (email, password) => {
    const adminEmail = String(email || '').trim().toLowerCase();
    const adminPassword = String(password || '');

    if (!adminEmail || !adminPassword) {
      return false;
    }

    const existing = db.users.find((user) => user.email === adminEmail);
    if (!existing) {
      const now = new Date().toISOString();
      db.users.push({
        id: crypto.randomUUID(),
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 12),
        role: 'admin',
        status: 'active',
        quotaTotal: 999999,
        quotaUsed: 0,
        durationDays: 0,
        activatedAt: null,
        expiresAt: null,
        deviceLimit: 5,
        devices: [],
        createdAt: now,
        updatedAt: now,
        lastLoginAt: null
      });
      return true;
    }

    let changed = false;

    if (!(await bcrypt.compare(adminPassword, existing.passwordHash || ''))) {
      existing.passwordHash = await bcrypt.hash(adminPassword, 12);
      changed = true;
    }

    if (existing.role !== 'admin') {
      existing.role = 'admin';
      changed = true;
    }

    if (existing.status !== 'active') {
      existing.status = 'active';
      changed = true;
    }

    if (Number(existing.quotaTotal || 0) < 999999) {
      existing.quotaTotal = 999999;
      changed = true;
    }

    if (Number(existing.deviceLimit || 0) < 999) {
      existing.deviceLimit = 999;
      changed = true;
    }

    if (changed) {
      existing.updatedAt = new Date().toISOString();
    }

    return changed;
  };

  let changed = false;
  changed = (await ensureAdmin(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD)) || changed;
  changed = (await ensureAdmin(FALLBACK_ADMIN_EMAIL, FALLBACK_ADMIN_PASSWORD)) || changed;

  if (changed) {
    await writeDb(db);
  }
};

const createUser = async ({
  email,
  password,
  role = 'user',
  planName = 'Gói tháng',
  monthlyPrice = 99000,
  paymentStatus = 'paid',
  quotaTotal = 100,
  durationDays = 30,
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
    durationDays: Number(durationDays) || 0,
    activatedAt: null,
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

const createOrUpdateSalesUser = async ({
  email,
  password,
  planName = 'Goi thang',
  monthlyPrice = 99000,
  paymentStatus = 'paid',
  quotaTotal = 100,
  expiresAt = null,
  deviceLimit = 1
}) => {
  const db = await readDb();
  const normalized = String(email || '').trim().toLowerCase();

  if (!normalized || !password) {
    throw new Error('Email va mat khau la bat buoc.');
  }

  const now = new Date().toISOString();
  let user = db.users.find((item) => item.email === normalized);
  const passwordHash = await bcrypt.hash(password, 12);

  if (user) {
    user.passwordHash = passwordHash;
    user.status = 'active';
    user.role = user.role || 'user';
    user.planName = planName;
    user.monthlyPrice = Number(monthlyPrice) || 0;
    user.paymentStatus = paymentStatus;
    user.quotaTotal = Math.max(Number(user.quotaTotal || 0), Number(quotaTotal || 0));
    user.quotaUsed = Number(user.quotaUsed || 0);
    user.expiresAt = expiresAt || user.expiresAt || null;
    user.deviceLimit = Math.max(Number(user.deviceLimit || 1), Number(deviceLimit || 1));
    user.updatedAt = now;
  } else {
    user = {
      id: crypto.randomUUID(),
      email: normalized,
      passwordHash,
      role: 'user',
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
  }

  await writeDb(db);
  return publicUser(user);
};

const publicOrder = (order) => ({
  id: order.id,
  code: order.code,
  customerName: order.customerName,
  email: order.email,
  phone: order.phone,
  planId: order.planId,
  planName: order.planName,
  price: Number(order.price || 0),
  quotaTotal: Number(order.quotaTotal || 0),
  deviceLimit: Number(order.deviceLimit || 1),
  months: Number(order.months || 1),
  status: order.status || 'pending_payment',
  transferContent: order.transferContent,
  note: order.note || '',
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
  paidAt: order.paidAt || null,
  payment: order.payment || null,
  accountEmail: order.accountEmail || '',
  accountUserId: order.accountUserId || '',
  accountCreatedAt: order.accountCreatedAt || null,
  customerEmailSentAt: order.customerEmailSentAt || null,
  expiresAt: order.expiresAt || null
});

const createOrder = async ({
  customerName,
  email,
  phone,
  planId,
  planName,
  price,
  quotaTotal,
  deviceLimit = 1,
  months = 1,
  note = ''
}) => {
  const db = await readDb();
  db.orders ||= [];

  const normalizedEmail = String(email || '').trim().toLowerCase();
  const cleanPhone = String(phone || '').trim();
  const cleanName = String(customerName || '').trim();

  if (!cleanName || !normalizedEmail || !cleanPhone) {
    throw new Error('Vui long nhap day du ho ten, email va so dien thoai.');
  }

  const now = new Date().toISOString();
  const code = `DG${Date.now().toString(36).toUpperCase().slice(-6)}${crypto.randomInt(100, 999)}`;
  const order = {
    id: crypto.randomUUID(),
    code,
    customerName: cleanName,
    email: normalizedEmail,
    phone: cleanPhone,
    planId: String(planId || 'monthly'),
    planName: String(planName || 'Goi thang'),
    price: Number(price || 0),
    quotaTotal: Number(quotaTotal || 0),
    deviceLimit: Number(deviceLimit || 1),
    months: Number(months || 1),
    status: Number(price || 0) > 0 ? 'pending_payment' : 'trial_registered',
    transferContent: code,
    note: String(note || '').trim().slice(0, 1000),
    createdAt: now,
    updatedAt: now
  };

  db.orders.push(order);
  await writeDb(db);
  return publicOrder(order);
};

const listOrders = async (limit = 200) => {
  const db = await readDb();
  return (db.orders || []).slice(-Number(limit || 200)).reverse().map(publicOrder);
};

const getOrderByCode = async (code) => {
  const db = await readDb();
  const cleanCode = String(code || '').trim();
  const order = (db.orders || []).find((item) => item.code === cleanCode || item.transferContent === cleanCode);
  return order ? publicOrder(order) : null;
};

const markOrderPaid = async (code, payment = {}) => {
  const db = await readDb();
  const cleanCode = String(code || '').trim();
  const order = (db.orders || []).find((item) => item.code === cleanCode || item.transferContent === cleanCode);

  if (!order) {
    throw new Error('Order not found.');
  }

  const now = new Date().toISOString();
  order.status = 'paid';
  order.paidAt = order.paidAt || now;
  order.payment = {
    ...(order.payment || {}),
    ...payment,
    confirmedAt: now
  };
  order.updatedAt = now;
  await writeDb(db);
  return publicOrder(order);
};

const attachOrderAccount = async (code, { user, emailedAt = null, expiresAt = null } = {}) => {
  const db = await readDb();
  const cleanCode = String(code || '').trim();
  const order = (db.orders || []).find((item) => item.code === cleanCode || item.transferContent === cleanCode);

  if (!order) {
    throw new Error('Order not found.');
  }

  const now = new Date().toISOString();
  if (user) {
    order.accountEmail = user.email;
    order.accountUserId = user.id;
    order.accountCreatedAt = order.accountCreatedAt || now;
  }
  if (emailedAt) {
    order.customerEmailSentAt = emailedAt;
  }
  if (expiresAt) {
    order.expiresAt = expiresAt;
  }
  order.updatedAt = now;
  await writeDb(db);
  return publicOrder(order);
};

const updateUser = async (id, changes) => {
  const db = await readDb();
  const user = db.users.find((item) => item.id === id);

  if (!user) {
    throw new Error('Không tìm thấy tài khoản.');
  }

  if (Object.hasOwn(changes, 'email')) {
    const normalized = String(changes.email || '').trim().toLowerCase();
    if (!normalized) {
      throw new Error('Email la bat buoc.');
    }
    if (db.users.some((item) => item.id !== id && item.email === normalized)) {
      throw new Error('Email da ton tai.');
    }
    user.email = normalized;
  }

  ['role', 'status', 'planName', 'monthlyPrice', 'paymentStatus', 'quotaTotal', 'quotaUsed', 'durationDays', 'activatedAt', 'expiresAt', 'deviceLimit'].forEach((key) => {
    if (Object.hasOwn(changes, key)) {
      user[key] = ['monthlyPrice', 'quotaTotal', 'quotaUsed', 'durationDays', 'deviceLimit'].includes(key) ? Number(changes[key]) : changes[key];
    }
  });

  if (Object.hasOwn(changes, 'durationDays') && user.activatedAt && !Object.hasOwn(changes, 'expiresAt')) {
    user.expiresAt = addDaysIso(user.activatedAt, user.durationDays);
  }

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

const setAdminTwoFactor = async (id, { secret, enabled = true }) => {
  const db = await readDb();
  const user = db.users.find((item) => item.id === id);

  if (!user || user.role !== 'admin') {
    throw new Error('Khong tim thay tai khoan admin.');
  }

  user.twoFactorSecret = String(secret || '').trim();
  user.twoFactorEnabled = Boolean(enabled && user.twoFactorSecret);
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

  const now = new Date().toISOString();
  activateUserIfNeeded(user, now);
  validateUserForUse(user, deviceId);
  user.lastLoginAt = now;
  user.updatedAt = user.lastLoginAt;
  await writeDb(db);
  return publicUser(user);
};

const prepareUserForImage = async ({ userId, deviceId, quotaCost = 1 }) => {
  const db = await readDb();
  const user = db.users.find((item) => item.id === userId);
  const now = new Date().toISOString();

  activateUserIfNeeded(user, now);
  validateUserForUse(user, deviceId, quotaCost);
  if (user) {
    user.updatedAt = now;
  }
  await writeDb(db);
  return user ? publicUser(user) : null;
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

const recordSecurityEvent = async ({
  userId = '',
  email = '',
  deviceId = '',
  reason,
  severity = 'medium',
  appFlavor = '',
  appVersion = '',
  detail = {}
}) => {
  const db = await readDb();
  const now = new Date().toISOString();
  const event = {
    id: crypto.randomUUID(),
    type: 'security',
    ok: false,
    userId,
    email,
    deviceId,
    reason: String(reason || 'security_event').slice(0, 120),
    severity: String(severity || 'medium').slice(0, 30),
    appFlavor,
    appVersion,
    detail: JSON.stringify(detail || {}).slice(0, 1000),
    error: String(reason || 'security_event').slice(0, 1000),
    prompt: '',
    savedPath: null,
    createdAt: now
  };

  db.events.push(event);
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
  createOrUpdateSalesUser,
  updateUser,
  getUserById,
  listUsers,
  publicUser,
  setAdminTwoFactor,
  prepareUserForImage,
  validateUserForUse,
  recordImageEvent,
  recordSecurityEvent,
  listEvents,
  getStats,
  getStorageInfo,
  createOrder,
  listOrders,
  getOrderByCode,
  markOrderPaid,
  attachOrderAccount
};
