const appVersionEl = document.querySelector('#appVersion');
const authScreen = document.querySelector('#authScreen');
const loginForm = document.querySelector('#loginForm');
const loginEmailInput = document.querySelector('#loginEmail');
const loginPasswordInput = document.querySelector('#loginPassword');
const loginButton = document.querySelector('#loginButton');
const loginStatus = document.querySelector('#loginStatus');
const logoutButton = document.querySelector('#logoutButton');
const userIdentity = document.querySelector('#userIdentity');
const quotaBadge = document.querySelector('#quotaBadge');
const imageForm = document.querySelector('#imageForm');
const connectionSection = document.querySelector('#connectionSection');
const toggleConnectionVisibilityButton = document.querySelector('#toggleConnectionVisibility');
const renderButton = document.querySelector('#renderButton');
const clearPromptButton = document.querySelector('#clearPrompt');
const detectPromptButton = document.querySelector('#detectPrompt');
const statusText = document.querySelector('#statusText');
const lastRunEl = document.querySelector('#lastRun');
const outputLog = document.querySelector('#outputLog');
const previewFrame = document.querySelector('#previewFrame');
const previewGrid = document.querySelector('#previewGrid');
const previewImage = document.querySelector('#previewImage');
const downloadLink = document.querySelector('#downloadLink');
const promptInput = document.querySelector('#prompt');
const gemPresetSelect = document.querySelector('#gemPreset');
const gemReferenceModeSelect = document.querySelector('#gemReferenceMode');
const gemImageFileInput = document.querySelector('#gemImageFile');
const gemFileName = document.querySelector('#gemFileName');
const logoFileInput = document.querySelector('#logoFile');
const logoFileName = document.querySelector('#logoFileName');
const gemSimilarityInput = document.querySelector('#gemSimilarity');
const gemSimilarityValue = document.querySelector('#gemSimilarityValue');
const gemInstructionInput = document.querySelector('#gemInstruction');
const gemPromptOutput = document.querySelector('#gemPromptOutput');
const analyzeGemButton = document.querySelector('#analyzeGem');
const applyGemPromptButton = document.querySelector('#applyGemPrompt');
const commandOutput = document.querySelector('#commandOutput');
const copyCommandButton = document.querySelector('#copyCommand');
const promptFile = document.querySelector('#promptFile');
const batchPrompts = document.querySelector('#batchPrompts');
const batchDelay = document.querySelector('#batchDelay');
const batchCount = document.querySelector('#batchCount');
const batchStatus = document.querySelector('#batchStatus');
const runBatchButton = document.querySelector('#runBatch');
const outputDirInput = document.querySelector('#outputDir');
const chooseOutputDirButton = document.querySelector('#chooseOutputDir');
const articleTitleInput = document.querySelector('#articleTitle');
const apiKeyInput = document.querySelector('#apiKey');
const toggleApiKeyButton = document.querySelector('#toggleApiKey');
const memberPanelButton = document.querySelector('#memberPanelButton');
const memberPanelOverlay = document.querySelector('#memberPanelOverlay');
const memberPanelClose = document.querySelector('#memberPanelClose');
const memberPanelStatus = document.querySelector('#memberPanelStatus');
const memberCreateForm = document.querySelector('#memberCreateForm');
const memberTableBody = document.querySelector('#memberTableBody');
const memberStatRevenue = document.querySelector('#memberStatRevenue');
const memberStatUsers = document.querySelector('#memberStatUsers');
const memberStatActive = document.querySelector('#memberStatActive');
const memberStatExpiring = document.querySelector('#memberStatExpiring');
const memberStatExpired = document.querySelector('#memberStatExpired');
const memberStatImages = document.querySelector('#memberStatImages');
const memberStatFailures = document.querySelector('#memberStatFailures');
const memberPlanSelect = document.querySelector('#memberPlan');
const memberPriceInput = document.querySelector('#memberPrice');
const memberQuotaInput = document.querySelector('#memberQuota');
const memberExpiresAtInput = document.querySelector('#memberExpiresAt');
const memberDeviceLimitInput = document.querySelector('#memberDeviceLimit');
let editingMemberId = null;
const memberPlanPresets = {
  trial: {
    label: 'Dùng thử',
    price: 0,
    priceLabel: '0đ',
    quota: 10,
    days: 7,
    devices: 1,
    paymentStatus: 'trial'
  },
  monthly: {
    label: 'Gói tháng',
    price: 99000,
    priceLabel: '99.000đ',
    quota: 100,
    days: 30,
    devices: 1,
    paymentStatus: 'paid'
  },
  vip: {
    label: 'VIP',
    price: 199000,
    priceLabel: '199.000đ',
    quota: 300,
    days: 30,
    devices: 2,
    paymentStatus: 'paid'
  }
};

const getMemberPlanPreset = (planId = 'monthly') => memberPlanPresets[planId] || memberPlanPresets.monthly;

const getMemberPlanId = (user = {}) => {
  const planName = String(user.planName || '').toLowerCase();
  const monthlyPrice = Number(user.monthlyPrice || 0);
  if (planName.includes('vip') || monthlyPrice === memberPlanPresets.vip.price) {
    return 'vip';
  }
  if (planName.includes('thử') || planName.includes('thu') || monthlyPrice === memberPlanPresets.trial.price) {
    return 'trial';
  }
  return 'monthly';
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

const loadImageElement = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Khong doc duoc anh de ghep logo.'));
  image.src = src;
});

const composeLogoOnImage = async ({ imageUrl, logoUrl, position, logoSize, outputFormat }) => {
  if (!imageUrl || !logoUrl || position === 'none') {
    return imageUrl;
  }

  const [baseImage, logoImage] = await Promise.all([
    loadImageElement(imageUrl),
    loadImageElement(logoUrl)
  ]);
  const canvas = document.createElement('canvas');
  const width = baseImage.naturalWidth || baseImage.width;
  const height = baseImage.naturalHeight || baseImage.height;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(baseImage, 0, 0, width, height);

  const maxLogoWidth = Math.round(width * (Number(logoSize || 11) / 100));
  const logoRatio = (logoImage.naturalHeight || logoImage.height) / (logoImage.naturalWidth || logoImage.width || 1);
  const drawWidth = maxLogoWidth;
  const drawHeight = Math.round(drawWidth * logoRatio);
  const margin = Math.round(width * 0.025);
  const x = position === 'topLeft' || position === 'bottomLeft'
    ? margin
    : width - drawWidth - margin;
  const y = position === 'bottomLeft' || position === 'bottomRight'
    ? height - drawHeight - margin
    : margin;

  ctx.drawImage(logoImage, x, y, drawWidth, drawHeight);
  const mime = outputFormat === 'jpg' || outputFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
  return canvas.toDataURL(mime, 0.95);
};
let activeRequestId = null;
let isRendering = false;
let stopBatchRequested = false;
let stopEnabledAt = 0;
let isBatchRunning = false;
let isArticleTitleManual = false;
let authSession = null;
let appConfig = null;
let logoDataUrl = '';

memberPanelButton.hidden = true;

const getDeviceId = () => {
  const existing = localStorage.getItem('deviceId');
  if (existing) {
    return existing;
  }

  const deviceId = crypto.randomUUID();
  localStorage.setItem('deviceId', deviceId);
  return deviceId;
};

const setLoginStatus = (message, type = '') => {
  loginStatus.textContent = message;
  loginStatus.classList.toggle('error', type === 'error');
  loginStatus.classList.toggle('ok', type === 'ok');
};

const setAuthenticated = (session) => {
  authSession = session;
  document.body.classList.toggle('auth-locked', !session);
  userIdentity.textContent = session?.user?.email || 'Local image endpoint workspace';
  logoutButton.hidden = !session?.token;
  if (session?.token) {
    quotaBadge.hidden = false;
    quotaBadge.textContent = 'Quota --';
    refreshRouterQuota().catch(() => renderQuotaBadge(session?.user));
  } else {
    renderQuotaBadge(session?.user);
  }
};

const renderQuotaBadge = (user) => {
  const quotaTotal = Number(user?.quotaTotal ?? 0);
  const quotaUsed = Number(user?.quotaUsed ?? 0);
  const quotaRemaining = Number.isFinite(Number(user?.quotaRemaining))
    ? Number(user.quotaRemaining)
    : Math.max(0, quotaTotal - quotaUsed);

  if (!user || !quotaTotal) {
    quotaBadge.hidden = true;
    quotaBadge.textContent = 'Quota --';
    return;
  }

  quotaBadge.hidden = false;
  quotaBadge.textContent = `Quota ${quotaTotal}`;
  quotaBadge.classList.toggle('quota-low', quotaRemaining <= Math.max(3, Math.ceil(quotaTotal * 0.1)));
};

const renderRouterQuotaBadge = (quota) => {
  const quotaTotal = Number(quota?.quotaTotal);
  const quotaUsed = Number(quota?.quotaUsed ?? 0);
  const quotaRemaining = Number.isFinite(Number(quota?.quotaRemaining))
    ? Number(quota.quotaRemaining)
    : (Number.isFinite(quotaTotal) ? Math.max(0, quotaTotal - quotaUsed) : null);

  quotaBadge.hidden = false;
  if (Number.isFinite(quotaTotal) && quotaTotal > 0) {
    quotaBadge.textContent = `Quota ${quotaTotal}${quota?.quotaUnit === 'accounts' ? ' TK' : ''}`;
    quotaBadge.classList.toggle('quota-low', quotaRemaining <= Math.max(3, Math.ceil(quotaTotal * 0.1)));
    return;
  }

  quotaBadge.textContent = 'Quota --';
  quotaBadge.classList.remove('quota-low');
};

const refreshRouterQuota = async () => {
  if (!window.toolApi.getRouterQuota) {
    return null;
  }

  const quota = await window.toolApi.getRouterQuota(authSession.token);
  if (quota) {
    renderRouterQuotaBadge(quota);
  }

  return quota;
};

const refreshCurrentUser = async () => {
  if (!authSession?.token) {
    return null;
  }

  const user = await window.toolApi.getCurrentUser(authSession.token);
  authSession = { ...authSession, user };
  await refreshRouterQuota().catch(() => renderQuotaBadge(user));
  userIdentity.textContent = user?.email || authSession.user?.email || 'Local image endpoint workspace';
  return user;
};

const restoreAuthSession = async () => {
  if (appConfig?.app?.flavor === 'admin') {
    setAuthenticated({
      token: '',
      user: {
        id: 'local-admin',
        email: 'Local Admin',
        role: 'admin',
        status: 'active',
        quotaTotal: 999999,
        quotaUsed: 0
      }
    });
    loginStatus.textContent = '';
    memberPanelButton.hidden = false;
    return;
  }

  const token = localStorage.getItem('authToken');
  const email = localStorage.getItem('authUserEmail');

  if (!token) {
    setAuthenticated(null);
    return;
  }

  setAuthenticated({
    token,
    user: {
      email: email || 'Dang tai tai khoan...'
    }
  });

  try {
    await refreshCurrentUser();
  } catch (error) {
    clearAuthSession();
    setLoginStatus(error.message || 'Phien dang nhap khong con hop le.', 'error');
  }
};

const clearAuthSession = () => {
  if (appConfig?.app?.flavor === 'admin') {
    restoreAuthSession();
    return;
  }

  localStorage.removeItem('authToken');
  localStorage.removeItem('authUserEmail');
  setAuthenticated(null);
  loginPasswordInput.value = '';
  loginEmailInput.focus();
};

const clearPreviewGrid = () => {
  previewGrid.innerHTML = `
    <div class="empty-preview">
      <img src="../assets/icon.png" alt="">
      <span>Chưa có ảnh</span>
    </div>
  `;
};

