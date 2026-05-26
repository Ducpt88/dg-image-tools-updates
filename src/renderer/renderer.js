const appVersionEl = document.querySelector('#appVersion');
const authScreen = document.querySelector('#authScreen');
const loginForm = document.querySelector('#loginForm');
const loginEmailInput = document.querySelector('#loginEmail');
const loginPasswordInput = document.querySelector('#loginPassword');
const loginButton = document.querySelector('#loginButton');
const loginStatus = document.querySelector('#loginStatus');
const logoutButton = document.querySelector('#logoutButton');
const userIdentity = document.querySelector('#userIdentity');
const imageForm = document.querySelector('#imageForm');
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

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let activeRequestId = null;
let isRendering = false;
let stopBatchRequested = false;
let stopEnabledAt = 0;
let isBatchRunning = false;
let isArticleTitleManual = false;
let authSession = null;
let appConfig = null;

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
};

const clearAuthSession = () => {
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
  caption.textContent = `${String(index).padStart(2, '0')} - ${title || 'Ảnh đã tạo'}`;

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
  caption.textContent = `${String(index).padStart(2, '0')} - ${title || 'Không tạo được'}`;

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

const setVersion = async () => {
  const [version, config] = await Promise.all([
    window.toolApi.getVersion(),
    window.toolApi.getConfig()
  ]);
  appConfig = config;
  appVersionEl.textContent = `v${version}`;
  memberPanelButton.hidden = config?.app?.flavor !== 'admin';
};

const getFormConfig = () => {
  const formData = new FormData(imageForm);
  const prompt = String(formData.get('prompt') || '').trim();
  const promptStyle = formData.get('promptStyle');
  const detectedSettings = getDetectedPromptSettings(prompt);
  const effectivePromptStyle = promptStyle === 'autoDetect' ? detectedSettings.promptStyle : promptStyle;
  const effectiveTextMode = promptStyle === 'autoDetect' ? detectedSettings.textMode : formData.get('textMode');
  const effectiveIconStyle = promptStyle === 'autoDetect' ? detectedSettings.iconStyle : formData.get('iconStyle');
  const effectiveSize = promptStyle === 'autoDetect' ? detectedSettings.size : formData.get('size');

  return {
    model: formData.get('model'),
    endpoint: formData.get('endpoint'),
    apiKey: formData.get('apiKey'),
    authToken: authSession?.token || '',
    deviceId: getDeviceId(),
    prompt: enhancePrompt(prompt, effectivePromptStyle),
    fileTitle: prompt,
    refImageUrl: formData.get('refImageUrl'),
    size: effectiveSize,
    quality: formData.get('quality'),
    background: formData.get('background'),
    textMode: effectiveTextMode,
    iconStyle: effectiveIconStyle,
    imageDetail: formData.get('imageDetail'),
    outputFormat: formData.get('outputFormat'),
    outputDir: formData.get('outputDir'),
    articleTitle: formData.get('articleTitle'),
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

  if (isThumbnail) {
    return {
      promptStyle: 'mexicoThumbnail',
      textMode: isBreaking ? 'shock' : 'curiosity',
      iconStyle: isBreaking ? 'alert' : 'youtubeViral',
      size: '1920x1080'
    };
  }

  if (isReview) {
    return { promptStyle: 'social', textMode: 'authority', iconStyle: 'reviewRating', size: '1920x1080' };
  }

  if (isTutorial) {
    return { promptStyle: 'social', textMode: 'tutorialClear', iconStyle: 'tutorialGuide', size: '1920x1080' };
  }

  if (isProduct) {
    return {
      promptStyle: 'product',
      textMode: 'luxury',
      iconStyle: 'productSale',
      size: '1536x1024'
    };
  }

  if (isTech) {
    return { promptStyle: 'social', textMode: 'authority', iconStyle: 'techAi', size: '1920x1080' };
  }

  if (isGaming) {
    return { promptStyle: 'social', textMode: 'shock', iconStyle: 'gaming', size: '1920x1080' };
  }

  if (isFinance) {
    return { promptStyle: 'social', textMode: 'moneySuccess', iconStyle: 'finance', size: '1920x1080' };
  }

  if (isHealth) {
    return { promptStyle: 'premium', textMode: 'transformation', iconStyle: 'health', size: '1920x1080' };
  }

  if (isTravel) {
    return { promptStyle: 'cinematic', textMode: 'happyPositive', iconStyle: 'travel', size: '1920x1080' };
  }

  if (isFood) {
    return { promptStyle: 'premium', textMode: 'happyPositive', iconStyle: 'food', size: '1920x1080' };
  }

  if (isBeforeAfter) {
    return { promptStyle: 'social', textMode: 'transformation', iconStyle: 'beforeAfter', size: '1920x1080' };
  }

  if (isMystery) {
    return { promptStyle: 'cinematic', textMode: 'mysteryReveal', iconStyle: 'mystery', size: '1920x1080' };
  }

  if (isSuccess) {
    return { promptStyle: 'premium', textMode: 'moneySuccess', iconStyle: 'success', size: '1920x1080' };
  }

  if (isSocial) {
    return {
      promptStyle: 'social',
      textMode: 'normal',
      iconStyle: 'none',
      size: '1920x1080'
    };
  }

  if (isCinematic) {
    return {
      promptStyle: 'cinematic',
      textMode: 'normal',
      iconStyle: 'none',
      size: '1920x1080'
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
  document.querySelector('#promptStyle').value = 'autoDetect';
  document.querySelector('#size').value = detected.size;
  document.querySelector('#textMode').value = detected.textMode;
  document.querySelector('#iconStyle').value = detected.iconStyle;
  statusText.textContent = `Đã nhận diện: ${detected.promptStyle}`;
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
  const textRules = {
    required: 'MANDATORY: include large readable Spanish headline text on the image, text must occupy 25-35% of the frame, use bold uppercase typography, high contrast red/black/yellow, no missing text.',
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
  const headlineInstruction = quotedTexts.length > 0
    ? `Required visible on-image text: ${quotedTexts.map((text) => `"${text}"`).join(' + ')}.`
    : 'Create a short Spanish headline from the prompt and render it large on the image.';

  return [
    prompt,
    headlineInstruction,
    textRules[config.textMode] || textRules.required,
    iconRules[config.iconStyle] || iconRules.mexicoGossip,
    'Use 16:9 website thumbnail composition, subject face clear, text placed in clean whitespace, Mexico entertainment audience, high CTR, final image must not look textless.'
  ].join(', ');
};

const simplifyPromptForRetry = (prompt, attempt) => {
  const cleanPrompt = normalizeTitleText(prompt);
  const quotedTexts = extractQuotedTexts(cleanPrompt);
  const visibleText = quotedTexts[0] ? ` Include this readable headline: "${quotedTexts[0]}".` : '';

  if (attempt === 2) {
    return [
      cleanPrompt,
      'Simplify the scene if needed. Use a clean 16:9 composition with one clear main subject, white background, high contrast, readable text, no clutter.'
    ].join(', ');
  }

  return [
    cleanPrompt
      .replace(/\b(ultra|extreme|shocking|scandal|controversy|chaos|breaking|viral|clickbait)\b/gi, 'dramatic')
      .replace(/\s+/g, ' ')
      .trim(),
    visibleText,
    'Create a safe 16:9 entertainment website thumbnail. Use realistic people-like subjects without implying real defamatory claims. Clean white background, bold readable headline area, professional composition.'
  ].join(' ');
};

const createPayload = (config) => {
  const payload = {
    model: config.model,
    prompt: config.prompt,
    n: 1,
    size: config.size,
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

const shellQuote = (value) => `'${String(value).replace(/'/g, "'\\''")}'`;

const maskKey = (apiKey) => `${apiKey.slice(0, 7)}...${apiKey.slice(-6)}`;

const updateCommand = () => {
  const config = getFormConfig();
  const payload = createPayload(config);
  commandOutput.value = [
    `curl -X POST ${shellQuote(config.endpoint)} \\`,
    '  -H "Content-Type: application/json" \\',
    `  -H "Authorization: Bearer ${maskKey(config.apiKey)}" \\`,
    '  -H "Accept: text/event-stream" \\',
    `  -d ${shellQuote(JSON.stringify(payload))}`
  ].join('\n');
};

const getBatchList = () => {
  const lines = batchPrompts.value.replace(/\r\n/g, '\n').split('\n');
  const items = [];
  let current = null;
  let isReadingPrompt = false;

  const pushCurrent = () => {
    if (!current) {
      return;
    }

    const prompt = current.promptLines.join('\n').trim();
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
        promptLines: []
      };
      isReadingPrompt = false;
      return;
    }

    if (!current) {
      return;
    }

    if (/^\s*Prompt\s*[:：]\s*$/i.test(line)) {
      isReadingPrompt = true;
      return;
    }

    if (isReadingPrompt) {
      current.promptLines.push(line);
    }
  });

  pushCurrent();
  return items;
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

  return batchPrompts.value
    .split(/\r?\n/)
    .map((line, index) => ({
      title: `Prompt ${index + 1}`,
      prompt: line.trim()
    }))
    .filter((item) => item.prompt);
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
  const maxAttempts = 4;
  const detectedSettings = getDetectedPromptSettings(prompt);
  const batchConfig = baseConfig.promptStyle === 'autoDetect'
    ? {
      ...baseConfig,
      promptStyle: detectedSettings.promptStyle,
      textMode: detectedSettings.textMode,
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
      const promptForAttempt = attempt === 1
        ? applyVisualRequirements(enhancePrompt(prompt, batchConfig.promptStyle), batchConfig)
        : simplifyPromptForRetry(prompt, attempt);

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
  const presets = {
    monthly: { price: 99000, quota: 100, days: 30, devices: 1 },
    trial: { price: 0, quota: 10, days: 7, devices: 1 },
    vip: { price: 199000, quota: 300, days: 30, devices: 2 }
  };
  const preset = presets[memberPlanSelect.value] || presets.monthly;
  memberPriceInput.value = preset.price;
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

const renderMemberDashboard = ({ stats, users }) => {
  memberStatRevenue.textContent = formatVnd(stats.estimatedMonthlyRevenue);
  memberStatUsers.textContent = stats.users;
  memberStatActive.textContent = stats.activeUsers;
  memberStatExpiring.textContent = stats.expiringSoonUsers;
  memberStatExpired.textContent = stats.expiredUsers;
  memberStatImages.textContent = stats.imagesCreated;
  memberStatFailures.textContent = stats.failures;
  memberTableBody.replaceChildren(...users.map((user) => {
    const tr = document.createElement('tr');
    const remaining = Math.max(0, Number(user.quotaTotal || 0) - Number(user.quotaUsed || 0));

    const email = document.createElement('td');
    email.textContent = user.email;

    const plan = document.createElement('td');
    const planName = document.createElement('strong');
    const planPrice = document.createElement('span');
    plan.className = 'member-plan-cell';
    planName.textContent = user.planName || 'Gói tháng';
    planPrice.textContent = formatVnd(user.monthlyPrice || 99000);
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
      memberActionButton(user.status === 'active' ? 'Khóa' : 'Mở', () => updateMember(user.id, { status: user.status === 'active' ? 'blocked' : 'active' })),
      memberActionButton('Reset quota', () => updateMember(user.id, { quotaUsed: 0 })),
      memberActionButton('Gia hạn', () => updateMember(user.id, { expiresAt: addDays(30), monthlyPrice: user.monthlyPrice || 99000 })),
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
    setMemberStatus('Đã cập nhật');
  } catch (error) {
    setMemberStatus(error.message || 'Không tải được bảng thành viên');
  }
};

const openMemberPanel = async () => {
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
    setMemberStatus('Đã lưu');
  } catch (error) {
    setMemberStatus(error.message || 'Không lưu được thay đổi');
  }
};

clearPromptButton.addEventListener('click', () => {
  promptInput.value = '';
  syncArticleTitleFromPrompt();
  promptInput.focus();
  updateCommand();
});

detectPromptButton.addEventListener('click', applyDetectedPromptSettings);

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
  const planLabels = {
    monthly: 'Gói tháng',
    trial: 'Dùng thử',
    vip: 'VIP'
  };

  try {
    const result = await window.toolApi.createMemberUser({
      email: document.querySelector('#memberEmail').value.trim(),
      password: document.querySelector('#memberPassword').value,
      planName: planLabels[memberPlanSelect.value] || 'Gói tháng',
      monthlyPrice: Number(memberPriceInput.value || 0),
      paymentStatus: memberPriceInput.value === '0' ? 'trial' : 'paid',
      quotaTotal: Number(memberQuotaInput.value || 0),
      expiresAt: memberExpiresAtInput.value || null,
      deviceLimit: Number(memberDeviceLimitInput.value || 1)
    });
    memberCreateForm.reset();
    memberPlanSelect.value = 'monthly';
    applyMemberPlanPreset();
    renderMemberDashboard(result.dashboard);
    setMemberStatus('Đã thêm thành viên');
  } catch (error) {
    setMemberStatus(error.message || 'Không thêm được thành viên');
  }
});

promptInput.addEventListener('input', () => {
  syncArticleTitleFromPrompt();
  if (document.querySelector('#promptStyle').value === 'autoDetect') {
    const detected = getDetectedPromptSettings(promptInput.value);
    document.querySelector('#size').value = detected.size;
    document.querySelector('#textMode').value = detected.textMode;
    document.querySelector('#iconStyle').value = detected.iconStyle;
  }
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

  setLoading(true);
  setStatus('Đang gửi yêu cầu tạo ảnh…');

  try {
    const config = getFormConfig();
    activeRequestId = crypto.randomUUID();
    const startedAt = new Date();
    const result = await window.toolApi.generateImage({
      ...config,
      requestId: activeRequestId
    });

    previewImage.src = result.imageUrl;
    previewImage.classList.remove('hidden');
    clearPreviewGrid();
    addPreviewTile({
      imageUrl: result.imageUrl,
      title: config.fileTitle || config.prompt,
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
    statusText.textContent = 'Hoàn tất';
  } catch (error) {
    statusText.textContent = 'Thất bại';
    outputLog.textContent = error.message;
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
      outputLog.textContent = `Đang tạo: ${prompt}`;

      try {
        const result = await generateBatchImageWithRetry({
          baseConfig,
          prompt,
          fileTitle,
          index,
          total: batchItems.length
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
          error: error.message
        });
        addPreviewErrorTile({
          title: fileTitle,
          index: index + 1,
          error: error.message
        });
        batchStatus.textContent = `Lỗi ${index + 1}/${batchItems.length}, tiếp tục ảnh kế tiếp`;
      } finally {
        activeRequestId = null;
      }

      outputLog.textContent = JSON.stringify(results, null, 2);
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
    outputLog.textContent = JSON.stringify({ manifestPath, results }, null, 2);
    activeRequestId = null;
    setBatchLoading(false);
  }
});

setVersion();
outputDirInput.value = localStorage.getItem('outputDir') || '';
applyMemberPlanPreset();
syncArticleTitleFromPrompt();
updateCommand();
updateBatchCount();
setAuthenticated({
  token: '',
  user: {
    email: 'Local image endpoint workspace'
  }
});
