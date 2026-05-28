const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const crypto = require('node:crypto');
const fsSync = require('node:fs');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const packageInfo = require('../package.json');

require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });

if (!process.env.DATA_DIR) {
  const dataDir = path.join(app.getPath('userData'), 'data');
  const targetDb = path.join(dataDir, 'db.json');
  const legacyDb = path.join(__dirname, '..', 'server', 'data', 'db.json');

  process.env.DATA_DIR = dataDir;

  if (!fsSync.existsSync(targetDb) && fsSync.existsSync(legacyDb)) {
    fsSync.mkdirSync(dataDir, { recursive: true });
    fsSync.copyFileSync(legacyDb, targetDb);
  }
}

const adminStore = require('../server/store');

const isSmokeTest = process.argv.includes('--smoke-test');
const parseBaseUrlList = (...values) => {
  const urls = values
    .flatMap((value) => String(value || '').split(','))
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return [...new Set(urls)];
};
const cloudApiBaseUrls = parseBaseUrlList(
  process.env.NINE_ROUTER_API_BASE_URLS,
  process.env.NINE_ROUTER_API_BASE_URL,
  process.env.APP_SERVER_BASE_URL,
  'https://api.ducpt.com'
);
const appServerBaseUrl = cloudApiBaseUrls[0];
const localAppServerBaseUrl = String(process.env.LOCAL_APP_SERVER_BASE_URL || 'http://localhost:3030').replace(/\/$/, '');
const userApiBasePath = '/api/9router/user';
const legacyUserApiBasePath = '/api';
const localRouterBaseUrl = process.env.LOCAL_ROUTER_BASE_URL || 'http://localhost:20128';
const localRouterImageEndpoint = String(
  process.env.LOCAL_ROUTER_IMAGE_ENDPOINT
  || `${localRouterBaseUrl.replace(/\/$/, '')}/v1/images/generations`
).replace(/\/$/, '');
const localRouterApiKey = process.env.LOCAL_ROUTER_API_KEY || process.env.ROUTER_API_KEY || '';
const localRouterDataDir = process.env.LOCAL_ROUTER_DATA_DIR || (
  process.platform === 'win32'
    ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), '9router')
    : path.join(os.homedir(), '.9router')
);
const adminAlertEmail = process.env.ADMIN_ALERT_EMAIL || 'hoangvant77internet@gmail.com';
const securityAlertWebhookUrl = process.env.SECURITY_ALERT_WEBHOOK_URL || process.env.SHEETS_WEBHOOK_URL || '';
const adminMemberSource = String(process.env.ADMIN_MEMBER_SOURCE || '').toLowerCase();
const adminCloudMode = adminMemberSource === 'cloud' || process.env.ADMIN_CLOUD_MODE === '1';
const adminCloudEmail = process.env.ADMIN_CLOUD_EMAIL || process.env.ADMIN_EMAIL || '';
const adminCloudPassword = process.env.ADMIN_CLOUD_PASSWORD || process.env.ADMIN_PASSWORD || '';
const windowConfig = {
  width: 1400,
  height: 900,
  minWidth: 640,
  minHeight: 560,
  title: 'DG Image Tools',
  backgroundColor: '#f6f7fb',
  icon: path.join(__dirname, 'assets', 'icon.png')
};

const webPreferencesConfig = {
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,
  nodeIntegration: false
};
const activeRequests = new Map();
const localAuthSessions = new Map();
let sessionsLoaded = false;
let mainWindowRef = null;
let cloudAdminToken = '';
let cloudAdminBaseUrl = '';
let updateStatus = {
  state: 'idle',
  message: 'Chua kiem tra cap nhat.',
  version: null,
  downloaded: false
};

const getAppFlavor = () => {
  const envFlavor = String(process.env.APP_FLAVOR || '').toLowerCase();
  if (envFlavor === 'user' || envFlavor === 'admin') {
    return envFlavor;
  }

  const explicitFlavor = String(packageInfo.flavor || '').toLowerCase();
  if (explicitFlavor === 'user' || explicitFlavor === 'admin') {
    return explicitFlavor;
  }

  const appId = String(packageInfo.build?.appId || '').toLowerCase();
  if (appId.endsWith('.user') || appId.includes('image-tool.user')) {
    return 'user';
  }

  return app.getName().toLowerCase().includes('user') ? 'user' : 'admin';
};

const requireAdminBuild = () => {
  if (getAppFlavor() !== 'admin') {
    throw new Error('Chuc nang quan ly thanh vien chi co trong ban Admin.');
  }
};

const isUserBuild = () => getAppFlavor() === 'user';

const getLocalSessionFile = () => path.join(app.getPath('userData'), 'data', 'local-sessions.json');

const loadLocalSessions = async () => {
  if (sessionsLoaded) {
    return;
  }

  sessionsLoaded = true;
  try {
    const raw = await fs.readFile(getLocalSessionFile(), 'utf8');
    const sessions = JSON.parse(raw);
    Object.entries(sessions || {}).forEach(([token, session]) => {
      if (session?.userId) {
        localAuthSessions.set(token, session);
      }
    });
  } catch {
    // No saved local sessions yet.
  }
};

const saveLocalSessions = async () => {
  const sessionFile = getLocalSessionFile();
  await fs.mkdir(path.dirname(sessionFile), { recursive: true });
  await fs.writeFile(sessionFile, JSON.stringify(Object.fromEntries(localAuthSessions), null, 2), 'utf8');
};

const recordSecurityEvent = async (payload) => {
  try {
    const event = await adminStore.recordSecurityEvent({
      ...payload,
      appFlavor: getAppFlavor(),
      appVersion: app.getVersion()
    });

    notifySecurityAlert(event).catch(() => {});
  } catch {
    // Security telemetry must never break the user workflow.
  }
};