const getPreviewCaption = (title, index) => {
  const fallback = `Ảnh ${index}`;
  const cleanTitle = normalizeTitleText(title);
  const shortTitle = createTitleFromPrompt(cleanTitle || fallback);
  return `${String(index).padStart(2, '0')} - ${shortTitle || fallback}`;
};

const addPreviewTile = ({ imageUrl, title, index }) => {
  previewGrid.querySelector('.empty-preview')?.remove();

  const tile = document.createElement('article');
  tile.className = 'preview-tile';

  const thumb = document.createElement('div');
  thumb.className = 'preview-thumb';

  const image = document.createElement('img');
  image.src = imageUrl;
  image.alt = title || `Ảnh ${index}`;

  const caption = document.createElement('div');
  caption.className = 'preview-caption';
  caption.title = title || `Ảnh ${index}`;
  caption.textContent = getPreviewCaption(title, index);

  thumb.append(image);
  tile.append(thumb, caption);
  previewGrid.append(tile);
};

const addPreviewErrorTile = ({ title, index, error }) => {
  previewGrid.querySelector('.empty-preview')?.remove();

  const tile = document.createElement('article');
  tile.className = 'preview-tile preview-tile-error';

  const thumb = document.createElement('div');
  thumb.className = 'preview-thumb preview-error';

  const message = document.createElement('div');
  message.className = 'preview-error-text';
  message.textContent = 'Lỗi tạo ảnh';

  const caption = document.createElement('div');
  caption.className = 'preview-caption';
  caption.title = error || title || `Ảnh ${index}`;
  caption.textContent = getPreviewCaption(title || 'Không tạo được', index);

  thumb.append(message);
  tile.append(thumb, caption);
  previewGrid.append(tile);
};

const normalizeTitleText = (value) => String(value || '')
  .replace(/\s+/g, ' ')
  .trim();

