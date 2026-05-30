const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const bcrypt = require('bcryptjs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const MAX_BACKUPS = Number(process.env.DATA_BACKUP_LIMIT || 80);

const ADMIN_EMAILS = new Set([
  'admin@example.com',
  'hoangvant77internet@gmail.com'
]);
const ADMIN_QUOTA_TOTAL = 999999999;
const ADMIN_DEVICE_LIMIT = 999999;
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || '';

const getConfiguredAdminCredentials = () => {
  const configuredEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const configuredPassword = process.env.ADMIN_PASSWORD || '';
  const credentials = DEFAULT_ADMIN_PASSWORD
    ? [...ADMIN_EMAILS].map((email) => ({ email, password: DEFAULT_ADMIN_PASSWORD }))
    : [];

  if (configuredEmail && configuredPassword) {
    const existing = credentials.find((item) => item.email === configuredEmail);
    if (existing) {
      existing.password = configuredPassword;
    } else {
      credentials.push({ email: configuredEmail, password: configuredPassword });
    }
  }

  return credentials;
};

const isUnrestrictedAdmin = (user) => (
  user?.role === 'admin' || ADMIN_EMAILS.has(String(user?.email || '').trim().toLowerCase())
);

const normalizeAdminUser = (user) => {
  if (!isUnrestrictedAdmin(user)) {
    return user;
  }

  user.role = 'admin';
  user.status = 'active';
  user.quotaTotal = ADMIN_QUOTA_TOTAL;
  user.quotaUsed = 0;
  user.expiresAt = null;
  user.deviceLimit = ADMIN_DEVICE_LIMIT;
  user.devices ||= [];
  return user;
};


const defaultDb = {
  users: [],
  events: [],
  orders: [],
  updatePolicy: {
    enabled: false,
    channel: 'user',
    latestVersion: '',
    minimumVersion: '',
    forceUpdate: false,
    installerUrl: '',
    sha512: '',
    releaseNotes: '',
    rolloutPercent: 100,
    updatedAt: null
  }
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

const publicUser = (user) => {
  normalizeAdminUser(user);
  return {
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
  expiresAt: user.expiresAt,
  deviceLimit: user.deviceLimit,
  devices: user.devices || [],
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  lastLoginAt: user.lastLoginAt
  };
};

const findUserByEmail = async (email) => {
  const db = await readDb();
  const normalized = String(email || '').trim().toLowerCase();
  return db.users.find((user) => user.email === normalized) || null;
};

const ensureAdminUser = async () => {
  const db = await readDb();
  const now = new Date().toISOString();

  for (const { email, password } of getConfiguredAdminCredentials()) {
    const existing = db.users.find((user) => user.email === email);
    if (existing) {
      normalizeAdminUser(existing);
      if (!(await bcrypt.compare(password, existing.passwordHash || ''))) {
        existing.passwordHash = await bcrypt.hash(password, 12);
      }
      existing.updatedAt = now;
      continue;
    }

    db.users.push({
      id: crypto.randomUUID(),
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: 'admin',
      status: 'active',
      quotaTotal: ADMIN_QUOTA_TOTAL,
      quotaUsed: 0,
      expiresAt: null,
      deviceLimit: ADMIN_DEVICE_LIMIT,
      devices: [],
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null
    });
  }

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
  paidAt: order.paidAt || null,
  expiresAt: order.expiresAt || null,
  accountEmail: order.accountEmail || null,
  accountUserId: order.accountUserId || null,
  customerEmailSentAt: order.customerEmailSentAt || null,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt
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
  const normalized = String(code || '').trim().toUpperCase();
  const order = (db.orders || []).find((item) => String(item.code || '').toUpperCase() === normalized);
  return order ? publicOrder(order) : null;
};

const markOrderPaid = async (code, payment = {}) => {
  const db = await readDb();
  const normalized = String(code || '').trim().toUpperCase();
  const order = (db.orders || []).find((item) => String(item.code || '').toUpperCase() === normalized);
  if (!order) {
    throw new Error('Khong tim thay don hang.');
  }
  const now = new Date().toISOString();
  order.status = 'paid';
  order.paidAt = order.paidAt || now;
  order.payment = { ...(order.payment || {}), ...payment, updatedAt: now };
  order.updatedAt = now;
  await writeDb(db);
  return publicOrder(order);
};

const attachOrderAccount = async (code, payload = {}) => {
  const db = await readDb();
  const normalized = String(code || '').trim().toUpperCase();
  const order = (db.orders || []).find((item) => String(item.code || '').toUpperCase() === normalized);
  if (!order) {
    throw new Error('Khong tim thay don hang.');
  }
  const now = new Date().toISOString();
  if (payload.user) {
    order.accountUserId = payload.user.id;
    order.accountEmail = payload.user.email;
  }
  if (payload.expiresAt) order.expiresAt = payload.expiresAt;
  if (payload.emailedAt) order.customerEmailSentAt = payload.emailedAt;
  order.updatedAt = now;
  await writeDb(db);
  return publicOrder(order);
};

const createOrUpdateSalesUser = async ({
  email,
  planName,
  monthlyPrice,
  paymentStatus,
  quotaTotal,
  expiresAt,
  deviceLimit
}) => {
  const db = await readDb();
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) {
    throw new Error('Email la bat buoc.');
  }
  const now = new Date().toISOString();
  const accountPassword = crypto.randomBytes(6).toString('base64url');
  let user = db.users.find((item) => item.email === normalized);
  if (!user) {
    user = {
      id: crypto.randomUUID(),
      email: normalized,
      passwordHash: '',
      role: 'user',
      status: 'active',
      quotaUsed: 0,
      devices: [],
      createdAt: now,
      lastLoginAt: null
    };
    db.users.push(user);
  }
  user.passwordHash = await bcrypt.hash(accountPassword, 12);
  user.planName = planName || user.planName || 'Goi thang';
  user.monthlyPrice = Number(monthlyPrice || user.monthlyPrice || 0);
  user.paymentStatus = paymentStatus || user.paymentStatus || 'paid';
  user.quotaTotal = Number(quotaTotal || user.quotaTotal || 0);
  user.expiresAt = expiresAt || user.expiresAt || null;
  user.deviceLimit = Number(deviceLimit || user.deviceLimit || 1);
  user.status = 'active';
  user.updatedAt = now;
  await writeDb(db);
  return { ...publicUser(user), accountPassword };
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

  ['role', 'status', 'planName', 'monthlyPrice', 'paymentStatus', 'quotaTotal', 'quotaUsed', 'expiresAt', 'deviceLimit'].forEach((key) => {
    if (Object.hasOwn(changes, key)) {
      user[key] = ['monthlyPrice', 'quotaTotal', 'quotaUsed', 'deviceLimit'].includes(key) ? Number(changes[key]) : changes[key];
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
  normalizeAdminUser(user);

  if (!user || user.status !== 'active') {
    throw new Error('Tài khoản đã bị khóa hoặc không tồn tại.');
  }

  if (!isUnrestrictedAdmin(user) && user.expiresAt && new Date(user.expiresAt).getTime() < Date.now()) {
    throw new Error('Tài khoản đã hết hạn.');
  }

  if (!isUnrestrictedAdmin(user) && (Number(user.quotaUsed || 0) + Number(quotaCost || 1)) > Number(user.quotaTotal || 0)) {
    throw new Error('Tài khoản đã hết quota tạo ảnh.');
  }

  if (!isUnrestrictedAdmin(user) && deviceId) {
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

  normalizeAdminUser(user);
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
  db.users.forEach(normalizeAdminUser);
  await writeDb(db);
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

const prepareUserForImage = async ({ userId, deviceId, quotaCost = 1 }) => {
  const db = await readDb();
  const user = db.users.find((item) => item.id === userId);
  validateUserForUse(user, deviceId, quotaCost);
  await writeDb(db);
  return publicUser(user);
};

const setAdminTwoFactor = async (id, { secret, enabled }) => {
  const db = await readDb();
  const user = db.users.find((item) => item.id === id);
  if (!user) {
    throw new Error('Khong tim thay tai khoan admin.');
  }
  user.twoFactorSecret = secret || user.twoFactorSecret || '';
  user.twoFactorEnabled = Boolean(enabled);
  user.updatedAt = new Date().toISOString();
  await writeDb(db);
  return publicUser(user);
};

const normalizeUpdatePolicy = (policy = {}) => ({
  enabled: Boolean(policy.enabled),
  channel: ['user', 'admin', 'all'].includes(String(policy.channel || '').toLowerCase())
    ? String(policy.channel || '').toLowerCase()
    : 'user',
  latestVersion: String(policy.latestVersion || '').trim(),
  minimumVersion: String(policy.minimumVersion || '').trim(),
  forceUpdate: Boolean(policy.forceUpdate),
  installerUrl: String(policy.installerUrl || '').trim(),
  sha512: String(policy.sha512 || '').trim(),
  releaseNotes: String(policy.releaseNotes || '').slice(0, 2000),
  rolloutPercent: Math.min(100, Math.max(0, Number(policy.rolloutPercent ?? 100) || 0)),
  updatedAt: policy.updatedAt || null
});

const getUpdatePolicy = async () => {
  const db = await readDb();
  return normalizeUpdatePolicy(db.updatePolicy || defaultDb.updatePolicy);
};

const updateUpdatePolicy = async (changes = {}) => {
  const db = await readDb();
  db.updatePolicy = normalizeUpdatePolicy({
    ...(db.updatePolicy || defaultDb.updatePolicy),
    ...changes,
    updatedAt: new Date().toISOString()
  });
  await writeDb(db);
  return db.updatePolicy;
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
  attachOrderAccount,
  getUpdatePolicy,
  updateUpdatePolicy
};