const notifySecurityAlert = async (event) => {
  if (!securityAlertWebhookUrl) {
    return;
  }

  await fetch(securityAlertWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'security_alert',
      alertEmail: adminAlertEmail,
      subject: `[DG Image Tools] Canh bao bao mat: ${event.reason}`,
      ...event
    })
  });
};

const requireAdminBuildForIpc = async (channel, detail = {}) => {
  if (!isUserBuild()) {
    return;
  }

  await recordSecurityEvent({
    reason: 'blocked_admin_ipc_from_user_build',
    channel,
    severity: 'high',
    detail
  });
  throw new Error('Ban user khong co quyen quan tri.');
};

const setUpdateStatus = (status) => {
  updateStatus = { ...updateStatus, ...status };
  mainWindowRef?.webContents.send('update:status', updateStatus);
};

const checkForUpdates = async ({ manual = false } = {}) => {
  if (!app.isPackaged) {
    setUpdateStatus({
      state: 'disabled',
      message: 'Cap nhat tu dong chi chay trong ban da dong goi.'
    });
    return updateStatus;
  }

  try {
    setUpdateStatus({
      state: 'checking',
      message: manual ? 'Dang kiem tra ban cap nhat...' : 'Tu dong kiem tra ban cap nhat...'
    });
    await autoUpdater.checkForUpdates();
    return updateStatus;
  } catch (error) {
    setUpdateStatus({
      state: 'error',
      message: error.message || 'Khong kiem tra duoc ban cap nhat.'
    });
    return updateStatus;
  }
};

const setupAutoUpdater = () => {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    setUpdateStatus({ state: 'checking', message: 'Dang kiem tra ban cap nhat...' });
  });

  autoUpdater.on('update-available', (info) => {
    setUpdateStatus({
      state: 'available',
      message: `Co ban cap nhat ${info.version}, dang tai ve...`,
      version: info.version
    });
  });

  autoUpdater.on('update-not-available', () => {
    setUpdateStatus({ state: 'current', message: 'Dang dung ban moi nhat.' });
  });

  autoUpdater.on('download-progress', (progress) => {
    setUpdateStatus({
      state: 'downloading',
      message: `Dang tai ban cap nhat ${Math.round(progress.percent || 0)}%`
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    setUpdateStatus({
      state: 'downloaded',
      message: `Da tai xong ban ${info.version}. App se khoi dong lai de cap nhat.`,
      version: info.version,
      downloaded: true
    });

    setTimeout(() => {
      autoUpdater.quitAndInstall(false, true);
    }, 1500);
  });

  autoUpdater.on('error', (error) => {
    setUpdateStatus({
      state: 'error',
      message: error.message || 'Cap nhat tu dong bi loi.'
    });
  });
};

const readJsonResponse = async (response) => {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    const message = simplifyHttpErrorBody(text);
    return {
      message: message || `HTTP ${response.status}`,
      raw: text
    };
  }
};

const simplifyHttpErrorBody = (text) => String(text || '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const sanitizeUserFacingError = (message, fallback = 'Khong thuc hien duoc yeu cau. Vui long thu lai hoac lien he admin.') => {
  const clean = String(message || '')
    .replace(/https?:\/\/[^\s)"']+/gi, '[server]')
    .replace(/\b(?:localhost|127\.0\.0\.1):\d+\b/gi, '[server]')
    .replace(/\/api\/[^\s)"']+/gi, '[service]')
    .replace(/\b(?:backend|endpoint|proxy|route|render|onrender|api key|apikey)\b/gi, 'dich vu')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean || clean === '[server]' || clean === '[service]') {
    return fallback;
  }

  return clean.slice(0, 240);
};

const makeServiceUnavailableError = (lastError, fallback = 'May chu dich vu chua san sang. Vui long thu lai sau hoac lien he admin.') => {
  if (!lastError) {
    return new Error(fallback);
  }

  if (lastError.status === 401 || lastError.status === 403) {
    return new Error(sanitizeUserFacingError(lastError.message, 'Tai khoan khong co quyen hoac phien dang nhap da het han.'));
  }

  if (lastError.status === 400 || lastError.status === 409 || lastError.status === 429) {
    return new Error(sanitizeUserFacingError(lastError.message, fallback));
  }

  return new Error(fallback);
};

const fetchUserApi = async (pathSuffix, options = {}) => {
  const candidates = [
    ...cloudApiBaseUrls.flatMap((baseUrl) => [
      `${baseUrl}${userApiBasePath}${pathSuffix}`,
      `${baseUrl}${legacyUserApiBasePath}${pathSuffix}`
    ]),
    `${localAppServerBaseUrl}${userApiBasePath}${pathSuffix}`,
    `${localAppServerBaseUrl}${legacyUserApiBasePath}${pathSuffix}`
  ];
  let lastError = null;

  for (const url of candidates) {
    try {
      const response = await fetch(url, options);
      const body = await readJsonResponse(response);

      if (response.ok) {
        return { response, body, url };
      }

      lastError = {
        status: response.status,
        url,
        message: body.message || `HTTP ${response.status}`
      };

      if (![404, 405].includes(response.status)) {
        break;
      }
    } catch (error) {
      lastError = {
        status: 0,
        url,
        message: error.message || 'Khong ket noi duoc dich vu.'
      };
    }
  }

  const detail = lastError
    ? makeServiceUnavailableError(lastError, 'Khong dang nhap duoc. Vui long thu lai hoac lien he admin.')
    : new Error('Khong dang nhap duoc. Vui long thu lai hoac lien he admin.');
  throw detail;
};

const fetchCloudUserApi = async (pathSuffix, options = {}) => {
  const candidates = cloudApiBaseUrls.flatMap((baseUrl) => [
    { baseUrl, url: `${baseUrl}${userApiBasePath}${pathSuffix}` },
    { baseUrl, url: `${baseUrl}${legacyUserApiBasePath}${pathSuffix}` }
  ]);
  let lastError = null;

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate.url, options);
      const body = await readJsonResponse(response);

      if (response.ok) {
        return { response, body, url: candidate.url, baseUrl: candidate.baseUrl };
      }

      lastError = {
        status: response.status,
        url: candidate.url,
        message: body.message || body.error || `HTTP ${response.status}`
      };

      if (![404, 405].includes(response.status)) {
        break;
      }
    } catch (error) {
      lastError = {
        status: 0,
        url: candidate.url,
        message: error.message || 'Khong ket noi duoc dich vu.'
      };
    }
  }

  const detail = lastError
    ? makeServiceUnavailableError(lastError, 'May chu dich vu chua san sang. Vui long thu lai sau hoac lien he admin.')
    : new Error('May chu dich vu chua san sang. Vui long thu lai sau hoac lien he admin.');
  throw detail;
};