const createTitleFromPrompt = (prompt) => {
  const cleanPrompt = normalizeTitleText(prompt);

  if (!cleanPrompt) {
    return '';
  }

  const quotedText = extractQuotedTexts(cleanPrompt)[0];
  if (quotedText) {
    return normalizeTitleText(quotedText).slice(0, 90);
  }

  return cleanPrompt
    .replace(/\b(please|create|generate|make|draw|image|photo|picture|thumbnail|ảnh|tạo|hãy|vẽ|một|con|cái)\b/gi, ' ')
    .replace(/[,:;.!?()[\]{}"'“”‘’]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90);
};

const gemPresets = {
  general: {
    label: 'GEM CTR tong hop',
    instruction: 'Act as a YouTube thumbnail strategist. Find the clearest click trigger, one main subject, one emotional contrast, and one short headline. Build a clean 16:9 thumbnail prompt with high readability, strong focal point, and no clutter.',
    headlineTone: 'curiosity, benefit, high CTR'
  },
  finance: {
    label: 'GEM tai chinh / crypto',
    instruction: 'Act as a finance and crypto thumbnail expert. Emphasize money movement, risk, profit, chart direction, trust, and urgency without scam claims. Use clear charts, green/red contrast, coin/cash badges, and a serious expert look.',
    headlineTone: 'profit, risk, warning, opportunity'
  },
  drama: {
    label: 'GEM drama / celebrity',
    instruction: 'Act as an entertainment drama thumbnail expert. Emphasize facial emotion, conflict, reveal, gossip cues, red/yellow contrast, arrows, exclusive badge, and a clean headline that creates curiosity without defamatory certainty.',
    headlineTone: 'shock, reveal, tension'
  },
  tutorial: {
    label: 'GEM tutorial / how-to',
    instruction: 'Act as a tutorial thumbnail expert. Make the result obvious in one second. Use step badge, arrows, before/after cue, clean UI/object close-up, and a short headline focused on the outcome.',
    headlineTone: 'clear result, simple method'
  },
  product: {
    label: 'GEM san pham / review',
    instruction: 'Act as a product and review thumbnail expert. Show the product large, comparison or rating cue, clean proof badge, price/value signal, and premium commercial lighting. Make the viewer understand the decision angle immediately.',
    headlineTone: 'best/worst, worth it, proof'
  },
  mystery: {
    label: 'GEM bi an / kham pha',
    instruction: 'Act as a mystery and discovery thumbnail expert. Use hidden/revealed object, question cue, suspense lighting, magnifier/arrow, and a headline that creates curiosity while keeping the subject readable.',
    headlineTone: 'secret, unknown, reveal'
  },
  trueCrime: {
    label: 'GEM true crime / vu an',
    instruction: 'Act as a true-crime thumbnail expert. Use suspense, evidence board cues, silhouette, red circle, document/photo clues, dark contrast, and a careful headline that suggests mystery without graphic violence or defamatory certainty.',
    headlineTone: 'case, clue, mystery'
  },
  movieAnime: {
    label: 'GEM phim / anime',
    instruction: 'Act as a movie/anime thumbnail expert. Use cinematic character framing, dramatic lighting, versus/reveal composition, episode/movie energy, and a bold headline that signals review, theory, or ranking.',
    headlineTone: 'theory, ranking, reveal'
  },
  education: {
    label: 'GEM giao duc / kien thuc',
    instruction: 'Act as an education thumbnail expert. Make the concept instantly understandable with one visual metaphor, clean labels, diagram cue, large subject, and a benefit-focused headline.',
    headlineTone: 'learn fast, simple, useful'
  },
  history: {
    label: 'GEM lich su',
    instruction: 'Act as a history thumbnail expert. Use archival mood, map/timeline cues, old photo texture, before-after era contrast, and a headline that creates historical curiosity.',
    headlineTone: 'forgotten, turning point, truth'
  },
  realEstate: {
    label: 'GEM bat dong san',
    instruction: 'Act as a real-estate thumbnail expert. Show property/land/house clearly, price or location cue, arrow, document/contract badge, and a headline about opportunity, risk, or market movement.',
    headlineTone: 'deal, warning, market'
  },
  autoCar: {
    label: 'GEM xe co',
    instruction: 'Act as an automotive thumbnail expert. Show the vehicle large, aggressive angle, speed/detail cue, comparison badge, price/review signal, and clean high-contrast typography.',
    headlineTone: 'review, speed, worth it'
  },
  sports: {
    label: 'GEM the thao',
    instruction: 'Act as a sports thumbnail expert. Use action freeze frame, athlete emotion, scoreboard/ranking cue, versus layout, trophy/fire effects, and a strong result or controversy headline.',
    headlineTone: 'win, record, clash'
  },
  podcast: {
    label: 'GEM podcast / interview',
    instruction: 'Act as a podcast thumbnail expert. Use expressive guest face, clean studio/interview framing, quote-style headline, name badge, and professional lighting with strong face hierarchy.',
    headlineTone: 'quote, confession, insight'
  },
  reaction: {
    label: 'GEM reaction',
    instruction: 'Act as a reaction thumbnail expert. Use big emotional face, object/video frame being reacted to, arrow/circle, shock or laugh cue, and very short readable headline.',
    headlineTone: 'reaction, shock, funny'
  },
  law: {
    label: 'GEM phap luat',
    instruction: 'Act as a legal/policy thumbnail expert. Use court/document/gavel cues, red warning badge, serious expert expression, clean evidence layout, and a headline about risk or rights.',
    headlineTone: 'warning, rights, legal risk'
  },
  parenting: {
    label: 'GEM gia dinh / parenting',
    instruction: 'Act as a parenting/family thumbnail expert. Use parent-child emotion, problem/solution contrast, warm trustworthy colors, checklist or warning cue, and a clear outcome headline.',
    headlineTone: 'care, mistake, solution'
  },
  science: {
    label: 'GEM khoa hoc',
    instruction: 'Act as a science thumbnail expert. Use experiment/lab/space/diagram cues, clear visual question, glow or magnifier detail, and a curiosity headline that makes the concept visual.',
    headlineTone: 'why, discovery, experiment'
  },
  custom: {
    label: 'GEM rieng',
    instruction: '',
    headlineTone: 'custom'
  }
};

const getGemInstruction = () => {
  const preset = gemPresets[gemPresetSelect?.value] || gemPresets.general;
  return (gemInstructionInput.value.trim() || preset.instruction).trim();
};

const getGemReferenceInstruction = () => {
  const similarity = Number(gemSimilarityInput?.value || 97);
  const hasReference = Boolean(document.querySelector('#refImageUrl')?.value.trim());
  const mode = gemReferenceModeSelect?.value || 'match';

  if (!hasReference) {
    return '';
  }

  if (mode === 'nearExact') {
    return `Analyze attached thumbnail and remake it as close as possible ${similarity}-100%: same composition, camera angle, subject size, face expression, lighting direction, color palette, typography scale, text placement, badge/arrow shapes, empty space, contrast, and depth; change only the topic-specific object/headline when required`;
  }

  if (mode === 'cloneLayout') {
    return `Analyze attached thumbnail and clone its layout ${similarity}-100%: same subject position, text blocks, negative space, object hierarchy, crop, arrows, badges, and foreground/background separation; adapt content to the new topic`;
  }

  if (mode === 'cloneColorText') {
    return `Analyze attached thumbnail and keep its color and text system ${similarity}-100%: same palette, font weight, headline size, stroke/shadow, badge style, glow, contrast, and readable mobile text; change only words and topic objects`;
  }

  if (mode === 'cloneSubject') {
    return `Analyze attached thumbnail and preserve the main subject/product treatment ${similarity}-100%: same character pose, face emotion, product angle, lighting, outline, scale, and focus; rebuild background/headline for this topic`;
  }

  if (mode === 'styleExtract') {
    return `Analyze attached thumbnail, extract its CTR formula only: hook type, focal hierarchy, emotional contrast, color logic, text weight, and click trigger; create a fresh image for this topic without copying exact layout`;
  }

  if (mode === 'variant') {
    return `Analyze attached thumbnail, keep its visual system about ${similarity}% similar, but change subject/details for this topic`;
  }

  if (mode === 'contrast') {
    return `Analyze attached thumbnail, keep only its CTR logic, create a different layout for this topic`;
  }

  return `Analyze attached thumbnail and recreate its formula ${similarity}-100%: same layout, text scale, color palette, subject framing, badge/arrow style, contrast; only change topic/headline`;
};

const extractGemHeadline = (text, preset) => {
  const quoted = extractQuotedTexts(text)[0];
  if (quoted) {
    return quoted.slice(0, 38);
  }

  const clean = normalizeTitleText(text)
    .replace(/\b(tạo|hay|hãy|thumbnail|youtube|video|kịch bản|noi dung|nội dung|prompt)\b/gi, ' ')
    .replace(/[,:;.!?()[\]{}"'“”‘’]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = clean.split(' ').filter(Boolean);

  if (preset === 'finance') {
    return 'CO HOI HAY RUI RO?';
  }
  if (preset === 'drama') {
    return 'SU THAT BAT NGO';
  }
  if (preset === 'tutorial') {
    return 'LAM DUOC NGAY';
  }
  if (preset === 'product') {
    return 'DANG MUA KHONG?';
  }
  if (preset === 'mystery') {
    return 'BI MAT LA GI?';
  }
  if (preset === 'trueCrime') {
    return 'MANH MOI MOI?';
  }
  if (preset === 'movieAnime') {
    return 'DINH CAO HAY TE?';
  }
  if (preset === 'education') {
    return 'HIEU NGAY';
  }
  if (preset === 'history') {
    return 'SU THAT BI QUEN';
  }
  if (preset === 'realEstate') {
    return 'CO HOI HAY BAY?';
  }
  if (preset === 'autoCar') {
    return 'DANG MUA KHONG?';
  }
  if (preset === 'sports') {
    return 'TRAN DAU DINH CAO';
  }
  if (preset === 'podcast') {
    return 'LAN DAU TIET LO';
  }
  if (preset === 'reaction') {
    return 'KHONG THE TIN';
  }
  if (preset === 'law') {
    return 'COI CHUNG VI PHAM';
  }
  if (preset === 'parenting') {
    return 'DUNG MAC LOI NAY';
  }
  if (preset === 'science') {
    return 'TAI SAO LAI THE?';
  }

  return words.slice(0, 5).join(' ').toUpperCase() || 'DIEU CAN BIET';
};

const inferPromptLanguage = (text) => {
  const normalized = String(text || '').toLowerCase();
  if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(normalized)
    || /\b(tôi|bạn|cách|kiếm|tiền|đầu tư|thành công|sự thật|không|người|chủ đề)\b/i.test(normalized)) {
    return 'vi';
  }
  if (/\b(mexico|español|dinero|noticia|secreto|alerta|urgente|ganar|inversion)\b/i.test(normalized)) {
    return 'es';
  }
  if (/[a-z]/i.test(normalized)) {
    return 'en';
  }
  return 'auto';
};

const getGemTextPolicy = (text, presetKey = 'general') => {
  const haystack = `${text || ''} ${presetKey || ''}`.toLowerCase();
  const has = (pattern) => pattern.test(haystack);

  if (has(/không chữ|khong chu|no text|textless|without text|không có text|khong co text|clean image|ảnh nền|anh nen|background|wallpaper|b-roll|cinematic shot|film still|product photo|packshot|lookbook|portrait only|ảnh chân dung|anh chan dung/)) {
    return {
      textMode: 'noText',
      textLanguage: 'none',
      reason: 'GEM nhận diện dạng visual/ảnh sạch nên ưu tiên không chữ.'
    };
  }

  if (has(/finance|crypto|bitcoin|stock|chứng khoán|chung khoan|đầu tư|dau tu|money|tutorial|how to|hướng dẫn|huong dan|education|giáo dục|giao duc|true crime|vụ án|vu an|law|pháp luật|phap luat|real estate|bất động sản|bat dong san|news|tin nóng|tin nong|drama|reaction|podcast|sports|thể thao|the thao|review|before after|trước sau|truoc sau|success|thành công|thanh cong/)) {
    return {
      textMode: 'required',
      textLanguage: inferPromptLanguage(text),
      reason: 'GEM nhận diện ngách YouTube cần headline lớn để tăng CTR.'
    };
  }

  if (has(/travel|du lịch|du lich|food|ẩm thực|am thuc|cinematic|movie|film|nature|landscape|resort|hotel|fashion|beauty|product|sản phẩm|san pham/)) {
    return {
      textMode: 'normal',
      textLanguage: inferPromptLanguage(text),
      reason: 'GEM nhận diện ngách có thể dùng ít chữ hoặc theo prompt.'
    };
  }

  return {
    textMode: 'normal',
    textLanguage: inferPromptLanguage(text),
    reason: 'GEM dùng chế độ chữ theo prompt.'
  };
};

const applyGemTextPolicy = (text, presetKey) => {
  const policy = getGemTextPolicy(text, presetKey);
  const textModeSelect = document.querySelector('#textMode');
  const textLanguageSelect = document.querySelector('#textLanguage');

  if (textModeSelect && (textModeSelect.value === 'autoText' || textModeSelect.value === 'normal')) {
    textModeSelect.value = policy.textMode;
  }

  if (textLanguageSelect && textLanguageSelect.value === 'auto' && policy.textLanguage !== 'auto') {
    textLanguageSelect.value = policy.textLanguage;
  }

  return policy;
};

const buildGemPrompt = () => {
  const script = promptInput.value.trim();
  const presetKey = gemPresetSelect.value || 'general';
  const preset = gemPresets[presetKey] || gemPresets.general;
  const instruction = getGemInstruction();
  const referenceInstruction = getGemReferenceInstruction();
  const headline = extractGemHeadline(script, presetKey);
  const detected = getDetectedPromptSettings(`${script} ${preset.label}`);
  const policy = getGemTextPolicy(`${script} ${preset.label}`, presetKey);
  const selectedTextLanguage = document.querySelector('#textLanguage')?.value || 'auto';
  const selectedTextMode = document.querySelector('#textMode')?.value || 'autoText';
  const textLanguage = selectedTextLanguage === 'auto' ? policy.textLanguage : selectedTextLanguage;
  const textMode = selectedTextMode === 'autoText' ? policy.textMode : selectedTextMode;
  const wantsNoText = textLanguage === 'none' || textMode === 'noText';
  const languageLine = {
    vi: 'Toàn bộ chữ trên ảnh phải là tiếng Việt.',
    en: 'All visible text must be English.',
    es: 'Todo el texto visible debe estar en español.',
    auto: 'Chữ trên ảnh dùng cùng ngôn ngữ với câu lệnh.'
  }[textLanguage] || '';

  return [
    `Tạo thumbnail YouTube 16:9 cho: ${script || 'ý tưởng video mới từ ảnh mẫu'}.`,
    referenceInstruction,
    `Phong cách ${preset.label}: ${instruction}`,
    logoDataUrl ? 'Không vẽ lại logo trong ảnh. Chừa vùng sạch cho logo gốc, app sẽ tự ghép logo file thật sau khi tạo.' : '',
    policy.reason,
    wantsNoText ? 'Không đặt chữ, số, logo, watermark hoặc caption đọc được trên ảnh.' : `Text lớn trên ảnh: "${headline}".`,
    wantsNoText ? '' : languageLine,
    wantsNoText
      ? 'Một chủ thể chính, cảm xúc rõ, tương phản mạnh, bố cục CTR sạch, dùng ánh sáng/màu/mũi tên hoặc hình khối để tạo điểm nhấn, không chữ.'
      : 'Một chủ thể chính, chữ to dễ đọc trên mobile, tương phản mạnh, bố cục CTR sạch, có mũi tên/badge nếu cần, không chữ nhỏ, không rối.'
  ].filter(Boolean).join(' ');
};

const syncGemInstruction = () => {
  const preset = gemPresets[gemPresetSelect?.value] || gemPresets.general;
  gemInstructionInput.closest('.gem-workspace')?.classList.toggle('custom-gem', gemPresetSelect?.value === 'custom');
  if (gemPresetSelect?.value !== 'custom') {
    gemInstructionInput.value = preset.instruction;
  }
};

const analyzeGemPrompt = ({ applyToPrompt = false } = {}) => {
  syncGemInstruction();
  const policy = applyGemTextPolicy(promptInput.value, gemPresetSelect?.value || 'general');
  const prompt = buildGemPrompt();
  gemPromptOutput.value = prompt;

  if (applyToPrompt) {
    promptInput.value = prompt;
    isArticleTitleManual = false;
    syncArticleTitleFromPrompt();
    applyDetectedPromptSettings();
    updateCommand();
  }

  statusText.textContent = `GEM da tao prompt thumbnail | ${policy.reason}`;
  outputLog.textContent = `GEM gợi ý câu lệnh:\n${prompt}`;
  updateCommand();
  return prompt;
};

const syncArticleTitleFromPrompt = () => {
  if (isArticleTitleManual) {
    return;
  }

  articleTitleInput.value = createTitleFromPrompt(promptInput.value);
};

const setStatus = (message) => {
  statusText.textContent = message;
  outputLog.textContent = message;
};

const summarizeError = (error) => {
  const raw = String(error?.message || error || '').trim();
  if (!raw) {
    return 'Loi khong xac dinh';
  }

  const cleanForDisplay = (value) => {
    const compact = String(value || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (appConfig?.app?.flavor !== 'user') {
      return compact.slice(0, 240);
    }

    return compact
      .replace(/https?:\/\/[^\s)"']+/gi, '[server]')
      .replace(/\b(?:localhost|127\.0\.0\.1):\d+\b/gi, '[server]')
      .replace(/\/api\/[^\s)"']+/gi, '[service]')
      .replace(/\b(?:backend|endpoint|proxy|route|render|onrender|api key|apikey)\b/gi, 'dich vu')
      .replace(/\s+/g, ' ')
      .slice(0, 240);
  };

  try {
    const parsed = JSON.parse(raw);
    const message = parsed.message || parsed.error?.message || parsed.error || raw;
    return cleanForDisplay(message);
  } catch {
    return cleanForDisplay(raw);
  }
};

const compactPrompt = (prompt, maxLength = 160) => {
  const clean = String(prompt || '').replace(/\s+/g, ' ').trim();
  return clean.length > maxLength ? `${clean.slice(0, maxLength)}...` : clean;
};

const renderBatchLog = (results, total, currentMessage = '') => {
  const lines = [];
  if (currentMessage) {
    lines.push(currentMessage, '');
  }

  lines.push(`Lich su tao anh: ${results.filter((item) => item.ok).length} thanh cong, ${results.filter((item) => !item.ok).length} loi / ${total}`, '');
  results.forEach((item) => {
    lines.push(`${String(item.index).padStart(2, '0')}. ${item.ok ? 'OK' : 'LOI'} - ${item.fileTitle || item.title || 'Khong co tieu de'}`);
    lines.push(`Prompt: ${compactPrompt(item.prompt)}`);
    lines.push(item.ok ? `File: ${item.savedPath || 'Da luu'}` : `Loi: ${summarizeError(item.error)}`);
    lines.push('');
  });

  outputLog.textContent = lines.join('\n').trim();
  outputLog.scrollTop = outputLog.scrollHeight;
};

const shouldRetryGenerationError = (error) => {
  const message = String(error?.message || error || '');
  return !/(HTTP\s*(400|401|403|404|405)|endpoint khong cho phep POST|Not Allowed|Unauthorized|Forbidden|Thiếu token|token|quota|hết hạn|vượt giới hạn thiết bị|không tồn tại)/i.test(message);
};

const setVersion = async () => {
  const [version, config] = await Promise.all([
    window.toolApi.getVersion(),
    window.toolApi.getConfig()
  ]);
  appConfig = config;
  document.body.classList.toggle('user-build', config?.app?.flavor === 'user');
  document.body.classList.toggle('admin-build', config?.app?.flavor === 'admin');
  appVersionEl.textContent = `v${version}`;
  memberPanelButton.hidden = config?.app?.flavor !== 'admin';
  if (config?.app?.flavor === 'user') {
    document.title = 'DG Image Tools';
    document.querySelectorAll('.brand-lockup h1').forEach((title) => {
      title.textContent = 'DG Image Tools';
    });
    connectionSection.hidden = true;
    document.querySelector('#endpoint').required = false;
    document.querySelector('#endpoint').disabled = true;
    apiKeyInput.disabled = true;
    apiKeyInput.value = '';
    document.querySelector('#endpoint').value = '';
    document.querySelector('.command-panel')?.classList.add('hidden');
  } else {
    connectionSection.hidden = false;
    document.querySelector('#endpoint').disabled = false;
    document.querySelector('#endpoint').required = true;
    apiKeyInput.disabled = false;
    document.querySelector('.command-panel')?.classList.remove('hidden');
  }
};

const getFormConfig = () => {
  const formData = new FormData(imageForm);
  const prompt = String(formData.get('prompt') || '').trim();
  const promptStyle = formData.get('promptStyle');
  const detectedSettings = getDetectedPromptSettings(prompt);
  const effectivePromptStyle = promptStyle === 'autoDetect' ? detectedSettings.promptStyle : promptStyle;
  const rawTextMode = formData.get('textMode') || 'autoText';
  const autoTextPolicy = getGemTextPolicy(prompt, gemPresetSelect?.value || 'general');
  const effectiveTextMode = rawTextMode === 'autoText' ? autoTextPolicy.textMode : rawTextMode;
  const effectiveIconStyle = promptStyle === 'autoDetect' ? detectedSettings.iconStyle : formData.get('iconStyle');
  const effectiveSize = promptStyle === 'autoDetect' ? detectedSettings.size : formData.get('size');
  const rawTextLanguage = formData.get('textLanguage') || 'auto';
  const textLanguage = rawTextLanguage === 'auto' ? autoTextPolicy.textLanguage : rawTextLanguage;

  return {
    model: formData.get('model'),
    endpoint: appConfig?.app?.flavor === 'user'
      ? ''
      : normalizeEndpointForRequest(formData.get('endpoint')),
    apiKey: appConfig?.app?.flavor === 'user' ? '' : formData.get('apiKey'),
    authToken: authSession?.token || '',
    deviceId: getDeviceId(),
    prompt: enhancePrompt(prompt, effectivePromptStyle),
    fileTitle: prompt,
    refImageUrl: formData.get('refImageUrl'),
    size: normalizeImageSizeForRequest(effectiveSize),
    quality: formData.get('quality'),
    background: formData.get('background'),
    textMode: textLanguage === 'none' ? 'noText' : effectiveTextMode,
    textLanguage,
    iconStyle: effectiveIconStyle,
    imageDetail: formData.get('imageDetail'),
    outputFormat: formData.get('outputFormat'),
    outputDir: formData.get('outputDir'),
    articleTitle: formData.get('articleTitle'),
    logoDataUrl,
    logoPosition: formData.get('logoPosition') || 'topRight',
    logoSize: formData.get('logoSize') || '11',
    promptStyle: promptStyle === 'autoDetect' ? 'autoDetect' : effectivePromptStyle,
    effectivePromptStyle
  };
};

const getDetectedPromptSettings = (prompt) => {
  const text = String(prompt || '').toLowerCase();
  const has = (pattern) => pattern.test(text);
  const isThumbnail = has(/thumbnail|thumb|youtube|headline|title|ctr|tin tức|báo|drama|scandal|gossip|celebrity|mexico|viral|clickbait/);
  const isBreaking = has(/breaking|tin nóng|khẩn|cảnh báo|alert|sốc|shock|drama|scandal/);
  const isReview = has(/review|đánh giá|rating|top|best|worst|so sánh|compare|vs\b/);
  const isTutorial = has(/how to|tutorial|hướng dẫn|cách|bí quyết|mẹo|tips|guide/);
  const isProduct = has(/product|sản phẩm|ecommerce|shop|bán hàng|packshot|studio|commercial/);
  const isSocial = has(/facebook|tiktok|instagram|social|mạng xã hội|post|banner/);
  const isCinematic = has(/cinematic|movie|film|điện ảnh|forest|nature|tree|cây|gỗ|landscape|núi|biển|ánh sáng/);
  const isTech = has(/tech|công nghệ|ai|chatgpt|robot|software|app|iphone|android|máy tính/);
  const isGaming = has(/game|gaming|esport|streamer|minecraft|roblox|free fire|pubg|valorant/);
  const isFinance = has(/finance|tài chính|money|tiền|crypto|bitcoin|stock|chứng khoán|đầu tư/);
  const isHealth = has(/health|sức khỏe|fitness|gym|beauty|làm đẹp|skin|diet|giảm cân/);
  const isTravel = has(/travel|du lịch|khám phá|review địa điểm|resort|hotel|beach|biển/);
  const isFood = has(/food|ẩm thực|món ăn|recipe|cooking|nấu ăn|restaurant|nhà hàng/);
  const isBeforeAfter = has(/before after|before\/after|trước sau|biến đổi|transformation|makeover/);
  const isMystery = has(/mystery|bí ẩn|khám phá|secret|sự thật|ẩn giấu|unknown/);
  const isSuccess = has(/success|thành công|motivation|động lực|rich|giàu|business|doanh nhân/);

  const isTrueCrime = has(/true crime|crime|vu an|vụ án|an mang|án mạng|mat tich|mất tích|dieu tra|điều tra|bang chung|bằng chứng|toi pham|tội phạm/);
  const isMovieAnime = has(/movie|phim|anime|manga|netflix|spoiler|trailer|episode|tap phim|tập phim|nhan vat|nhân vật/);
  const isEducation = has(/education|giao duc|giáo dục|kien thuc|kiến thức|hoc|học|bai hoc|bài học|giai thich|giải thích|facts/);
  const isHistory = has(/history|lich su|lịch sử|chien tranh|chiến tranh|de che|đế chế|trieu dai|triều đại|co dai|cổ đại/);
  const isRealEstate = has(/real estate|bat dong san|bất động sản|nha dat|nhà đất|chung cu|chung cư|dat nen|đất nền/);
  const isAutoCar = has(/car|auto|xe hoi|xe hơi|oto|ô tô|motor|moto|review xe|sieu xe|siêu xe|tesla/);
  const isSports = has(/sports|the thao|thể thao|bong da|bóng đá|football|soccer|nba|tran dau|trận đấu|cau thu|cầu thủ/);
  const isPodcast = has(/podcast|interview|phong van|phỏng vấn|talkshow|khach moi|khách mời|tro chuyen|trò chuyện/);
  const isReaction = has(/reaction|react|phan ung|phản ứng|bat ngo|bất ngờ|khong tin|không tin|cuoi|cười/);
  const isLaw = has(/law|legal|phap luat|pháp luật|luat|luật|kien|kiện|toa an|tòa án|hop dong|hợp đồng/);
  const isParenting = has(/parenting|gia dinh|gia đình|cha me|cha mẹ|con cai|con cái|nuoi day|nuôi dạy|tre em|trẻ em/);

  if (isThumbnail) {
    return {
      promptStyle: 'mexicoThumbnail',
      textMode: isBreaking ? 'shock' : 'curiosity',
      iconStyle: isBreaking ? 'alert' : 'youtubeViral',
      size: '1536x864'
    };
  }

  if (isReview) {
    return { promptStyle: 'social', textMode: 'authority', iconStyle: 'reviewRating', size: '1536x864' };
  }

  if (isTutorial) {
    return { promptStyle: 'social', textMode: 'tutorialClear', iconStyle: 'tutorialGuide', size: '1536x864' };
  }

  if (isProduct) {
    return {
      promptStyle: 'product',
      textMode: 'luxury',
      iconStyle: 'productSale',
      size: '1536x1024'
    };
  }

  if (isTrueCrime) {
    return { promptStyle: 'cinematic', textMode: 'mysteryReveal', iconStyle: 'alert', size: '1536x864' };
  }

  if (isMovieAnime) {
    return { promptStyle: 'cinematic', textMode: 'controversy', iconStyle: 'youtubeViral', size: '1536x864' };
  }

  if (isEducation) {
    return { promptStyle: 'social', textMode: 'tutorialClear', iconStyle: 'tutorialGuide', size: '1536x864' };
  }

  if (isHistory) {
    return { promptStyle: 'cinematic', textMode: 'mysteryReveal', iconStyle: 'mystery', size: '1536x864' };
  }

  if (isRealEstate) {
    return { promptStyle: 'social', textMode: 'moneySuccess', iconStyle: 'finance', size: '1536x864' };
  }

  if (isAutoCar) {
    return { promptStyle: 'premium', textMode: 'authority', iconStyle: 'reviewRating', size: '1536x864' };
  }

  if (isSports) {
    return { promptStyle: 'social', textMode: 'shock', iconStyle: 'gaming', size: '1536x864' };
  }

  if (isPodcast) {
    return { promptStyle: 'premium', textMode: 'emotionalStory', iconStyle: 'none', size: '1536x864' };
  }

  if (isReaction) {
    return { promptStyle: 'social', textMode: 'shock', iconStyle: 'youtubeViral', size: '1536x864' };
  }

  if (isLaw) {
    return { promptStyle: 'social', textMode: 'fearUrgency', iconStyle: 'alert', size: '1536x864' };
  }

  if (isParenting) {
    return { promptStyle: 'premium', textMode: 'emotionalStory', iconStyle: 'health', size: '1536x864' };
  }

  if (isTech) {
    return { promptStyle: 'social', textMode: 'authority', iconStyle: 'techAi', size: '1536x864' };
  }

  if (isGaming) {
    return { promptStyle: 'social', textMode: 'shock', iconStyle: 'gaming', size: '1536x864' };
  }

  if (isFinance) {
    return { promptStyle: 'social', textMode: 'moneySuccess', iconStyle: 'finance', size: '1536x864' };
  }

  if (isHealth) {
    return { promptStyle: 'premium', textMode: 'transformation', iconStyle: 'health', size: '1536x864' };
  }

  if (isTravel) {
    return { promptStyle: 'cinematic', textMode: 'happyPositive', iconStyle: 'travel', size: '1536x864' };
  }

  if (isFood) {
    return { promptStyle: 'premium', textMode: 'happyPositive', iconStyle: 'food', size: '1536x864' };
  }

  if (isBeforeAfter) {
    return { promptStyle: 'social', textMode: 'transformation', iconStyle: 'beforeAfter', size: '1536x864' };
  }

  if (isMystery) {
    return { promptStyle: 'cinematic', textMode: 'mysteryReveal', iconStyle: 'mystery', size: '1536x864' };
  }

  if (isSuccess) {
    return { promptStyle: 'premium', textMode: 'moneySuccess', iconStyle: 'success', size: '1536x864' };
  }

  if (isSocial) {
    return {
      promptStyle: 'social',
      textMode: 'normal',
      iconStyle: 'none',
      size: '1536x864'
    };
  }

  if (isCinematic) {
    return {
      promptStyle: 'cinematic',
      textMode: 'normal',
      iconStyle: 'none',
      size: '1536x864'
    };
  }

  return {
    promptStyle: 'premium',
    textMode: 'normal',
    iconStyle: 'none',
    size: 'auto'
  };
};

const applyDetectedPromptSettings = () => {
  const detected = getDetectedPromptSettings(promptInput.value);
  const policy = getGemTextPolicy(promptInput.value, gemPresetSelect?.value || 'general');
  const textModeSelect = document.querySelector('#textMode');
  const textLanguageSelect = document.querySelector('#textLanguage');
  document.querySelector('#promptStyle').value = 'autoDetect';
  document.querySelector('#size').value = detected.size;
  if (textLanguageSelect?.value !== 'none' && textModeSelect?.value !== 'noText') {
    textModeSelect.value = policy.textMode || detected.textMode;
  }
  if (textLanguageSelect?.value === 'auto' && policy.textLanguage !== 'auto') {
    textLanguageSelect.value = policy.textLanguage;
  }
  document.querySelector('#iconStyle').value = detected.iconStyle;
  statusText.textContent = `Đã nhận diện: ${detected.promptStyle} | ${policy.reason}`;
  updateCommand();
};

const enhancePrompt = (prompt, style) => {
  const presets = {
    mexicoThumbnail: '16:9 viral Mexican entertainment thumbnail, keep every quoted Spanish headline/subtitle exactly as written, text must be very large, bold, readable and visually dominant, designed for Mexico audience, strong CTR composition, clean premium white background, red black yellow headline accents, gossip portal style, dramatic emotion, clear main subject, high contrast, professional website featured image, no tiny text, no clutter',
    premium: 'high-end visual, eye-catching composition, premium lighting, rich color contrast, sharp focus, detailed texture, professional photography, clean background, polished final image',
    cinematic: 'cinematic lighting, dramatic composition, depth of field, film still, high dynamic range, atmospheric details, ultra sharp, professional color grading',
    product: 'premium product photography, studio lighting, crisp edges, clean composition, realistic material, commercial advertising quality, high detail',
    social: 'viral social media visual, bold composition, vibrant colors, clear subject, scroll-stopping image, polished modern style, high clarity'
  };

  if (!presets[style]) {
    return prompt;
  }

  return `${prompt}, ${presets[style]}`;
};

const extractQuotedTexts = (prompt) => [
  ...Array.from(prompt.matchAll(/\u201c([^\u201d]{4,80})\u201d/g)),
  ...Array.from(prompt.matchAll(/"([^"]{4,80})"/g)),
  ...Array.from(prompt.matchAll(/'([^']{4,80})'/g))
]
  .map((match) => match[1].trim())
  .filter(Boolean);

const applyVisualRequirements = (prompt, config) => {
  const quotedTexts = extractQuotedTexts(prompt);
  const logoRule = config.logoDataUrl && config.logoPosition !== 'none'
    ? 'IMPORTANT LOGO RULE: do not generate, redraw, imitate, invent, distort, or replace any logo. Leave a clean corner/negative-space area for the original logo file; the app will overlay the real logo after generation.'
    : '';
  const languageRules = {
    auto: 'Use the same language as the user prompt for any visible text.',
    vi: 'All visible on-image text must be Vietnamese only. Do not use English or Spanish words unless they are quoted by the user.',
    en: 'All visible on-image text must be English only. Do not use Vietnamese or Spanish words unless they are quoted by the user.',
    es: 'All visible on-image text must be Spanish only. Do not use Vietnamese or English words unless they are quoted by the user.',
    none: 'Do not render any visible text, letters, captions, words, numbers, logos, watermarks, or readable UI text on the image.'
  };
  const textRules = {
    noText: 'NO TEXT MODE: create a strong thumbnail using only subject, expression, lighting, composition, icons/shapes, arrows, and color contrast. Do not render readable text.',
    required: 'MANDATORY: include one large readable headline on the image, text must occupy 25-35% of the frame, use bold uppercase typography, high contrast, no missing text.',
    strict: 'STRICT TEXT REQUIREMENT: render all quoted headline/subtitle text exactly on the image, very large readable letters, no typos, no tiny text, no cropped words, headline must be the main visual hook.',
    normal: 'Follow the text instructions from the prompt.',
    curiosity: 'CURIOSITY HOOK: create a short mysterious headline that makes viewers want to click, use incomplete-reveal framing, strong contrast, and a clear visual question without misleading the viewer.',
    shock: 'SHOCK EMOTION: use bold urgent headline text, surprised facial expression or dramatic reveal, high contrast red/yellow accents, and a strong focal point for maximum thumbnail impact.',
    fearUrgency: 'URGENCY EMOTION: create tension and fear-of-missing-out, use warning color accents, countdown/alert mood, and concise high-contrast text.',
    authority: 'AUTHORITY STYLE: use expert/review tone, clean trustworthy headline, badge-like proof cues, crisp professional layout, and confident subject framing.',
    luxury: 'LUXURY STYLE: use premium refined typography, elegant spacing, polished lighting, minimal but high-value headline treatment, and clean commercial composition.',
    happyPositive: 'POSITIVE EMOTION: use bright inviting energy, optimistic expression, warm colors, friendly headline, and clean approachable composition.',
    emotionalStory: 'STORY EMOTION: emphasize human emotion, empathy, touching moment, cinematic close-up, and a headline that feels personal and story-driven.',
    controversy: 'CONTROVERSY STYLE: use face-off composition, strong contrast, split tension, opposing sides, and bold headline that signals conflict without visual clutter.',
    transformation: 'TRANSFORMATION STYLE: show clear before/after or progress effect, visible improvement, split layout or arrow flow, and concise result-focused headline.',
    moneySuccess: 'SUCCESS/MONEY STYLE: use upward motion, winning emotion, green/gold accents, proof/result framing, and headline focused on gain or achievement.',
    tutorialClear: 'TUTORIAL STYLE: make the image easy to understand immediately, use step label, arrow to the key element, clean instructional headline, and uncluttered layout.',
    mysteryReveal: 'MYSTERY REVEAL: use suspense lighting, hidden/revealed object cue, question-mark or magnifier mood, and headline that suggests a secret being uncovered.',
    cleanWebsite: 'CLEAN WEBSITE STYLE: use professional editorial thumbnail layout, readable but restrained headline, white space, clean hierarchy, and no excessive clickbait elements.'
  };
  const iconRules = {
    mexicoGossip: 'Add 1-2 small but visible entertainment gossip icons/badges such as ALERTA, EXCLUSIVA, breaking-news tag, red arrow, glow burst, or reaction badge, without covering the face.',
    alert: 'Add a strong red alert badge, warning burst, arrow, and drama marker to increase click-through rate.',
    royal: 'Add subtle crown/light halo or premium queen-energy badge while keeping the design clean.',
    breakingNews: 'Add breaking news visual markers: red BREAKING tag, live-dot badge, urgent lower-third strip, and one directional arrow without clutter.',
    youtubeViral: 'Add YouTube-style viral thumbnail elements: red arrow, shocked reaction badge, bold outline sticker, glow burst, and high-CTR visual hook.',
    reviewRating: 'Add review/rating elements: star rating badge, TOP PICK or BEST/WORST tag, checkmark/cross marker, and comparison badge where relevant.',
    tutorialGuide: 'Add tutorial elements: step badge, HOW TO label, cursor/click marker, checklist icon, and clean arrow pointing to the key action.',
    productSale: 'Add product commerce elements: SALE tag, discount burst, price-label space, premium check badge, and clean product highlight glow.',
    techAi: 'Add tech/AI elements: chip icon, AI badge, circuit glow, blue neon label, cursor or app-window marker, kept subtle and modern.',
    gaming: 'Add gaming elements: level-up badge, VS tag, controller/crosshair marker, neon energy burst, and esports-style highlight accents.',
    finance: 'Add finance elements: upward chart arrow, coin/cash badge, profit/loss marker, green/red market tag, professional but high-contrast.',
    health: 'Add health/beauty elements: clean check badge, heart/leaf/glow marker, before-after cue if relevant, fresh premium wellness accents.',
    travel: 'Add travel/explore elements: map pin badge, route line, discovery tag, compass marker, bright destination highlight.',
    food: 'Add food elements: tasty badge, flame/hot label, star rating, fork/spoon marker, and appetizing highlight accents.',
    beforeAfter: 'Add before/after elements: split-screen divider, BEFORE and AFTER labels, transformation arrow, checkmark on improved result.',
    mystery: 'Add mystery/exploration elements: question mark badge, secret/reveal tag, magnifier marker, dark accent glow, and suspense arrow.',
    success: 'Add success/motivation elements: trophy/medal badge, upward arrow, winning label, premium gold highlight, and achievement marker.',
    none: 'Do not add extra icons or badges unless already requested.'
  };
  const wantsNoText = config.textMode === 'noText' || config.textLanguage === 'none';
  const headlineInstruction = wantsNoText
    ? 'Do not place any headline or readable text on the image.'
    : (quotedTexts.length > 0
      ? `Required visible on-image text: ${quotedTexts.map((text) => `"${text}"`).join(' + ')}.`
      : 'Create one short headline from the prompt and render it large on the image.');

  return [
    prompt,
    logoRule,
    headlineInstruction,
    languageRules[config.textLanguage] || languageRules.auto,
    textRules[config.textMode] || textRules.required,
    wantsNoText ? iconRules.none : (iconRules[config.iconStyle] || iconRules.none),
    wantsNoText
      ? 'Use 16:9 website thumbnail composition, subject face clear, strong focal point, high CTR, final image must be textless.'
      : 'Use 16:9 website thumbnail composition, subject face clear, text placed in clean whitespace, high CTR, final image must use the selected text language.'
  ].join(', ');
};

const simplifyPromptForRetry = (prompt, attempt, config = {}) => {
  const cleanPrompt = normalizeTitleText(prompt);
  const quotedTexts = extractQuotedTexts(cleanPrompt);
  const wantsNoText = config.textMode === 'noText' || config.textLanguage === 'none';
  const visibleText = !wantsNoText && quotedTexts[0] ? ` Include this readable headline: "${quotedTexts[0]}".` : '';
  const languageInstruction = {
    vi: 'Visible text language: Vietnamese only.',
    en: 'Visible text language: English only.',
    es: 'Visible text language: Spanish only.',
    auto: 'Visible text language: same as the user prompt.',
    none: 'No visible text, letters, numbers, captions, logos, or watermarks.'
  }[config.textLanguage || 'auto'];
  const noTextInstruction = 'No visible text, letters, numbers, captions, logos, or watermarks. Use visual storytelling only.';

  if (attempt === 2) {
    return [
      cleanPrompt,
      wantsNoText ? noTextInstruction : languageInstruction,
      wantsNoText
        ? 'Simplify the scene if needed. Use a clean 16:9 composition with one clear main subject, strong contrast, no clutter.'
        : 'Simplify the scene if needed. Use a clean 16:9 composition with one clear main subject, white background, high contrast, readable text, no clutter.'
    ].join(', ');
  }

  if (attempt === 3) {
    return [
      cleanPrompt,
      visibleText,
      wantsNoText ? noTextInstruction : languageInstruction,
      wantsNoText
        ? 'Agent auto-optimized fallback: remove any ambiguous or risky details, keep the core idea, use one main subject, one clear background, safe editorial thumbnail style, no copyrighted logos, no real-person defamatory implication.'
        : 'Agent auto-optimized fallback: remove any ambiguous or risky details, keep the core idea, use one main subject, one clear background, large readable headline, safe editorial thumbnail style, no copyrighted logos, no real-person defamatory implication.'
    ].join(' ');
  }

  if (attempt === 4) {
    return [
      cleanPrompt,
      visibleText,
      wantsNoText ? noTextInstruction : languageInstruction,
      'Create a simple safe commercial thumbnail. If any detail conflicts with policy or rendering quality, replace it with a generic visual equivalent while preserving the topic.'
    ].join(' ');
  }

  return [
    cleanPrompt
      .replace(/\b(ultra|extreme|shocking|scandal|controversy|chaos|breaking|viral|clickbait)\b/gi, 'dramatic')
      .replace(/\s+/g, ' ')
      .trim(),
    visibleText,
    wantsNoText ? noTextInstruction : languageInstruction,
    wantsNoText
      ? 'Create a safe 16:9 website thumbnail. Use realistic people-like subjects without implying real defamatory claims. Clean background, strong visual hook, professional composition, no text.'
      : 'Create a safe 16:9 website thumbnail. Use realistic people-like subjects without implying real defamatory claims. Clean background, bold readable headline area, professional composition.'
  ].join(' ');
};

const buildPromptForAttempt = (prompt, config, attempt) => {
  if (attempt === 1) {
    return applyVisualRequirements(enhancePrompt(prompt, config.promptStyle), config);
  }

  return simplifyPromptForRetry(prompt, attempt, config);
};

const createPayload = (config) => {
  const payload = {
    model: config.model,
    prompt: config.prompt,
    n: 1,
    size: normalizeImageSizeForRequest(config.size),
    quality: config.quality,
    background: config.background,
    image_detail: config.imageDetail,
    output_format: config.outputFormat
  };

  if (config.refImageUrl) {
    payload.image = config.refImageUrl;
  }

  return payload;
};

const normalizeEndpointForRequest = (value) => {
  const endpointValue = String(value || '').trim();
  const localBase = 'http://localhost:20128';

  if (!endpointValue) {
    return `${localBase}/v1/images/generations`;
  }

  if (endpointValue.startsWith(localBase) && !/\/v1\/images\/generations\/?$/.test(endpointValue)) {
    return `${localBase}/v1/images/generations`;
  }

  if (/\/v1\/?$/.test(endpointValue)) {
    return `${endpointValue.replace(/\/$/, '')}/images/generations`;
  }

  return endpointValue;
};

const normalizeImageSizeForRequest = (value) => {
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

  if (safeCommonSizes[`${width}x${height}`]) {
    return safeCommonSizes[`${width}x${height}`];
  }

  if (width % 16 === 0 && height % 16 === 0) {
    return `${width}x${height}`;
  }

  return `${Math.max(16, width - (width % 16))}x${Math.max(16, height - (height % 16))}`;
};

const shellQuote = (value) => `'${String(value).replace(/'/g, "'\\''")}'`;

const maskKey = (apiKey) => `${apiKey.slice(0, 7)}...${apiKey.slice(-6)}`;

const isConnectionHidden = () => connectionSection?.classList.contains('connection-hidden');

const applyConnectionVisibility = (hidden) => {
  connectionSection?.classList.toggle('connection-hidden', hidden);
  toggleConnectionVisibilityButton?.setAttribute('aria-pressed', hidden ? 'true' : 'false');
  toggleConnectionVisibilityButton?.setAttribute('title', hidden ? 'Hiện thông tin kết nối' : 'Ẩn thông tin kết nối');
  localStorage.setItem('hideConnectionSection', hidden ? '1' : '0');
  updateCommand();
};

const updateCommand = () => {
  if (isConnectionHidden()) {
    commandOutput.value = 'Thông tin kết nối đang được ẩn để tránh lộ khi quay video.';
    return;
  }

  const config = getFormConfig();
  const payload = createPayload(config);
  const commandPayload = {
    ...payload,
    ...(payload.image?.startsWith('data:') ? { image: '[uploaded GEM image]' } : {})
  };
  const commandLines = [
    `curl -X POST ${shellQuote(config.endpoint)} \\`,
    '  -H "Content-Type: application/json" \\',
    '  -H "Accept: text/event-stream" \\',
    `  -d ${shellQuote(JSON.stringify(commandPayload))}`
  ];

  if (config.apiKey) {
    commandLines.splice(2, 0, `  -H "Authorization: Bearer ${maskKey(config.apiKey)}" \\`);
  }

  commandOutput.value = commandLines.join('\n');
};

const getBatchList = () => {
  const lines = batchPrompts.value.replace(/\r\n/g, '\n').split('\n');
  const items = [];
  let current = null;
  let isReadingPrompt = false;
  const looseLines = [];
  const hasStructuredMarker = lines.some((line) => /^\s*\d+[).]\s*.+?\s*$/.test(line) || /^\s*Prompt\s*[:：]/i.test(line) || /^\s*Prompt\s*[:ï¼š]/i.test(line));

  if (!hasStructuredMarker) {
    return [];
  }

  const pushCurrent = () => {
    if (!current) {
      return;
    }

    const sourceLines = (current.sawPrompt || current.promptLines.length > 0) ? current.promptLines : current.bodyLines;
    const prompt = sourceLines.join('\n').trim();
    if (prompt) {
      items.push({
        title: current.title,
        prompt
      });
    }
  };

  lines.forEach((line) => {
    const headingMatch = line.match(/^\s*(\d+)[).]\s*(.+?)\s*$/);

    if (headingMatch) {
      pushCurrent();
      current = {
        title: `${headingMatch[1]}) ${headingMatch[2].trim()}`,
        promptLines: [],
        bodyLines: [],
        sawPrompt: false
      };
      isReadingPrompt = false;
      return;
    }

    if (!current) {
      if (line.trim()) {
        looseLines.push(line.trim());
      }
      return;
    }

    if (/^\s*Prompt\s*[:：]\s*$/i.test(line)) {
      isReadingPrompt = true;
      return;
    }

    const promptMatch = line.match(/^\s*Prompt\s*[:：]\s*(.*)$/i) || line.match(/^\s*Prompt\s*[:ï¼š]\s*(.*)$/i);
    if (promptMatch) {
      current.sawPrompt = true;
      isReadingPrompt = true;
      if (promptMatch[1].trim()) {
        current.promptLines.push(promptMatch[1].trim());
      }
      return;
    }

    if (isReadingPrompt) {
      current.promptLines.push(line);
    } else {
      current.bodyLines.push(line);
    }
  });

  pushCurrent();
  return [
    ...looseLines.map((prompt, index) => ({
      title: `Prompt ${index + 1}`,
      prompt
    })),
    ...items
  ];
};

const createMexicoFileTitle = (item) => {
  const quotedTexts = extractQuotedTexts(item.prompt);

  if (quotedTexts.length > 0) {
    return quotedTexts.slice(0, 2).join(' - ');
  }

  return item.title
    .replace(/^\d+[).]\s*/g, '')
    .replace(/\bHƯỚNG\b/gi, '')
    .replace(/\bHUONG\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim() || `Imagen Mexico ${item.index || ''}`.trim();
};

const getBatchItems = () => {
  const structuredItems = getBatchList();
  if (structuredItems.length > 0) {
    return structuredItems;
  }

  const typedBatchItems = batchPrompts.value
    .split(/\r?\n/)
    .map((line, index) => ({
      title: `Prompt ${index + 1}`,
      prompt: line.trim()
    }))
    .filter((item) => item.prompt);

  if (typedBatchItems.length > 0) {
    return typedBatchItems;
  }

  const currentPrompt = promptInput.value.trim() || gemPromptOutput.value.trim();
  return currentPrompt
    ? [{
      title: articleTitleInput.value.trim() || 'Prompt hiện tại',
      prompt: currentPrompt
    }]
    : [];
};

const getArticleTitle = (batchItems) => {
  const typedTitle = articleTitleInput.value.trim();
  if (typedTitle) {
    return typedTitle;
  }

  const firstPromptTitle = createTitleFromPrompt(batchItems[0]?.prompt);
  if (firstPromptTitle) {
    return firstPromptTitle;
  }

  const firstTitle = batchItems[0]?.title || '';
  const cleanTitle = firstTitle
    .replace(/^\d+[).]\s*/g, '')
    .replace(/\bHƯỚNG\b/gi, '')
    .replace(/\bHUONG\b/gi, '')
    .trim();

  return cleanTitle || 'Bai Mexico';
};

const updateBatchCount = () => {
  batchCount.textContent = `${getBatchItems().length} câu lệnh`;
};

const generateBatchImageWithRetry = async ({ baseConfig, prompt, fileTitle, index, total }) => {
  let lastError = null;
  const maxAttempts = 6;
  const detectedSettings = getDetectedPromptSettings(prompt);
  const batchConfig = baseConfig.promptStyle === 'autoDetect'
    ? {
      ...baseConfig,
      promptStyle: detectedSettings.promptStyle,
      textMode: baseConfig.textLanguage === 'none' ? 'noText' : detectedSettings.textMode,
      iconStyle: detectedSettings.iconStyle,
      size: detectedSettings.size
    }
    : baseConfig;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      activeRequestId = crypto.randomUUID();
      if (attempt > 1) {
        batchStatus.textContent = `Tự sửa prompt và thử lại ${index + 1}/${total} lần ${attempt}`;
      }
      const promptForAttempt = buildPromptForAttempt(prompt, batchConfig, attempt);

      return await window.toolApi.generateImage({
        ...batchConfig,
        prompt: promptForAttempt,
        fileTitle,
        index,
        isBatch: true,
        requestId: activeRequestId
      });
    } catch (error) {
      lastError = error;
      if (!shouldRetryGenerationError(error)) {
        throw error;
      }
      if (stopBatchRequested || error.message.includes('Đã dừng')) {
        throw error;
      }

      if (attempt < maxAttempts) {
        await wait(1000 + (attempt * 500));
      }
    } finally {
      activeRequestId = null;
    }
  }

  throw lastError;
};

const generateSingleImageWithRetry = async (config) => {
  let lastError = null;
  const maxAttempts = 6;
  const retryConfig = {
    ...config,
    promptStyle: config.promptStyle === 'autoDetect' ? config.effectivePromptStyle : config.promptStyle
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      activeRequestId = crypto.randomUUID();
      if (attempt > 1) {
        setStatus(`Tu dong toi uu prompt va thu lai lan ${attempt}/${maxAttempts}...`);
      }

      return await window.toolApi.generateImage({
        ...retryConfig,
        prompt: buildPromptForAttempt(config.fileTitle || config.prompt, retryConfig, attempt),
        requestId: activeRequestId
      });
    } catch (error) {
      lastError = error;
      if (stopBatchRequested || error.message.includes('ÄÃ£ dá»«ng')) {
        throw error;
      }

      if (attempt < maxAttempts) {
        await wait(1000 + (attempt * 500));
      }
    } finally {
      activeRequestId = null;
    }
  }

  throw lastError;
};

