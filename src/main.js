const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const packageInfo = require('../package.json');

if (app.isPackaged && !process.env.DATA_DIR) {
  process.env.DATA_DIR = path.join(app.getPath('userData'), 'data');
}

const adminStore = require('../server/store');

const isSmokeTest = process.argv.includes('--smoke-test');
const appServerBaseUrl = 'https://ducpt.com';
const userApiBasePath = '/api/9router/user';
const windowConfig = {
  width: 1180,
  height: 760,
  minWidth: 760,
  minHeight: 560,
  title: 'DG Image Tools Admin',
  backgroundColor: '#f6f7fb',
  icon: path.join(__dirname, 'assets', 'icon.png')
};

const webPreferencesConfig = {
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,
  nodeIntegration: false
};
const activeRequests = new Map();
let mainWindowRef = null;
let updateStatus = {
  state: 'idle',
  message: 'Chua kiem tra cap nhat.',
  version: null,
  downloaded: false
};

const getAppFlavor = () => (app.getName().toLowerCase().includes('user') ? 'user' : 'admin');

const requireAdminBuild = () => {
  if (getAppFlavor() !== 'admin') {
    throw new Error('Chuc nang quan ly thanh vien chi co trong ban Admin.');
  }
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
    return { message: text };
  }
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

const writeBatchManifest = async ({ outputDir, articleTitle, manifest }) => {
  const targetDir = createArticleDir(outputDir, articleTitle);
  await fs.mkdir(targetDir, { recursive: true });

  const filepath = path.join(targetDir, 'manifest.json');
  await fs.writeFile(filepath, JSON.stringify(manifest, null, 2), 'utf8');
  return filepath;
};

const loginUser = async ({ email, password }) => {
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

  const response = await fetch(`${appServerBaseUrl}${userApiBasePath}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({ email, password })
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

const getAdminDashboard = async () => {
  await adminStore.ensureAdminUser();
  const [stats, users, events] = await Promise.all([
    adminStore.getStats(),
    adminStore.listUsers(),
    adminStore.listEvents(100)
  ]);

  return { stats, users, events };
};

const createMemberUser = async (member) => {
  const user = await adminStore.createUser({
    ...member,
    role: member.role || 'user'
  });
  return { user, dashboard: await getAdminDashboard() };
};

const updateMemberUser = async ({ id, changes }) => {
  const user = await adminStore.updateUser(id, changes);
  return { user, dashboard: await getAdminDashboard() };
};

const generateImage = async (config) => {
  const requestId = config.requestId || crypto.randomUUID();
  const controller = new AbortController();
  activeRequests.set(requestId, controller);

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
    size,
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
    const targetEndpoint = endpoint || `${appServerBaseUrl}${userApiBasePath}/images/generations`;
    const bearerToken = authToken || apiKey;

    if (targetEndpoint.startsWith(appServerBaseUrl) && !authToken) {
      throw new Error('Vui lòng đăng nhập trước khi tạo ảnh.');
    }

    const response = await fetch(targetEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bearerToken}`,
        Accept: 'text/event-stream',
        ...(deviceId ? { 'X-Device-Id': deviceId } : {})
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const rawText = await response.text();

    if (!response.ok) {
      throw new Error(rawText || `Yêu cầu thất bại với HTTP ${response.status}`);
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

    return {
      ...parsed,
      requestId,
      savedPath
    };
  } catch (error) {
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

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    ...windowConfig,
    show: !isSmokeTest,
    webPreferences: webPreferencesConfig
  });
  mainWindowRef = mainWindow;

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
  ipcMain.handle('app:get-config', () => getAppConfig());
  ipcMain.handle('update:check', () => checkForUpdates({ manual: true }));
  ipcMain.handle('update:status', () => updateStatus);
  ipcMain.handle('auth:login', (_event, credentials) => loginUser(credentials));
  ipcMain.handle('auth:me', (_event, token) => getCurrentUser(token));
  ipcMain.handle('admin:dashboard', () => {
    requireAdminBuild();
    return getAdminDashboard();
  });
  ipcMain.handle('admin:create-user', (_event, member) => {
    requireAdminBuild();
    return createMemberUser(member);
  });
  ipcMain.handle('admin:update-user', (_event, payload) => {
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