const fetchCloudImageGeneration = async ({ payload, authToken, deviceId, signal }) => {
  const candidates = cloudApiBaseUrls.flatMap((baseUrl) => [
    `${baseUrl}${userApiBasePath}/images/generations`,
    `${baseUrl}${legacyUserApiBasePath}/images/generations`
  ]);
  let lastError = null;

  for (const url of candidates) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          Authorization: `Bearer ${authToken}`,
          ...(deviceId ? { 'X-Device-Id': deviceId } : {})
        },
        body: JSON.stringify(payload),
        signal
      });
      const rawText = await response.text();

      if (response.ok) {
        return { response, rawText, url };
      }

      const detail = simplifyHttpErrorBody(rawText);
      lastError = {
        status: response.status,
        url,
        message: detail || `HTTP ${response.status}`
      };

      if (![404, 405].includes(response.status)) {
        break;
      }
    } catch (error) {
      lastError = {
        status: 0,
        url,
        message: error.message || 'Khong ket noi duoc dich vu.'
      };
    }
  }

  const detail = lastError
    ? makeServiceUnavailableError(lastError, 'Khong tao duoc anh. May chu dich vu dang ban hoac chua san sang.')
    : new Error('Khong tao duoc anh. May chu dich vu dang ban hoac chua san sang.');
  throw detail;
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

const quotaTotalKeys = new Set([
  'quotatotal',
  'totalquota',
  'monthlyquota',
  'monthlylimit',
  'freemonthlyquota',
  'limit',
  'total'
]);
const quotaUsedKeys = new Set(['quotaused', 'used', 'monthlyused']);
const quotaRemainingKeys = new Set(['quotaremaining', 'remaining', 'balance']);

const normalizeQuotaKey = (key) => String(key || '').replace(/[_\-\s]/g, '').toLowerCase();

const extractDirectQuota = (item) => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return null;
  }

  let total = null;
  let used = null;
  let remaining = null;

  Object.entries(item).forEach(([key, value]) => {
    if (!Number.isFinite(Number(value))) {
      return;
    }

    const normalized = normalizeQuotaKey(key);
    if (quotaTotalKeys.has(normalized)) {
      total ??= Number(value);
    } else if (quotaUsedKeys.has(normalized)) {
      used ??= Number(value);
    } else if (quotaRemainingKeys.has(normalized)) {
      remaining ??= Number(value);
    }
  });

  if (item.quota && typeof item.quota === 'object') {
    const nested = extractDirectQuota(item.quota);
    total ??= nested?.quotaTotal ?? null;
    used ??= nested?.quotaUsed ?? null;
    remaining ??= nested?.quotaRemaining ?? null;
  }

  if (total === null && used === null && remaining === null) {
    return null;
  }

  total ??= remaining !== null && used !== null ? remaining + used : null;
  used ??= total !== null && remaining !== null ? Math.max(0, total - remaining) : null;
  remaining ??= total !== null && used !== null ? Math.max(0, total - used) : null;

  return {
    quotaTotal: total,
    quotaUsed: used,
    quotaRemaining: remaining
  };
};

const collectQuotaEntries = (value, entries = [], seen = new WeakSet()) => {
  if (!value || typeof value !== 'object') {
    return entries;
  }

  if (seen.has(value)) {
    return entries;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item) => collectQuotaEntries(item, entries, seen));
    return entries;
  }

  const direct = extractDirectQuota(value);
  if (direct && (direct.quotaTotal !== null || direct.quotaRemaining !== null)) {
    entries.push(direct);
    return entries;
  }

  Object.values(value).forEach((child) => collectQuotaEntries(child, entries, seen));
  return entries;
};

const sumQuotaEntries = (entries) => {
  if (!entries.length) {
    return null;
  }

  const sumField = (field) => {
    const values = entries.map((entry) => entry[field]).filter((value) => Number.isFinite(Number(value)));
    return values.length ? values.reduce((total, value) => total + Number(value), 0) : null;
  };

  return {
    quotaTotal: sumField('quotaTotal'),
    quotaUsed: sumField('quotaUsed'),
    quotaRemaining: sumField('quotaRemaining')
  };
};

const loadBetterSqlite = () => {
  const candidates = [
    'better-sqlite3',
    path.join(localRouterDataDir, 'runtime', 'node_modules', 'better-sqlite3')
  ];

  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      // Try the next location.
    }
  }

  return null;
};