const applyLogoToResult = async ({ result, config, index = 0, isBatch = false }) => {
  if (!config.logoDataUrl || config.logoPosition === 'none') {
    return result;
  }

  const imageUrl = await composeLogoOnImage({
    imageUrl: result.imageUrl,
    logoUrl: config.logoDataUrl,
    position: config.logoPosition,
    logoSize: config.logoSize,
    outputFormat: config.outputFormat
  });
  const savedPath = await window.toolApi.saveImageDataUrl({
    dataUrl: imageUrl,
    prompt: config.fileTitle || config.prompt,
    index,
    outputFormat: config.outputFormat,
    outputDir: config.outputDir,
    isBatch,
    articleTitle: config.articleTitle
  });

  return {
    ...result,
    imageUrl,
    savedPath,
    originalSavedPath: result.savedPath,
    logoApplied: true
  };
};

const setLoading = (isLoading) => {
  isRendering = isLoading;
  renderButton.type = isLoading ? 'button' : 'submit';
  renderButton.classList.toggle('danger-button', isLoading);
  renderButton.textContent = isLoading ? 'Đang tạo…' : 'Tạo ảnh';
  stopEnabledAt = isLoading ? Date.now() + 1200 : 0;

  if (isLoading) {
    setTimeout(() => {
      if (isRendering) {
        renderButton.textContent = 'Dừng';
      }
    }, 1200);
  }
};

const setBatchLoading = (isLoading) => {
  isBatchRunning = isLoading;
  runBatchButton.dataset.running = isLoading ? 'true' : 'false';
  runBatchButton.classList.toggle('danger-button', isLoading);
  runBatchButton.textContent = isLoading ? 'Dừng hàng loạt' : 'Tạo hàng loạt';
  renderButton.disabled = isLoading;
};

const setMemberStatus = (message) => {
  memberPanelStatus.textContent = message;
};

const formatMemberDate = (value) => value ? new Date(value).toLocaleDateString('vi-VN') : '-';

const formatVnd = (value) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0
}).format(Number(value || 0));

const addDays = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const getDaysLeft = (value) => {
  if (!value) {
    return null;
  }

  return Math.ceil((new Date(value).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
};

const applyMemberPlanPreset = () => {
  const preset = getMemberPlanPreset(memberPlanSelect.value);
  memberPriceInput.value = preset.priceLabel;
  memberQuotaInput.value = preset.quota;
  memberExpiresAtInput.value = addDays(preset.days);
  memberDeviceLimitInput.value = preset.devices;
};

const memberActionButton = (label, onClick) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'secondary-button compact member-action-button';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
};

const memberEditInput = (name, value, type = 'text', attrs = {}) => {
  const input = document.createElement('input');
  input.name = name;
  input.type = type;
  input.value = value ?? '';
  Object.entries(attrs).forEach(([key, attrValue]) => input.setAttribute(key, attrValue));
  return input;
};

const memberEditSelect = (name, value, options) => {
  const select = document.createElement('select');
  select.name = name;
  options.forEach(([optionValue, label]) => {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = label;
    select.append(option);
  });
  select.value = value;
  return select;
};

const renderMemberEditRow = (user) => {
  const tr = document.createElement('tr');
  tr.className = 'member-edit-row';

  const emailCell = document.createElement('td');
  emailCell.append(memberEditInput('email', user.email, 'email', { required: 'required' }));

  const planCell = document.createElement('td');
  const planFields = document.createElement('div');
  planFields.className = 'member-edit-fields';
  const planSelect = memberEditSelect('planId', getMemberPlanId(user), [
    ['trial', 'Dùng thử - 0đ'],
    ['monthly', 'Gói tháng - 99.000đ'],
    ['vip', 'VIP - 199.000đ']
  ]);
  const priceInput = memberEditInput('monthlyPrice', Number(user.monthlyPrice || 0), 'number', { min: '0' });
  planSelect.addEventListener('change', () => {
    const preset = getMemberPlanPreset(planSelect.value);
    priceInput.value = preset.price;
  });
  planFields.append(
    planSelect,
    priceInput,
    memberEditSelect('paymentStatus', user.paymentStatus || getMemberPlanPreset(getMemberPlanId(user)).paymentStatus, [
      ['trial', 'Dùng thử'],
      ['paid', 'Đã thanh toán'],
      ['unpaid', 'Chưa thanh toán']
    ])
  );
  planCell.append(planFields);

  const statusCell = document.createElement('td');
  statusCell.append(memberEditSelect('status', user.status || 'active', [
    ['active', 'Active'],
    ['blocked', 'Blocked']
  ]));

  const quotaCell = document.createElement('td');
  const quotaFields = document.createElement('div');
  quotaFields.className = 'member-edit-fields two';
  quotaFields.append(
    memberEditInput('quotaUsed', Number(user.quotaUsed || 0), 'number', { min: '0' }),
    memberEditInput('quotaTotal', Number(user.quotaTotal || 0), 'number', { min: '0' })
  );
  quotaCell.append(quotaFields);

  const expiresCell = document.createElement('td');
  expiresCell.append(memberEditInput('expiresAt', user.expiresAt || '', 'date'));

  const devicesCell = document.createElement('td');
  devicesCell.append(memberEditInput('deviceLimit', Number(user.deviceLimit || 1), 'number', { min: '1' }));

  const actionsCell = document.createElement('td');
  const actions = document.createElement('div');
  actions.className = 'member-actions';
  const passwordInput = memberEditInput('password', '', 'password', { placeholder: 'Mật khẩu mới' });
  passwordInput.className = 'member-password-edit';
  actions.append(
    passwordInput,
    memberActionButton('Lưu', () => saveMemberEdit(user.id, tr)),
    memberActionButton('Hủy', () => {
      editingMemberId = null;
      loadMemberDashboard();
    })
  );
  actionsCell.append(actions);

  tr.append(emailCell, planCell, statusCell, quotaCell, expiresCell, devicesCell, actionsCell);
  return tr;
};

const renderMemberDashboard = ({ stats, users }) => {
  memberStatRevenue.textContent = formatVnd(stats.estimatedMonthlyRevenue);
  memberStatUsers.textContent = stats.users;
  memberStatActive.textContent = stats.activeUsers;
  memberStatExpiring.textContent = stats.expiringSoonUsers;
  memberStatExpired.textContent = stats.expiredUsers;
  memberStatImages.textContent = stats.imagesCreated;
  memberStatFailures.textContent = stats.failures;
  memberTableBody.replaceChildren(...users.map((user) => {
    if (editingMemberId === user.id) {
      return renderMemberEditRow(user);
    }

    const tr = document.createElement('tr');
    const remaining = Math.max(0, Number(user.quotaTotal || 0) - Number(user.quotaUsed || 0));

    const email = document.createElement('td');
    email.textContent = user.email;

    const plan = document.createElement('td');
    const planName = document.createElement('strong');
    const planPrice = document.createElement('span');
    plan.className = 'member-plan-cell';
    planName.textContent = user.planName || 'Gói tháng';
    planPrice.textContent = formatVnd(user.monthlyPrice ?? getMemberPlanPreset(getMemberPlanId(user)).price);
    plan.append(planName, planPrice);

    const statusCell = document.createElement('td');
    const status = document.createElement('span');
    status.className = `member-pill ${user.status === 'active' ? '' : 'blocked'}`;
    status.textContent = user.status;
    statusCell.append(status);

    const quota = document.createElement('td');
    quota.textContent = `${user.quotaUsed}/${user.quotaTotal} còn ${remaining}`;

    const expiresAt = document.createElement('td');
    const daysLeft = getDaysLeft(user.expiresAt);
    expiresAt.textContent = daysLeft === null
      ? '-'
      : `${formatMemberDate(user.expiresAt)} (${daysLeft < 0 ? 'hết hạn' : `còn ${daysLeft} ngày`})`;
    expiresAt.className = daysLeft !== null && daysLeft <= 7 ? 'member-warning' : '';

    const devices = document.createElement('td');
    devices.textContent = `${(user.devices || []).length}/${user.deviceLimit}`;

    const actions = document.createElement('td');
    const actionWrap = document.createElement('div');
    actionWrap.className = 'member-actions';
    actionWrap.append(
      memberActionButton('Sửa', () => {
        editingMemberId = user.id;
        renderMemberDashboard({ stats, users });
      }),
      memberActionButton(user.status === 'active' ? 'Khóa' : 'Mở', () => updateMember(user.id, { status: user.status === 'active' ? 'blocked' : 'active' })),
      memberActionButton('Reset quota', () => updateMember(user.id, { quotaUsed: 0 })),
      memberActionButton('Gia hạn', () => updateMember(user.id, { expiresAt: addDays(30), monthlyPrice: user.monthlyPrice ?? getMemberPlanPreset(getMemberPlanId(user)).price })),
      memberActionButton('Xóa thiết bị', () => updateMember(user.id, { clearDevices: true }))
    );
    actions.append(actionWrap);

    tr.append(email, plan, statusCell, quota, expiresAt, devices, actions);
    return tr;
  }));
};

const loadMemberDashboard = async () => {
  setMemberStatus('Đang cập nhật...');
  try {
    const dashboard = await window.toolApi.getAdminDashboard();
    renderMemberDashboard(dashboard);
    setMemberStatus(dashboard.storage?.mode === 'cloud'
      ? `Dữ liệu khách hàng CLOUD: ${dashboard.storage.apiBaseUrl}`
      : dashboard.storage?.dbFile
      ? `Dữ liệu khách hàng đang lưu tại: ${dashboard.storage.dbFile} | Backup: ${dashboard.storage.backupDir}`
      : 'Đã cập nhật');
  } catch (error) {
    setMemberStatus(error.message || 'Không tải được bảng thành viên');
  }
};

const openMemberPanel = async () => {
  if (appConfig?.app?.flavor !== 'admin') {
    setLoginStatus('Bản user không có quyền quản lý thành viên.', 'error');
    return;
  }

  memberPanelOverlay.classList.remove('hidden');
  await loadMemberDashboard();
};

const closeMemberPanel = () => {
  memberPanelOverlay.classList.add('hidden');
};

const updateMember = async (id, changes) => {
  setMemberStatus('Đang lưu...');
  try {
    const result = await window.toolApi.updateMemberUser({ id, changes });
    renderMemberDashboard(result.dashboard);
    setMemberStatus(result.dashboard.storage?.mode === 'cloud'
      ? `Đã lưu trên CLOUD: ${result.dashboard.storage.apiBaseUrl}`
      : result.dashboard.storage?.dbFile
      ? `Đã lưu. Database: ${result.dashboard.storage.dbFile}`
      : 'Đã lưu');
  } catch (error) {
    setMemberStatus(error.message || 'Không lưu được thay đổi');
  }
};

const saveMemberEdit = async (id, row) => {
  const formData = new FormData();
  row.querySelectorAll('input, select').forEach((field) => formData.set(field.name, field.value));
  const planId = String(formData.get('planId') || 'monthly');
  const preset = getMemberPlanPreset(planId);
  const changes = {
    email: String(formData.get('email') || '').trim(),
    planName: preset.label,
    monthlyPrice: Number(formData.get('monthlyPrice') || preset.price),
    paymentStatus: String(formData.get('paymentStatus') || preset.paymentStatus),
    status: String(formData.get('status') || 'active'),
    quotaUsed: Number(formData.get('quotaUsed') || 0),
    quotaTotal: Number(formData.get('quotaTotal') || 0),
    expiresAt: String(formData.get('expiresAt') || '') || null,
    deviceLimit: Number(formData.get('deviceLimit') || 1)
  };
  const password = String(formData.get('password') || '');
  if (password) {
    changes.password = password;
  }

  editingMemberId = null;
  await updateMember(id, changes);
};

clearPromptButton.addEventListener('click', () => {
  promptInput.value = '';
  syncArticleTitleFromPrompt();
  promptInput.focus();
  updateCommand();
});

detectPromptButton.addEventListener('click', applyDetectedPromptSettings);

gemPresetSelect?.addEventListener('change', () => {
  syncGemInstruction();
  if (promptInput.value.trim() || gemPromptOutput.value.trim()) {
    analyzeGemPrompt();
  }
});

gemReferenceModeSelect?.addEventListener('change', () => {
  if (promptInput.value.trim() || gemPromptOutput.value.trim()) {
    analyzeGemPrompt();
  }
});

gemSimilarityInput?.addEventListener('input', () => {
  gemSimilarityValue.textContent = `${gemSimilarityInput.value}%`;
});

gemSimilarityInput?.addEventListener('change', () => {
  if (promptInput.value.trim() || gemPromptOutput.value.trim()) {
    analyzeGemPrompt();
  }
});

gemImageFileInput?.addEventListener('change', async () => {
  const [file] = gemImageFileInput.files || [];
  if (!file) {
    return;
  }
  if (gemFileName) {
    gemFileName.textContent = file.name;
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  document.querySelector('#refImageUrl').value = dataUrl;
  statusText.textContent = 'Đã nạp ảnh mẫu GEM';
  analyzeGemPrompt();
  updateCommand();
});

logoFileInput?.addEventListener('change', async () => {
  const [file] = logoFileInput.files || [];
  if (!file) {
    logoDataUrl = '';
    if (logoFileName) {
      logoFileName.textContent = 'Không dùng logo';
    }
    updateCommand();
    return;
  }

  logoDataUrl = await readFileAsDataUrl(file);
  if (logoFileName) {
    logoFileName.textContent = file.name;
  }
  statusText.textContent = 'Đã nạp logo gốc. Logo sẽ được ghép sau khi tạo ảnh.';
  updateCommand();
});

analyzeGemButton?.addEventListener('click', () => {
  analyzeGemPrompt();
});

applyGemPromptButton?.addEventListener('click', () => {
  const prompt = gemPromptOutput.value.trim() || analyzeGemPrompt();
  promptInput.value = prompt;
  isArticleTitleManual = false;
  syncArticleTitleFromPrompt();
  applyDetectedPromptSettings();
  updateCommand();
  promptInput.focus();
});

chooseOutputDirButton.addEventListener('click', async () => {
  const selectedDir = await window.toolApi.selectOutputDir();
  if (selectedDir) {
    outputDirInput.value = selectedDir;
    localStorage.setItem('outputDir', selectedDir);
    updateCommand();
  }
});

outputDirInput.addEventListener('change', () => {
  localStorage.setItem('outputDir', outputDirInput.value);
});

toggleApiKeyButton.addEventListener('click', () => {
  const isHidden = apiKeyInput.type === 'password';
  apiKeyInput.type = isHidden ? 'text' : 'password';
  toggleApiKeyButton.textContent = isHidden ? 'Ẩn' : 'Hiện';
});

toggleConnectionVisibilityButton?.addEventListener('click', () => {
  applyConnectionVisibility(!isConnectionHidden());
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginButton.disabled = true;
  setLoginStatus('Đang đăng nhập...');

  try {
    const session = await window.toolApi.login({
      email: loginEmailInput.value.trim(),
      password: loginPasswordInput.value,
      deviceId: getDeviceId()
    });
    localStorage.setItem('authToken', session.token);
    localStorage.setItem('authUserEmail', session.user?.email || loginEmailInput.value.trim());
    setAuthenticated(session);
    setLoginStatus('Đăng nhập thành công.', 'ok');
  } catch (error) {
    clearAuthSession();
    setLoginStatus(error.message || 'Đăng nhập thất bại.', 'error');
  } finally {
    loginButton.disabled = false;
  }
});

logoutButton.addEventListener('click', clearAuthSession);
logoutButton.hidden = true;

memberPanelButton.addEventListener('click', openMemberPanel);
memberPanelClose.addEventListener('click', closeMemberPanel);
memberPanelOverlay.addEventListener('click', (event) => {
  if (event.target === memberPanelOverlay) {
    closeMemberPanel();
  }
});
memberPlanSelect.addEventListener('change', applyMemberPlanPreset);

memberCreateForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMemberStatus('Đang thêm thành viên...');
  const preset = getMemberPlanPreset(memberPlanSelect.value);

  try {
    const result = await window.toolApi.createMemberUser({
      email: document.querySelector('#memberEmail').value.trim(),
      password: document.querySelector('#memberPassword').value,
      planName: preset.label,
      monthlyPrice: preset.price,
      paymentStatus: preset.paymentStatus,
      quotaTotal: Number(memberQuotaInput.value || 0),
      expiresAt: memberExpiresAtInput.value || null,
      deviceLimit: Number(memberDeviceLimitInput.value || 1)
    });
    memberCreateForm.reset();
    memberPlanSelect.value = 'monthly';
    applyMemberPlanPreset();
    renderMemberDashboard(result.dashboard);
    setMemberStatus(result.dashboard.storage?.mode === 'cloud'
      ? `Đã thêm thành viên trên CLOUD: ${result.dashboard.storage.apiBaseUrl}`
      : result.dashboard.storage?.dbFile
      ? `Đã thêm thành viên. Database: ${result.dashboard.storage.dbFile}`
      : 'Đã thêm thành viên');
  } catch (error) {
    setMemberStatus(error.message || 'Không thêm được thành viên');
  }
});