const parseJsonSafe = (value) => {
  try {
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
};

const readRouterQuotaFromSqlite = () => {
  const BetterSqlite = loadBetterSqlite();
  const dbFile = path.join(localRouterDataDir, 'db', 'data.sqlite');

  if (!BetterSqlite || !fsSync.existsSync(dbFile)) {
    return null;
  }

  const db = new BetterSqlite(dbFile, {
    readonly: true,
    fileMustExist: true
  });

  try {
    const connections = db.prepare(`
      SELECT id, provider, name, email, isActive, data
      FROM providerConnections
      WHERE isActive = 1
    `).all();
    const quotaEntries = [];
    const accounts = connections.map((connection) => {
      const data = parseJsonSafe(connection.data);
      const quota = extractDirectQuota({
        ...data,
        providerSpecificData: data.providerSpecificData
      }) || extractDirectQuota(data.providerSpecificData || {});

      if (quota?.quotaTotal !== null || quota?.quotaRemaining !== null) {
        quotaEntries.push(quota);
      }

      return {
        id: connection.id,
        provider: connection.provider,
        name: connection.name || connection.email || connection.id,
        isActive: Boolean(connection.isActive),
        quota
      };
    });
    const summed = sumQuotaEntries(quotaEntries);

    return {
      source: 'local-9router-sqlite',
      quotaTotal: summed?.quotaTotal ?? accounts.length,
      quotaUsed: summed?.quotaUsed ?? null,
      quotaRemaining: summed?.quotaRemaining ?? null,
      accountsTotal: accounts.length,
      quotaUnit: summed?.quotaTotal ? 'quota' : 'accounts',
      dbFile,
      accounts
    };
  } finally {
    db.close();
  }
};

const parseRouterQuota = (data) => {
  const summed = sumQuotaEntries(collectQuotaEntries(data));
  if (summed?.quotaTotal !== null || summed?.quotaRemaining !== null) {
    const quotaTotal = summed.quotaTotal ?? (
      summed.quotaRemaining !== null && summed.quotaUsed !== null
        ? summed.quotaRemaining + summed.quotaUsed
        : null
    );
    const quotaUsed = summed.quotaUsed ?? (
      quotaTotal !== null && summed.quotaRemaining !== null
        ? Math.max(0, quotaTotal - summed.quotaRemaining)
        : null
    );

    return {
      source: 'local-9router',
      quotaTotal,
      quotaUsed,
      quotaRemaining: summed.quotaRemaining ?? (
        quotaTotal !== null && quotaUsed !== null ? Math.max(0, quotaTotal - quotaUsed) : null
      ),
      raw: data
    };
  }

  const quotaTotal = readQuotaNumber(data, [
    'quotaTotal',
    'quota.total',
    'quota.limit',
    'limit',
    'total',
    'monthlyLimit',
    'monthlyQuota',
    'freeMonthlyQuota'
  ]);
  const quotaUsed = readQuotaNumber(data, [
    'quotaUsed',
    'quota.used',
    'used',
    'monthlyUsed',
    'usage.used'
  ]);
  const quotaRemaining = readQuotaNumber(data, [
    'quotaRemaining',
    'quota.remaining',
    'remaining',
    'balance',
    'usage.remaining'
  ]);
  const resolvedTotal = quotaTotal ?? (quotaRemaining !== null && quotaUsed !== null ? quotaRemaining + quotaUsed : null);
  const resolvedUsed = quotaUsed ?? (resolvedTotal !== null && quotaRemaining !== null ? Math.max(0, resolvedTotal - quotaRemaining) : null);

  return {
    source: 'local-9router',
    quotaTotal: resolvedTotal,
    quotaUsed: resolvedUsed,
    quotaRemaining: quotaRemaining ?? (resolvedTotal !== null && resolvedUsed !== null ? Math.max(0, resolvedTotal - resolvedUsed) : null),
    raw: data
  };
};

const normalizeImageEndpoint = (value) => {
  if (isUserBuild()) {
    return `${appServerBaseUrl}${userApiBasePath}/images/generations`;
  }

  const endpointValue = String(value || '').trim() || `${localRouterBaseUrl}/v1`;

  if (endpointValue.startsWith(appServerBaseUrl) || endpointValue.includes('/api/9router/user/images/generations')) {
    return `${localRouterBaseUrl}/v1/images/generations`;
  }

  if (endpointValue.startsWith(localRouterBaseUrl) && !/\/v1\/images\/generations\/?$/.test(endpointValue)) {
    return `${localRouterBaseUrl}/v1/images/generations`;
  }

  if (/\/v1\/?$/.test(endpointValue)) {
    return `${endpointValue.replace(/\/$/, '')}/images/generations`;
  }

  return endpointValue;
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

  if (width % 16 === 0 && height % 16 === 0) {
    return `${width}x${height}`;
  }

  const safeCommonSizes = {
    '1920x1080': '1536x864',
    '1080x1920': '864x1536',
    '720x1280': '720x1280'
  };
  const mapped = safeCommonSizes[`${width}x${height}`];
  if (mapped) {
    return mapped;
  }

  const safeWidth = Math.max(16, width - (width % 16));
  const safeHeight = Math.max(16, height - (height % 16));
  return `${safeWidth}x${safeHeight}`;
};

const isDemoLogin = ({ email, password }) => {
  return !app.isPackaged
    && String(email || '').trim().toLowerCase() === 'demo@9router.local'
    && password === 'Demo@123456';
};

const parseImageResponse = (rawText, outputFormat) => {
  const candidates = [];
  const trimmed = rawText.trim();

  if (trimmed) {
    candidates.push(trimmed);
  }

  rawText.split(/\r?\n/).forEach((line) => {
    const cleanLine = line.trim();
    if (cleanLine.startsWith('data:')) {
      const data = cleanLine.slice(5).trim();
      if (data && data !== '[DONE]') {
        candidates.push(data);
      }
    }
  });

  for (const candidate of candidates.reverse()) {
    try {
      const parsed = JSON.parse(candidate);
      const item = Array.isArray(parsed.data) ? parsed.data[0] : parsed;
      const base64 = item?.b64_json || item?.base64 || item?.image_base64 || item?.image;
      const url = item?.url || parsed.url;

      if (base64) {
        const cleanBase64 = base64.includes(',') ? base64.split(',').pop() : base64;
        return {
          base64: cleanBase64,
          imageUrl: `data:image/${outputFormat};base64,${cleanBase64}`,
          raw: parsed
        };
      }

      if (url) {
        return {
          imageUrl: url,
          raw: parsed
        };
      }
    } catch {
      // Keep scanning possible SSE chunks.
    }
  }

  const responseExcerpt = rawText
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
  throw new Error(`Không tìm thấy ảnh trong phản hồi API.${responseExcerpt ? ` Phản hồi: ${responseExcerpt}` : ''}`);
};

const sanitizePathPart = (value, fallback) => {
  return String(value || '')
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90) || fallback;
};