promptInput.addEventListener('input', () => {
  syncArticleTitleFromPrompt();
  if (document.querySelector('#promptStyle').value === 'autoDetect') {
    const detected = getDetectedPromptSettings(promptInput.value);
    const policy = getGemTextPolicy(promptInput.value, gemPresetSelect?.value || 'general');
    const textModeSelect = document.querySelector('#textMode');
    const textLanguageSelect = document.querySelector('#textLanguage');
    document.querySelector('#size').value = detected.size;
    if (textLanguageSelect?.value !== 'none' && textModeSelect?.value !== 'noText' && textModeSelect?.value !== 'autoText') {
      textModeSelect.value = policy.textMode || detected.textMode;
    }
    if (textLanguageSelect?.value === 'auto' && policy.textLanguage !== 'auto') {
      textLanguageSelect.value = policy.textLanguage;
    }
    document.querySelector('#iconStyle').value = detected.iconStyle;
  }
});

document.querySelector('#textLanguage')?.addEventListener('change', (event) => {
  if (event.target.value === 'none') {
    document.querySelector('#textMode').value = 'noText';
  }
  updateCommand();
});

document.querySelector('#textMode')?.addEventListener('change', (event) => {
  if (event.target.value === 'noText') {
    document.querySelector('#textLanguage').value = 'none';
  } else if (document.querySelector('#textLanguage')?.value === 'none') {
    document.querySelector('#textLanguage').value = 'auto';
  }
  updateCommand();
});

articleTitleInput.addEventListener('input', () => {
  isArticleTitleManual = articleTitleInput.value.trim().length > 0;
});

articleTitleInput.addEventListener('change', () => {
  if (!articleTitleInput.value.trim()) {
    isArticleTitleManual = false;
    syncArticleTitleFromPrompt();
  }
});

renderButton.addEventListener('click', async (event) => {
  if (!isRendering) {
    return;
  }

  event.preventDefault();
  if (Date.now() < stopEnabledAt) {
    setStatus('Đang bắt đầu tạo ảnh, vui lòng chờ…');
    return;
  }

  if (activeRequestId) {
    await window.toolApi.cancelImage(activeRequestId);
  }
  stopBatchRequested = true;
  setStatus('Đang dừng tạo ảnh…');
});

imageForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (isRendering) {
    return;
  }

  stopBatchRequested = false;
  setLoading(true);
  setStatus('Đang gửi yêu cầu tạo ảnh…');

  try {
    const config = getFormConfig();
    const startedAt = new Date();
    const rawResult = await generateSingleImageWithRetry(config);
    const result = await applyLogoToResult({ result: rawResult, config });

    previewImage.src = result.imageUrl;
    previewImage.classList.remove('hidden');
    clearPreviewGrid();
    addPreviewTile({
      imageUrl: result.imageUrl,
      title: config.articleTitle || createTitleFromPrompt(config.fileTitle || config.prompt),
      index: 1
    });
    downloadLink.href = result.imageUrl;
    downloadLink.download = `9router-image.${config.outputFormat}`;
    downloadLink.classList.remove('hidden');
    lastRunEl.textContent = startedAt.toLocaleString('vi-VN');
    outputLog.textContent = JSON.stringify({
      savedPath: result.savedPath,
      response: result.raw
    }, null, 2);
    await refreshCurrentUser();
    statusText.textContent = 'Hoàn tất';
  } catch (error) {
    statusText.textContent = 'Thất bại';
    outputLog.textContent = `Loi tao anh:\n${summarizeError(error)}`;
  } finally {
    activeRequestId = null;
    setLoading(false);
  }
});