const createSafeName = (prompt, index, outputFormat, isBatch = false) => {
  const safePrompt = sanitizePathPart(prompt, 'anh');

  if (isBatch) {
    return `${String(index + 1).padStart(2, '0')} - ${safePrompt}.${outputFormat}`;
  }

  return `${safePrompt}.${outputFormat}`;
};

const getDefaultOutputDir = () => path.join(app.getPath('documents'), '9router-images');

const createArticleDir = (outputDir, articleTitle) => {
  const baseDir = outputDir || getDefaultOutputDir();

  if (!articleTitle) {
    return baseDir;
  }

  const datePart = new Date().toISOString().slice(0, 10);
  const safeTitle = sanitizePathPart(articleTitle, 'bai-viet');
  return path.join(baseDir, `${datePart} - ${safeTitle}`);
};

const resolveUniqueFilePath = async (targetDir, filename) => {
  const extension = path.extname(filename);
  const basename = path.basename(filename, extension);
  let filepath = path.join(targetDir, filename);
  let counter = 2;

  while (true) {
    try {
      await fs.access(filepath);
      filepath = path.join(targetDir, `${basename}-${counter}${extension}`);
      counter += 1;
    } catch {
      return filepath;
    }
  }
};

const saveImageFile = async ({ prompt, index = 0, outputFormat, base64, imageUrl, outputDir, signal, isBatch, articleTitle }) => {
  const targetDir = createArticleDir(outputDir, articleTitle);
  await fs.mkdir(targetDir, { recursive: true });

  const filename = createSafeName(prompt, index, outputFormat, isBatch);
  const filepath = await resolveUniqueFilePath(targetDir, filename);

  if (base64) {
    await fs.writeFile(filepath, Buffer.from(base64, 'base64'));
    return filepath;
  }

  if (imageUrl?.startsWith('http')) {
    const response = await fetch(imageUrl, { signal });
    if (!response.ok) {
      throw new Error(`Không tải được ảnh từ URL: HTTP ${response.status}`);
    }

    await fs.writeFile(filepath, Buffer.from(await response.arrayBuffer()));
    return filepath;
  }

  return null;
};

const saveImageDataUrl = async ({ dataUrl, prompt, index = 0, outputFormat = 'png', outputDir, isBatch, articleTitle }) => {
  const match = String(dataUrl || '').match(/^data:image\/([a-z0-9+.-]+);base64,(.+)$/i);
  if (!match) {
    throw new Error('Du lieu anh logo/final khong hop le.');
  }

  const resolvedFormat = outputFormat || match[1] || 'png';
  return saveImageFile({
    prompt,
    index,
    outputFormat: resolvedFormat,
    base64: match[2],
    outputDir,
    isBatch,
    articleTitle
  });
};

const writeBatchManifest = async ({ outputDir, articleTitle, manifest }) => {
  const targetDir = createArticleDir(outputDir, articleTitle);
  await fs.mkdir(targetDir, { recursive: true });

  const filepath = path.join(targetDir, 'manifest.json');
  await fs.writeFile(filepath, JSON.stringify(manifest, null, 2), 'utf8');
  return filepath;
};

const loginLocalUser = async ({ email, password, deviceId }) => {
  await loadLocalSessions();
  const user = await adminStore.authenticateUser({ email, password, deviceId });
  const token = `local-user-${crypto.randomUUID()}`;
  localAuthSessions.set(token, {
    userId: user.id,
    createdAt: Date.now()
  });
  await saveLocalSessions();
  return { token, user, authSource: 'local-9router' };
};

const loginUser = async ({ email, password, deviceId }) => {
  if (isDemoLogin({ email, password })) {
    return {
      token: 'demo-ui-token',
      user: {
        id: 'demo-user',
        email: 'demo@9router.local',
        role: 'user',
        status: 'active',
        quotaTotal: 50,
        quotaUsed: 0,
        expiresAt: null,
        deviceLimit: 1,
        devices: []
      }
    };
  }

  try {
    const loginResult = await fetchUserApi('/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ email, password, deviceId })
    });
    const loginBody = loginResult.body;
    const loginToken = loginBody.token || loginBody.accessToken || loginBody.access_token;
    if (!loginToken) {
      throw new Error('Server dang nhap khong tra token.');
    }

    return {
      token: loginToken,
      user: loginBody.user || { email },
      authSource: 'cloud'
    };
  } catch (cloudError) {
    try {
      return await loginLocalUser({ email, password, deviceId });
    } catch (localError) {
      await recordSecurityEvent({
        email,
        deviceId,
        reason: 'login_failed_cloud_and_local',
        severity: 'medium',
        detail: {
          cloudError: String(cloudError.message || cloudError).slice(0, 300),
          localError: String(localError.message || localError).slice(0, 300)
        }
      });
      throw new Error(localError.message || 'Dang nhap that bai.');
    }
  }

  const response = await fetch(`${appServerBaseUrl}${userApiBasePath}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({ email, password, deviceId })
  });
  const body = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(body.message || 'Đăng nhập thất bại.');
  }

  const token = body.token || body.accessToken || body.access_token;
  if (!token) {
    throw new Error('Server đăng nhập không trả token.');
  }

  return {
    token,
    user: body.user || { email }
  };
};

const getCurrentUser = async (token) => {
  if (!token) {
    return null;
  }

  if (!app.isPackaged && token === 'demo-ui-token') {
    return {
      id: 'demo-user',
      email: 'demo@9router.local',
      role: 'user',
      status: 'active',
      quotaTotal: 50,
      quotaUsed: 0,
      expiresAt: null,
      deviceLimit: 1,
      devices: []
    };
  }

  await loadLocalSessions();
  const localSession = localAuthSessions.get(token);
  if (localSession) {
    const user = await adminStore.getUserById(localSession.userId);
    return user ? adminStore.publicUser(user) : null;
  }

  try {
    const meResult = await fetchUserApi('/auth/me', {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`
      }
    });
    return meResult.body.user || meResult.body;
  } catch (error) {
    throw new Error(error.message || 'Phien dang nhap khong con hop le.');
  }

  const response = await fetch(`${appServerBaseUrl}${userApiBasePath}/auth/me`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    }
  });
  const body = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(body.message || 'Phiên đăng nhập không còn hợp lệ.');
  }

  return body.user || body;
};

const getRouterQuota = async () => {
  const sqliteQuota = readRouterQuotaFromSqlite();
  if (sqliteQuota?.quotaTotal !== null) {
    return sqliteQuota;
  }

  if (!localRouterBaseUrl) {
    return null;
  }

  const response = await fetch(`${localRouterBaseUrl}/api/quota`, {
    headers: {
      Accept: 'application/json'
    }
  });
  const body = await readJsonResponse(response);

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('9router local dang yeu cau dang nhap nen app chua doc duoc quota. Hay dang nhap dashboard 9router hoac tat require login cho API quota.');
    }

    throw new Error(body.message || body.error || 'Khong lay duoc quota tong tu 9router local.');
  }

  return parseRouterQuota(body);
};

const requireCloudAdminConfig = () => {
  if (!adminCloudEmail || !adminCloudPassword) {
    throw new Error('Admin cloud chua cau hinh ADMIN_CLOUD_EMAIL/ADMIN_CLOUD_PASSWORD.');
  }
};

const loginCloudAdmin = async ({ force = false } = {}) => {
  requireCloudAdminConfig();
  if (cloudAdminToken && !force) {
    return cloudAdminToken;
  }

  const loginResult = await fetchCloudUserApi('/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      email: adminCloudEmail,
      password: adminCloudPassword,
      deviceId: `admin-${crypto.createHash('sha256').update(os.hostname()).digest('hex').slice(0, 16)}`
    })
  });
  const user = loginResult.body.user || {};
  const token = loginResult.body.token || loginResult.body.accessToken || loginResult.body.access_token;

  if (!token) {
    throw new Error('Cloud admin login khong tra token.');
  }
  if (user.role !== 'admin') {
    throw new Error('Tai khoan cloud admin khong co quyen admin.');
  }

  cloudAdminToken = token;
  cloudAdminBaseUrl = loginResult.baseUrl;
  return cloudAdminToken;
};

const fetchCloudAdmin = async (pathSuffix, options = {}) => {
  let token = await loginCloudAdmin();
  const request = async (bearerToken) => fetch(`${cloudAdminBaseUrl || appServerBaseUrl}/api/9router/admin${pathSuffix}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
      Authorization: `Bearer ${bearerToken}`
    }
  });

  let response = await request(token);
  if (response.status === 401) {
    token = await loginCloudAdmin({ force: true });
    response = await request(token);
  }

  const body = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error(body.message || body.error || `Cloud admin HTTP ${response.status}`);
  }

  return body;
};

const getCloudAdminDashboard = async () => {
  const [stats, usersBody, eventsBody] = await Promise.all([
    fetchCloudAdmin('/stats'),
    fetchCloudAdmin('/users'),
    fetchCloudAdmin('/events')
  ]);

  return {
    stats,
    users: usersBody.users || [],
    events: eventsBody.events || [],
    storage: {
      mode: 'cloud',
      apiBaseUrl: cloudAdminBaseUrl || appServerBaseUrl
    }
  };
};

const getAdminDashboard = async () => {
  if (adminCloudMode) {
    return getCloudAdminDashboard();
  }

  await adminStore.ensureAdminUser();
  const [stats, users, events] = await Promise.all([
    adminStore.getStats(),
    adminStore.listUsers(),
    adminStore.listEvents(100)
  ]);

  return { stats, users, events, storage: adminStore.getStorageInfo() };
};

const createMemberUser = async (member) => {
  if (adminCloudMode) {
    await fetchCloudAdmin('/users', {
      method: 'POST',
      body: JSON.stringify({
        ...member,
        role: member.role || 'user'
      })
    });
    return { dashboard: await getCloudAdminDashboard() };
  }

  const user = await adminStore.createUser({
    ...member,
    role: member.role || 'user'
  });
  return { user, dashboard: await getAdminDashboard() };
};

const updateMemberUser = async ({ id, changes }) => {
  if (adminCloudMode) {
    await fetchCloudAdmin(`/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(changes || {})
    });
    return { dashboard: await getCloudAdminDashboard() };
  }

  const user = await adminStore.updateUser(id, changes);
  return { user, dashboard: await getAdminDashboard() };
};