imageForm.addEventListener('input', updateCommand);
imageForm.addEventListener('change', updateCommand);

copyCommandButton.addEventListener('click', async () => {
  await navigator.clipboard.writeText(commandOutput.value);
  copyCommandButton.textContent = 'Đã sao chép';
  setTimeout(() => {
    copyCommandButton.textContent = 'Sao chép';
  }, 1200);
});

promptFile.addEventListener('change', async () => {
  const [file] = promptFile.files;
  if (!file) {
    return;
  }

  const text = await file.text();
  if (file.name.endsWith('.json')) {
    const parsed = JSON.parse(text);
    batchPrompts.value = (Array.isArray(parsed) ? parsed : parsed.prompts || [])
      .map((item, index) => {
        if (typeof item === 'string') {
          return `${index + 1}) Prompt ${index + 1}\n\nPrompt:\n\n${item}`;
        }

        return `${index + 1}) ${item.title || `Prompt ${index + 1}`}\n\nPrompt:\n\n${item.prompt}`;
      })
      .filter(Boolean)
      .join('\n\n');
  } else {
    batchPrompts.value = text;
  }

  updateBatchCount();
});

batchPrompts.addEventListener('input', updateBatchCount);

runBatchButton.addEventListener('click', async () => {
  if (isBatchRunning) {
    stopBatchRequested = true;
    if (activeRequestId) {
      await window.toolApi.cancelImage(activeRequestId);
    }
    runBatchButton.textContent = 'Đang dừng…';
    batchStatus.textContent = 'Đang dừng';
    return;
  }

  const batchItems = getBatchItems();
  if (batchItems.length === 0) {
    batchStatus.textContent = 'Chưa có câu lệnh';
    return;
  }

  stopBatchRequested = false;
  setBatchLoading(true);
  clearPreviewGrid();
  outputLog.textContent = `Đã nhận ${batchItems.length} câu lệnh. Bắt đầu tạo hàng loạt...`;
  const baseConfig = {
    ...getFormConfig(),
    articleTitle: getArticleTitle(batchItems)
  };
  const results = [];
  const batchId = `${new Date().toISOString().replace(/[:.]/g, '-')}`;

  try {
    for (let index = 0; index < batchItems.length; index += 1) {
      if (stopBatchRequested) {
        break;
      }

      const item = batchItems[index];
      const prompt = item.prompt;
      const fileTitle = createMexicoFileTitle({ ...item, index: index + 1 });
      batchStatus.textContent = `Đang tạo ${index + 1}/${batchItems.length}`;
      renderBatchLog(results, batchItems.length, `Dang tao ${index + 1}/${batchItems.length}: ${compactPrompt(prompt, 220)}`);

      try {
        const rawResult = await generateBatchImageWithRetry({
          baseConfig,
          prompt,
          fileTitle,
          index,
          total: batchItems.length
        });
        const result = await applyLogoToResult({
          result: rawResult,
          config: {
            ...baseConfig,
            prompt,
            fileTitle
          },
          index,
          isBatch: true
        });

        results.push({
          index: index + 1,
          title: item.title,
          fileTitle,
          prompt,
          ok: true,
          savedPath: result.savedPath
        });

        previewImage.src = result.imageUrl;
        previewImage.classList.remove('hidden');
        addPreviewTile({
          imageUrl: result.imageUrl,
          title: fileTitle,
          index: index + 1
        });
        downloadLink.href = result.imageUrl;
        downloadLink.download = `9router-image-${index + 1}.${baseConfig.outputFormat}`;
        downloadLink.classList.remove('hidden');
      } catch (error) {
        results.push({
          index: index + 1,
          title: item.title,
          fileTitle,
          prompt,
          ok: false,
          error: summarizeError(error)
        });
        addPreviewErrorTile({
          title: fileTitle,
          index: index + 1,
          error: summarizeError(error)
        });
        batchStatus.textContent = `Lỗi ${index + 1}/${batchItems.length}, tiếp tục ảnh kế tiếp`;
      } finally {
        activeRequestId = null;
      }

      renderBatchLog(results, batchItems.length);
      if (!stopBatchRequested && index < batchItems.length - 1) {
        await wait(Number(batchDelay.value) || 0);
      }
    }
  } finally {
    const manifestPath = await window.toolApi.writeBatchManifest({
      outputDir: baseConfig.outputDir,
      articleTitle: baseConfig.articleTitle,
      manifest: {
        batchId,
        articleTitle: baseConfig.articleTitle,
        createdAt: new Date().toISOString(),
        total: batchItems.length,
        success: results.filter((item) => item.ok).length,
        failed: results.filter((item) => !item.ok).length,
        settings: {
          size: baseConfig.size,
          quality: baseConfig.quality,
          textMode: baseConfig.textMode,
          textLanguage: baseConfig.textLanguage,
          iconStyle: baseConfig.iconStyle,
          promptStyle: baseConfig.promptStyle,
          outputFormat: baseConfig.outputFormat
        },
        items: results
      }
    });
    lastRunEl.textContent = new Date().toLocaleString('vi-VN');
    const successCount = results.filter((item) => item.ok).length;
    const failedCount = results.filter((item) => !item.ok).length;
    batchStatus.textContent = `${stopBatchRequested ? 'Đã dừng' : 'Hoàn tất'}: ${successCount} thành công, ${failedCount} lỗi / ${batchItems.length}`;
    statusText.textContent = failedCount > 0 ? `Xong nhưng lỗi ${failedCount} ảnh` : (stopBatchRequested ? 'Đã dừng hàng loạt' : 'Hoàn tất hàng loạt');
    renderBatchLog(results, batchItems.length, `Manifest: ${manifestPath}`);
    await refreshCurrentUser();
    activeRequestId = null;
    setBatchLoading(false);
  }
});

const initializeApp = async () => {
  await setVersion();
  outputDirInput.value = localStorage.getItem('outputDir') || '';
  applyMemberPlanPreset();
  syncGemInstruction();
  syncArticleTitleFromPrompt();
  applyConnectionVisibility(localStorage.getItem('hideConnectionSection') === '1');
  document.querySelector('#quality').value = 'auto';
  updateCommand();
  updateBatchCount();
  await restoreAuthSession();
};

initializeApp().catch((error) => {
  setLoginStatus(error.message || 'Không khởi tạo được ứng dụng.', 'error');
  setAuthenticated(null);
});