const generateImage = async (config) => {
  const requestId = config.requestId || crypto.randomUUID();
  const controller = new AbortController();
  activeRequests.set(requestId, controller);
  let localUser = null;

  const {
    endpoint,
    apiKey,
    authToken,
    deviceId,
    model,
    prompt,
    fileTitle,
    refImageUrl,
    size,
    quality,
    background,
    imageDetail,
    outputFormat,
    outputDir,
    articleTitle
  } = config;

  const payload = {
    model,
    prompt,
    n: 1,
    size: normalizeImageSize(size),
    quality,
    background,
    image_detail: imageDetail,
      output_format: outputFormat
    };

    if (deviceId) {
      payload.deviceId = deviceId;
    }

  if (refImageUrl) {
    payload.image = refImageUrl;
  }

  try {
    if (isUserBuild()) {
      await loadLocalSessions();
    }

    const hasLocalUserSession = isUserBuild() && localAuthSessions.has(authToken);

    if (isUserBuild() && hasLocalUserSession) {
      const localSession = localAuthSessions.get(authToken);
      localUser = await adminStore.getUserById(localSession.userId);
      adminStore.validateUserForUse(localUser, deviceId);
    }

    if (isUserBuild() && !authToken) {
      await recordSecurityEvent({
        deviceId,
        reason: 'blocked_generation_without_auth_token',
        severity: 'high'
      });
      throw new Error('Vui long dang nhap bang tai khoan duoc quan tri vien cap.');
    }

    if (isUserBuild() && (endpoint || apiKey)) {
      await recordSecurityEvent({
        userId: localAuthSessions.get(authToken)?.userId || '',
        deviceId,
        reason: 'user_build_submitted_private_connection_fields',
        severity: 'medium',
        detail: {
          hasEndpoint: Boolean(endpoint),
          hasApiKey: Boolean(apiKey)
        }
      });
    }

    const targetEndpoint = isUserBuild()
      ? (hasLocalUserSession
        ? localRouterImageEndpoint
        : `${appServerBaseUrl}${userApiBasePath}/images/generations`)
      : normalizeImageEndpoint(endpoint);
    const isLocalRouterEndpoint = targetEndpoint.startsWith(localRouterBaseUrl);
    const bearerToken = isUserBuild()
      ? (hasLocalUserSession ? localRouterApiKey : authToken)
      : (isLocalRouterEndpoint ? apiKey : (authToken || apiKey));

    if ((targetEndpoint.startsWith(appServerBaseUrl) || targetEndpoint.startsWith(localAppServerBaseUrl)) && !authToken) {
      throw new Error('Vui lòng đăng nhập trước khi tạo ảnh.');
    }

    let response;
    let rawText;

    if (isUserBuild() && !hasLocalUserSession) {
      const cloudResult = await fetchCloudImageGeneration({
        payload,
        authToken,
        deviceId,
        signal: controller.signal
      });
      response = cloudResult.response;
      rawText = cloudResult.rawText;
    } else {
      response = await fetch(targetEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
          ...(deviceId ? { 'X-Device-Id': deviceId } : {})
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      rawText = await response.text();
    }

    if (!response.ok) {
      const detail = simplifyHttpErrorBody(rawText);
      if (response.status === 405) {
        if (isUserBuild()) {
          throw new Error('Khong tao duoc anh. May chu dich vu chua san sang.');
        }
        throw new Error(`HTTP 405: Dich vu tao anh chua cho phep lenh nay. Chi tiet: ${detail || '405 Not Allowed'}`);
      }

      if (isUserBuild()) {
        throw new Error(sanitizeUserFacingError(detail, `Yeu cau tao anh that bai voi HTTP ${response.status}`));
      }

      throw new Error(detail || `Yêu cầu thất bại với HTTP ${response.status}`);
    }

    const parsed = parseImageResponse(rawText, outputFormat);
    const savedPath = await saveImageFile({
      prompt: fileTitle || prompt,
      index: config.index ?? 0,
      outputFormat,
      base64: parsed.base64,
      imageUrl: parsed.imageUrl,
      outputDir,
      signal: controller.signal,
      isBatch: Boolean(config.isBatch),
      articleTitle
    });

    if (isUserBuild() && localUser) {
      await adminStore.recordImageEvent({
        userId: localUser.id,
        ok: true,
        prompt,
        savedPath,
        deviceId,
        quotaCost: 1
      });
    }

    return {
      ...parsed,
      requestId,
      savedPath
    };
  } catch (error) {
    if (isUserBuild() && localUser && error.name !== 'AbortError') {
      await adminStore.recordImageEvent({
        userId: localUser.id,
        ok: false,
        prompt,
        error: error.message || String(error),
        deviceId,
        quotaCost: 0
      }).catch(() => {});
    }

    if (error.name === 'AbortError') {
      throw new Error('Đã dừng tạo ảnh.');
    }

    throw error;
  } finally {
    activeRequests.delete(requestId);
  }
};

const selectOutputDir = async (browserWindow) => {
  const result = await dialog.showOpenDialog(browserWindow, {
    title: 'Chọn thư mục lưu ảnh',
    properties: ['openDirectory', 'createDirectory']
  });

  if (result.canceled) {
    return null;
  }

  return result.filePaths[0];
};

const getAppConfig = () => ({
  app: {
    name: packageInfo.name,
    flavor: getAppFlavor(),
    displayName: app.getName(),
    productTitle: windowConfig.title,
    version: app.getVersion(),
    description: packageInfo.description,
    mainEntry: packageInfo.main,
    license: packageInfo.license,
    runtimeMode: isSmokeTest ? 'Smoke Test' : 'Local',
    electronVersion: packageInfo.devDependencies.electron
  },
  admin: {
    memberSource: adminCloudMode ? 'cloud' : 'local',
    cloudBaseUrl: adminCloudMode ? appServerBaseUrl : '',
    cloudCandidates: adminCloudMode ? cloudApiBaseUrls : []
  },
  window: {
    ...windowConfig,
    showInSmokeTest: false,
    rendererEntry: 'src/renderer/index.html'
  },
  security: {
    ...webPreferencesConfig,
    preload: 'src/preload.js',
    sandboxExplicitlySet: false,
    cspConfigured: false,
    webSecurityExplicitlySet: false,
    externalNavigationGuard: false,
    windowOpenGuard: false
  },
  ipc: {
    exposedGlobal: 'window.toolApi',
    preloadApis: [
      {
        name: 'getVersion',
        channel: 'app:get-version',
        type: 'invoke',
        returns: 'app.getVersion()'
      },
      {
        name: 'getConfig',
        channel: 'app:get-config',
        type: 'invoke',
        returns: 'project config'
      }
    ],
    mainHandlers: [
      {
        channel: 'app:get-version',
        handler: 'ipcMain.handle',
        result: 'app.getVersion()'
      },
      {
        channel: 'app:get-config',
        handler: 'ipcMain.handle',
        result: 'getAppConfig()'
      }
    ]
  },
  runner: {
    scripts: packageInfo.scripts,
    runnerFile: 'scripts/run-electron.js',
    executable: 'require("electron")',
    args: ['.', '...process.argv.slice(2)'],
    envOverrides: {
      ELECTRON_RUN_AS_NODE: 'deleted before spawn'
    },
    stdio: 'inherit',
    smokeFlag: '--smoke-test',
    smokeBehavior: 'load renderer then app.quit()'
  },
  ui: {
    language: 'vi',
    theme: 'light',
    layout: {
      shell: 'sidebar + workspace grid',
      sidebarWidth: 248,
      bodyMinWidth: 920,
      bodyMinHeight: 620
    },
    navigation: ['Dashboard', 'Tasks', 'Settings'],
    activeView: 'Dashboard',
    statusCards: ['App', 'Version', 'Mode'],
    actions: [
      {
        id: 'runButton',
        label: 'Run Check',
        effect: 'writes health-check output to #output'
      }
    ],
    outputInitialText: 'Click Run Check de kiem tra ung dung.'
  },
  risks: [
    'CSP is not configured yet.',
    'sandbox is not explicitly enabled.',
    'External navigation and window.open guards are not configured.',
    'UI has a fixed minimum width of 920px.'
  ]
});

const getSafeAppConfig = () => {
  const fullConfig = getAppConfig();
  if (!isUserBuild()) {
    return fullConfig;
  }

  return {
    app: {
      name: packageInfo.name,
      flavor: 'user',
      displayName: app.getName(),
      productTitle: 'DG Image Tools',
      version: app.getVersion(),
      runtimeMode: isSmokeTest ? 'Smoke Test' : 'Local'
    },
    userSecurity: {
      privateConnectionHidden: true,
      adminFeaturesEnabled: false,
      localRouterOnly: true
    }
  };
};

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    ...windowConfig,
    show: !isSmokeTest,
    webPreferences: webPreferencesConfig
  });
  mainWindowRef = mainWindow;
  if (isUserBuild()) {
    Menu.setApplicationMenu(null);
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    recordSecurityEvent({
      reason: 'blocked_window_open',
      severity: 'medium',
      detail: { url }
    });
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow.webContents.getURL()) {
      event.preventDefault();
      recordSecurityEvent({
        reason: 'blocked_external_navigation',
        severity: 'medium',
        detail: { url }
      });
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html')).then(() => {
    if (isSmokeTest) {
      app.quit();
      return;
    }

    checkForUpdates();
    setInterval(() => checkForUpdates(), 5 * 60 * 1000);
  });
};

app.whenReady().then(() => {
  app.setAppUserModelId('com.9router.image-tool');
  setupAutoUpdater();
  ipcMain.handle('app:get-version', () => app.getVersion());
  ipcMain.handle('app:get-config', () => getSafeAppConfig());
  ipcMain.handle('update:check', () => checkForUpdates({ manual: true }));
  ipcMain.handle('update:status', () => updateStatus);
  ipcMain.handle('auth:login', (_event, credentials) => loginUser(credentials));
  ipcMain.handle('auth:me', (_event, token) => getCurrentUser(token));
  ipcMain.handle('admin:router-quota', async (_event, token) => {
    await requireAdminBuildForIpc('admin:router-quota');
    return getRouterQuota(token);
  });
  ipcMain.handle('image:save-data-url', (_event, config) => saveImageDataUrl(config));
  ipcMain.handle('admin:dashboard', async () => {
    await requireAdminBuildForIpc('admin:dashboard');
    requireAdminBuild();
    return getAdminDashboard();
  });
  ipcMain.handle('admin:create-user', async (_event, member) => {
    await requireAdminBuildForIpc('admin:create-user', { email: member?.email });
    requireAdminBuild();
    return createMemberUser(member);
  });
  ipcMain.handle('admin:update-user', async (_event, payload) => {
    await requireAdminBuildForIpc('admin:update-user', { id: payload?.id });
    requireAdminBuild();
    return updateMemberUser(payload);
  });
  ipcMain.handle('image:generate', (_event, config) => generateImage(config));
  ipcMain.handle('batch:write-manifest', (_event, config) => writeBatchManifest(config));
  ipcMain.handle('image:cancel', (_event, requestId) => {
    const controller = activeRequests.get(requestId);
    if (!controller) {
      return false;
    }

    controller.abort();
    activeRequests.delete(requestId);
    return true;
  });
  ipcMain.handle('dialog:select-output-dir', (event) => selectOutputDir(BrowserWindow.fromWebContents(event.sender)));
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
