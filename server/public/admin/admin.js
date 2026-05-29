const loginView = document.querySelector('#loginView');
const dashboardView = document.querySelector('#dashboardView');
const adminLogin = document.querySelector('#adminLogin');
const emailInput = document.querySelector('#email');
const passwordInput = document.querySelector('#password');
const loginStatus = document.querySelector('#loginStatus');
const twoFactorPanel = document.querySelector('#twoFactorPanel');
const twoFactorSetup = document.querySelector('#twoFactorSetup');
const twoFactorSecret = document.querySelector('#twoFactorSecret');
const twoFactorLink = document.querySelector('#twoFactorLink');
const twoFactorCode = document.querySelector('#twoFactorCode');
const verifyTwoFactorButton = document.querySelector('#verifyTwoFactor');
const adminEmail = document.querySelector('#adminEmail');
const logoutButton = document.querySelector('#logout');
const refreshButton = document.querySelector('#refresh');
const createUserForm = document.querySelector('#createUser');
const createStatus = document.querySelector('#createStatus');
const usersBody = document.querySelector('#usersBody');
const eventsBody = document.querySelector('#eventsBody');
const emailHistoryBody = document.querySelector('#emailHistoryBody');
const sequenceFlowFilter = document.querySelector('#sequenceFlowFilter');
const sequenceBody = document.querySelector('#sequenceBody');
const sequenceCount = document.querySelector('#sequenceCount');
const userSearch = document.querySelector('#userSearch');
const statusFilter = document.querySelector('#statusFilter');
const roleFilter = document.querySelector('#roleFilter');
const planFilterStatus = document.querySelector('#planFilterStatus');
const agentInsights = document.querySelector('#agentInsights');
const USER_API = '/api/9router/user';
const ADMIN_API = '/api/9router/admin';

let token = localStorage.getItem('adminToken') || '';
let currentAdmin = null;
let cachedUsers = [];
let cachedEvents = [];
let cachedEmailHistory = [];
let activePlanFilter = 'all';
let pendingTwoFactor = null;

const planLabels = {
  all: 'Tất cả gói',
  trial: 'Dùng thử',
  monthly: 'Gói tháng',
  vip: 'VIP'
};

const buildEmailSequence = (flow, rows) => rows.map(([day, stage, trigger, subject, goal, action]) => ({
  flow,
  day,
  stage,
  trigger,
  subject,
  goal,
  action
}));

const emailSequences = [
  ...buildEmailSequence('free', [
    [1, 'Kich hoat', 'Vua dang ky free', 'Tai khoan dung thu DG Image Tools da san sang', 'Giao tai khoan va video bat dau', 'Gui email tai khoan + video cai app/dang nhap/tao anh dau tien'],
    [1, 'Nhac nhanh', 'Sau 3-6 gio chua dang nhap', 'Anh/chi da nhan duoc tai khoan dung thu chua?', 'Giam mat khach vi khong check mail', 'Zalo/SMS nhac kiem tra Inbox/Spam va gui lai video neu can'],
    [2, 'Onboarding', 'Chua dang nhap hoac quotaUsed = 0', 'Video 2 phut: tao anh dau tien bang DG Image Tools', 'Day khach tao anh dau tien', 'Gui video tao anh dau tien + 3 prompt mau de copy'],
    [3, 'Gia tri', 'Da tao 1-2 anh', 'Cach tao 5 bien the thumbnail de chon anh tot nhat', 'Tang trai nghiem dung thu', 'Gui meo tao bien the, sua prompt va luu mau tot'],
    [4, 'Xu ly ket', 'Chua dung app', 'Can em ho tro cai app hoac dang nhap lan dau khong?', 'Mo loi ho tro truc tiep', 'Zalo hoi kho khan, de nghi remote/call ngan neu can'],
    [5, 'Ban duoi mem', 'Da dung tu 3 anh tro len', 'Neu lam thumbnail deu, goi thang se tiet kiem thoi gian hon', 'Mo nhu cau nang cap', 'Gioi thieu goi thang 100 anh va loi ich lam deu hang tuan'],
    [6, 'Case use', 'Dang con trial', 'Mot quy trinh tao thumbnail nhanh cho kenh YouTube', 'Gan app vao cong viec hang ngay', 'Gui workflow: y tuong -> prompt -> bien the -> chon anh -> toi uu'],
    [7, 'Chot trial', 'Trial sap het hoac da het', 'Dung thu sap ket thuc, nang cap de dung tiep quota', 'Chot len tra phi', 'Gui loi moi nang cap goi thang/VIP + nhac tai khoan van duoc giu'],
    [8, 'Hoi ly do', 'Chua mua', 'Anh/chi thay DG Image Tools con vuong diem nao?', 'Thu feedback va cuu deal', 'Hoi 1 cau ngan: gia, cai dat, chat luong anh hay nhu cau khac'],
    [9, 'Gia tri nang cao', 'Da tao anh nhung chua mua', 'Meo lam anh on dinh hon: prompt mau theo ngach', 'Tang niem tin truoc khi ban', 'Gui prompt mau cho tai chinh, review, giao duc, drama, podcast'],
    [10, 'Offer', 'Da dung nhieu nhung chua mua', 'Mo khoa them quota de tiep tuc tao anh', 'Chot goi thang', 'Gui offer goi thang, nhan man 100 anh/thang va ho tro setup'],
    [11, 'Ho tro', 'Chua dang nhap', 'Em co the gui lai thong tin dang nhap qua Zalo', 'Xu ly khach khong check email', 'Gui lai tai khoan qua Zalo/SMS neu co so dien thoai'],
    [12, 'So sanh', 'Da tao 1-5 anh', 'Khi nao nen dung goi thang thay vi dung thu?', 'Lam ro ly do tra phi', 'So sanh quota, toc do lam viec, ho tro va dung on dinh hang ngay'],
    [13, 'Bang chung', 'Chua mua', 'Cach dung app de tao anh cho 1 video moi trong 10 phut', 'Bien loi ich thanh tinh huong cu the', 'Gui mini case workflow tao thumbnail cho 1 video'],
    [14, 'Chot 2', 'Chua mua', 'Can them quota hay can ho tro tao mau anh tot hon?', 'Chot bang ho tro', 'Moi nang cap hoac hen ho tro toi uu prompt'],
    [15, 'Tai kich hoat', 'Im lang', 'Anh/chi co muon em giu tai khoan dung thu them khong?', 'Keo phan hoi', 'Hoi co muon gia han trial ngan neu thuc su can test tiep'],
    [16, 'Noi dau', 'Khach lam YouTube/marketing', 'Dung app de giam thoi gian lam anh moi ngay', 'Danh vao loi ich tiet kiem thoi gian', 'Gui noi dung ve rut ngan viec len y tuong va tao bien the'],
    [17, 'Prompt', 'Da dang nhap', '5 prompt mau de test lai DG Image Tools', 'Keo khach quay lai app', 'Gui 5 prompt copy nhanh va yeu cau tao thu 3 anh'],
    [18, 'Xu ly phan van', 'Chua mua', 'Neu anh/chi chi can lam it anh thi nen chon goi nao?', 'Giam can tro ve gia', 'Goi y goi thang cho ca nhan, VIP cho team/nhieu kenh'],
    [19, 'Ho tro 1-1', 'Da tao anh nhung chat luong chua tot', 'Gui em 1 anh mau, em goi y prompt toi uu', 'Tang ty le thanh cong', 'Moi khach gui anh mau/chu de de tu van prompt'],
    [20, 'Chot nhe', 'Chua mua', 'Tai khoan cua anh/chi van co the nang cap de dung tiep', 'Nhac mua khong gay ap luc', 'Nhac tai khoan da co san, thanh toan xong la dung tiep'],
    [21, 'Tong ket', 'Het trial 2 tuan', 'Tong ket dung thu DG Image Tools', 'Ket thuc dot cham soc 1', 'Tom tat loi ich, hoi feedback, CTA nang cap'],
    [22, 'Reactivation', 'Khong hoat dong', 'Anh/chi muon nhan bo prompt moi mien phi khong?', 'Lay lai tuong tac', 'Gui bo prompt mau neu khach phan hoi'],
    [23, 'Niche', 'Co thong tin ngach', 'Prompt rieng cho ngach cua anh/chi', 'Ca nhan hoa', 'Gui prompt theo ngach hoac hoi them ngach neu chua co'],
    [24, 'FAQ', 'Chua mua', 'Cau hoi thuong gap truoc khi nang cap', 'Giai dap can tro', 'Tra loi ve quota, thiet bi, thanh toan, ho tro, het han'],
    [25, 'Uu tien', 'Da dung kha nhieu', 'Nen nang goi neu anh/chi tao anh deu moi tuan', 'Chot nhom co y dinh cao', 'Gui goi y mua goi thang/VIP theo tan suat dung'],
    [26, 'Gia tri', 'Chua mua', 'Dung thumbnail tot de test nhieu y tuong video hon', 'Noi ve dau ra kinh doanh', 'Lien he anh tot voi CTR/y tuong video, khong hua qua muc'],
    [27, 'Hoi nhu cau', 'Im lang', 'Anh/chi dang can tao loai anh nao nhat?', 'Phan loai lead', 'Hoi nhu cau: YouTube, ads, san pham, giao duc, khac'],
    [28, 'Chot cuoi', 'Chua mua', 'Lan nhac cuoi ve goi dung tiep DG Image Tools', 'Ket thuc ban duoi chinh', 'CTA ro rang nang cap hoac de lai nhu cau ho tro'],
    [29, 'Nurture', 'Khong mua', 'Em se gui meo tao anh moi khi co cap nhat hay', 'Giu lead dai han', 'Chuyen sang danh sach noi dung thang'],
    [30, 'Dong vong', 'Khong mua sau 30 ngay', 'Can em mo lai trial khi anh/chi san sang test tiep khong?', 'Dong vong 30 ngay', 'Hoi xin phep lien he lai khi co mau/video moi'],
    [45, 'Tai kich hoat', 'Lead cu', 'DG Image Tools co them workflow/prompt moi cho anh/chi', 'Mo lai co hoi ban', 'Gui cap nhat moi + moi test lai neu phu hop'],
    [60, 'Re-offer', 'Lead cu co tuong tac', 'Muon dung lai DG Image Tools voi goi thang khong?', 'Ban lai lead cu', 'Gui offer ngan + ho tro setup lai']
  ]),
  ...buildEmailSequence('paid', [
    [1, 'Kich hoat', 'Vua thanh toan', 'Tai khoan DG Image Tools cua anh/chi da duoc kich hoat', 'Giao tai khoan va dam bao bat dau dung', 'Gui tai khoan + video cai app/dang nhap/tao anh dau tien + checklist'],
    [1, 'Nhac nhanh', 'Sau 3-6 gio chua dang nhap', 'Em gui lai video huong dan dang nhap DG Image Tools', 'Khong de khach tra phi bi ket', 'Zalo/SMS nhac check email/spam, de nghi gui lai thong tin'],
    [2, 'Onboarding', 'Da dang nhap nhung quotaUsed = 0', 'Video: tao anh dau tien va luu ket qua', 'Day khach tao anh dau tien', 'Gui video tao anh dau tien + prompt mau theo ngach'],
    [3, 'Toi uu', 'Da tao anh', 'Cach viet prompt de anh dep va dung y hon', 'Tang chat luong dau ra', 'Gui video prompt nang cao + 5 loi thuong gap'],
    [4, 'Ho tro', 'Dung it hoac loi', 'Anh/chi co can em xem giup prompt/anh mau khong?', 'Giam bo cuoc som', 'Moi gui anh mau/chu de de tu van nhanh'],
    [5, 'Workflow', 'Da tao 3+ anh', 'Quy trinh tao 5-10 bien the thumbnail moi ngay', 'Dua app vao cong viec lap lai', 'Gui workflow tao bien the, chon anh, sua prompt, luu mau'],
    [6, 'Niche', 'Co note/ngach', 'Prompt toi uu theo ngach cua anh/chi', 'Ca nhan hoa', 'Gui prompt theo ngach hoac hoi them ngach'],
    [7, 'Kiem tra 1 tuan', 'Sau 7 ngay', 'Sau 1 tuan dung DG Image Tools, anh/chi can toi uu diem nao?', 'Lay feedback va giam churn', 'Hoi 1 cau ngan, de nghi ho tro neu quotaUsed thap'],
    [8, 'Meo nang cao', 'Dang dung binh thuong', 'Meo tao anh on dinh hon giua cac lan render', 'Tang hieu qua cong viec', 'Gui cach co dinh style, bo cuc, mau sac, chu, nhan vat'],
    [9, 'Luu prompt', 'Da tao nhieu anh', 'Nen luu lai prompt thang de tai su dung', 'Giup khach lam nhanh hon', 'Huong dan tao thu vien prompt ca nhan theo ngach'],
    [10, 'Kiem tra quota', 'QuotaUsed thap', 'Anh/chi chua dung nhieu, co can em ho tro setup workflow?', 'Cuu khach dung it', 'Zalo chu dong hoi va de nghi call 10 phut'],
    [11, 'Kiem tra quota', 'QuotaUsed cao', 'Anh/chi dang dung tot, co can them quota/VIP khong?', 'Mo upsell VIP', 'Goi y VIP neu gan het quota hoac dung nhieu kenh'],
    [12, 'Case use', 'Dang dung', 'Mau workflow cho 1 video YouTube moi', 'Tang gia tri su dung', 'Gui quy trinh tu tieu de video den 5 mau thumbnail'],
    [13, 'Chat luong', 'Co loi render hoac ket qua kem', 'Cach sua prompt khi anh chua dung y', 'Giam that vong ve chat luong', 'Gui checklist sua prompt: bo cuc, doi tuong, cam xuc, nen, chu'],
    [14, 'Tong ket 2 tuan', 'Sau 14 ngay', 'Kiem tra nhanh hieu qua DG Image Tools cua anh/chi', 'Danh gia su dung nua thang', 'Neu dung it thi ho tro; neu dung tot thi goi y workflow nang cao'],
    [15, 'Dao tao', 'Dang dung', 'Video nang cao: tao anh theo style rieng', 'Tang su phu thuoc vao workflow', 'Gui video/style guide va cach tao prompt mau'],
    [16, 'Thiet bi', 'Co nhieu thiet bi/team', 'Cach quan ly thiet bi va quota cho team', 'Ho tro team/VIP', 'Huong dan device limit, khi nao can nang VIP'],
    [17, 'Nang suat', 'Da dung 10+ anh', 'Cach tao lo anh hang loat ma van giu style', 'Tang san luong', 'Gui meo batch prompt, dat ten file, luu mau tot'],
    [18, 'Cham soc', 'Khong hoat dong 5 ngay', 'Anh/chi co dang bi ket o buoc nao khong?', 'Keo quay lai', 'Zalo hoi truc tiep, gui lai video phu hop'],
    [19, 'Toi uu CTR', 'YouTube', '3 cach test thumbnail cho cung mot video', 'Lien he app voi ket qua cong viec', 'Gui cach tao 3 concept: cam xuc, so sanh, cau hoi'],
    [20, 'Kiem tra quota', 'Gan het quota', 'Tai khoan cua anh/chi sap het quota tao anh', 'Upsell quota/VIP', 'Goi y nang VIP hoac mua them quota neu co chinh sach'],
    [21, 'Tong ket 3 tuan', 'Sau 21 ngay', '3 tuan su dung: co nen toi uu lai workflow khong?', 'Giam roi bo truoc gia han', 'Hoi feedback, de nghi xem prompt/anh mau'],
    [22, 'Meo', 'Dang dung', 'Bo prompt mau cho anh san pham/marketing', 'Mo rong use case', 'Gui prompt marketing neu phu hop, neu khong gui prompt YouTube'],
    [23, 'Bao tri', 'Co loi gan day', 'Neu app bao loi, hay gui em anh man hinh nay', 'Giam friction ho tro', 'Huong dan gui loi: email, thoi gian, anh man hinh, prompt'],
    [24, 'Gia han som', 'Con 6 ngay het han', 'Tai khoan con khoang 1 tuan, anh/chi co muon gia han som khong?', 'Mo dau gia han', 'Nhac gia han som neu dang dung tot; neu dung it thi de nghi ho tro'],
    [25, 'Gia han', 'Con 5 ngay het han', 'Gia han DG Image Tools de khong gian doan cong viec', 'Gia han', 'Gui thong tin gia han + loi ich tiep tuc workflow'],
    [26, 'Gia han/upsell', 'Dung nhieu', 'Anh/chi co nen len VIP thang toi khong?', 'Upsell VIP', 'So sanh goi thang va VIP theo quota/thiet bi/team'],
    [27, 'Hoi van de', 'Dung it', 'Neu thang nay anh/chi dung it, em co the ho tro toi uu lai', 'Cuu gia han', 'Hoi ly do dung it va de nghi setup workflow moi'],
    [28, 'Nhac het han', 'Con 2 ngay het han', 'Tai khoan sap het han sau 2 ngay', 'Gia han ro rang', 'Gui CTA gia han, nhac khong gian doan quota/cong viec'],
    [29, 'Nhac cuoi', 'Con 1 ngay het han', 'Ngay mai tai khoan DG Image Tools se het han', 'Chot gia han', 'Gui nhac cuoi + kenh thanh toan/ho tro'],
    [30, 'Het han', 'Het han/chua gia han', 'Tai khoan da het han, gia han de dung tiep', 'Khoi phuc', 'Gui loi moi gia han, neu dung it thi de nghi ho tro truoc khi gia han'],
    [45, 'Winback', 'Khach het han 15 ngay', 'Anh/chi co muon kich hoat lai DG Image Tools khong?', 'Lay lai khach cu', 'Gui cap nhat moi + moi gia han lai'],
    [60, 'Winback', 'Khach cu im lang', 'DG Image Tools co them workflow moi de tao anh nhanh hon', 'Winback dai han', 'Gui video/cap nhat moi + offer ho tro setup lai']
  ])
];

const api = async (path, options = {}) => {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(body.message || 'Yêu cầu thất bại.');
  }

  return body;
};

const setLoggedIn = (loggedIn, user = null) => {
  loginView.classList.toggle('hidden', loggedIn);
  dashboardView.classList.toggle('hidden', !loggedIn);
  adminEmail.textContent = user?.email || 'Đang quản lý hệ thống';
  logoutButton.hidden = !loggedIn;
};

const resetTwoFactorFlow = () => {
  pendingTwoFactor = null;
  twoFactorPanel.classList.add('hidden');
  twoFactorSetup.classList.add('hidden');
  twoFactorSecret.textContent = '';
  twoFactorLink.removeAttribute('href');
  twoFactorCode.value = '';
  verifyTwoFactorButton.disabled = false;
};

const showTwoFactorFlow = (result) => {
  pendingTwoFactor = {
    tempToken: result.tempToken,
    setup: Boolean(result.requiresTwoFactorSetup)
  };
  twoFactorPanel.classList.remove('hidden');
  twoFactorSetup.classList.toggle('hidden', !pendingTwoFactor.setup);
  twoFactorSecret.textContent = result.setupSecret || '';
  if (result.otpauthUrl) {
    twoFactorLink.href = result.otpauthUrl;
  }
  twoFactorCode.value = '';
  twoFactorCode.focus();
};

const formatDate = (value) => value ? new Date(value).toLocaleString('vi-VN') : '-';
const formatShortDate = (value) => value ? new Date(value).toLocaleDateString('vi-VN') : '-';

const appendTextCell = (row, value, className = '') => {
  const cell = document.createElement('td');
  if (className) cell.className = className;
  cell.textContent = value == null || value === '' ? '-' : String(value);
  return row.appendChild(cell);
};

const actionButton = (label, className, onClick) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
};

const renderStatusPill = (text, blocked = false) => {
  const pill = document.createElement('span');
  pill.className = `pill${blocked ? ' blocked' : ''}`;
  pill.textContent = text;
  return pill;
};

const getDaysLeft = (expiresAt) => {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
};

const normalizeText = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const getUserPlanKey = (user) => {
  const planName = normalizeText(user.planName);
  if (planName.includes('vip')) return 'vip';
  if (planName.includes('dung thu') || planName.includes('trial')) return 'trial';
  if (planName.includes('goi thang') || planName.includes('thang') || planName.includes('monthly')) return 'monthly';

  const quotaTotal = Number(user.quotaTotal || 0);
  const durationDays = Number(user.durationDays || 0);
  const deviceLimit = Number(user.deviceLimit || 1);
  if (quotaTotal <= 10 || (durationDays > 0 && durationDays <= 7)) return 'trial';
  if (quotaTotal >= 300 || deviceLimit >= 2) return 'vip';
  return 'monthly';
};

const updatePlanButtons = () => {
  document.querySelectorAll('.preset').forEach((button) => {
    button.classList.toggle('active', button.dataset.plan === activePlanFilter);
  });
  if (planFilterStatus) {
    planFilterStatus.textContent = activePlanFilter === 'all' ? '' : `Đang xem: ${planLabels[activePlanFilter]}`;
  }
};

const getFilteredUsers = () => {
  const query = userSearch.value.trim().toLowerCase();
  const status = statusFilter.value;
  const role = roleFilter.value;
  return cachedUsers.filter((user) => {
    if (query && !String(user.email || '').includes(query)) return false;
    if (status !== 'all' && user.status !== status) return false;
    if (role !== 'all' && user.role !== role) return false;
    if (activePlanFilter !== 'all' && getUserPlanKey(user) !== activePlanFilter) return false;
    return true;
  });
};

const renderQuotaCell = (row, user) => {
  const used = Number(user.quotaUsed || 0);
  const total = Number(user.quotaTotal || 0);
  const remaining = Math.max(0, total - used);
  const usedRatio = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const cell = document.createElement('td');
  cell.className = 'quota-cell';

  if (user.role === 'admin') {
    cell.innerHTML = `
      <div class="quota-summary admin-quota">Không áp dụng</div>
      <div class="muted-text">Tài khoản quản trị không trừ quota thành viên</div>
    `;
    row.append(cell);
    return;
  }

  const quotaState = remaining <= 0 ? 'empty' : remaining <= 5 ? 'low' : 'ok';
  cell.innerHTML = `
    <div class="quota-summary ${quotaState}"><strong>${remaining}</strong><span>/ ${total} ảnh còn</span></div>
    <div class="meter" title="Đã dùng ${used}/${total} ảnh"><span style="width:${usedRatio}%"></span></div>
    <div class="muted-text">Đã dùng ${used} ảnh</div>
  `;
  row.append(cell);
};

const renderUsers = () => {
  const users = getFilteredUsers();
  updatePlanButtons();
  usersBody.replaceChildren(...users.map((user) => {
    const row = document.createElement('tr');
    const daysLeft = getDaysLeft(user.expiresAt);
    const isExpired = daysLeft !== null && daysLeft < 0;

    appendTextCell(row, user.email, 'email-cell');
    appendTextCell(row, user.role === 'admin' ? 'Admin' : 'User');

    const statusCell = document.createElement('td');
    statusCell.append(renderStatusPill(user.status === 'active' ? 'Đang hoạt động' : 'Đã khóa', user.status !== 'active'));
    row.append(statusCell);

    renderQuotaCell(row, user);
    appendTextCell(row, Number(user.durationDays || 0) ? `${user.durationDays} ngày` : 'Không giới hạn');
    appendTextCell(row, formatShortDate(user.activatedAt));
    appendTextCell(row, user.expiresAt ? `${formatShortDate(user.expiresAt)}${isExpired ? ' · đã hết hạn' : daysLeft !== null ? ` · còn ${daysLeft} ngày` : ''}` : 'Chưa kích hoạt');
    appendTextCell(row, `${(user.devices || []).length}/${user.deviceLimit}`);
    appendTextCell(row, formatDate(user.lastLoginAt));

    const actionsCell = document.createElement('td');
    const actions = document.createElement('div');
    actions.className = 'row-actions';
    if (user.id === currentAdmin?.id) {
      const currentPill = document.createElement('span');
      currentPill.className = 'pill';
      currentPill.textContent = 'Đang đăng nhập';
      actions.append(currentPill);
    } else {
      actions.append(
        actionButton(user.status === 'active' ? 'Khóa' : 'Mở khóa', 'danger', () => updateUser(user.id, { status: user.status === 'active' ? 'blocked' : 'active' })),
        actionButton('Reset đã dùng', 'secondary', () => updateUser(user.id, { quotaUsed: 0 })),
        actionButton('Xóa thiết bị', 'secondary', () => updateUser(user.id, { clearDevices: true })),
        actionButton('+100 quota', 'secondary', () => updateUser(user.id, { quotaTotal: Number(user.quotaTotal || 0) + 100 }))
      );
    }
    actionsCell.append(actions);
    row.append(actionsCell);
    return row;
  }));
};

const renderEvents = (events) => {
  eventsBody.replaceChildren(...events.map((event) => {
    const row = document.createElement('tr');
    appendTextCell(row, formatDate(event.createdAt));
    appendTextCell(row, event.email || '-');

    const statusCell = document.createElement('td');
    statusCell.append(renderStatusPill(event.ok ? 'Thành công' : 'Lỗi', !event.ok));
    row.append(statusCell);

    appendTextCell(row, event.deviceId || '-');
    const promptCell = appendTextCell(row, event.error || event.prompt || '', 'prompt-cell');
    promptCell.title = event.error || event.prompt || '';
    return row;
  }));
};

const renderEmailHistory = (emails) => {
  emailHistoryBody.replaceChildren(...emails.map((email) => {
    const row = document.createElement('tr');
    appendTextCell(row, formatDate(email.sentAt));
    appendTextCell(row, email.to || '-', 'email-cell');
    appendTextCell(row, email.customerName || '-');
    appendTextCell(row, email.orderCode || '-');
    const isStuck = !email.lastLoginAt || Number(email.quotaUsed || 0) <= 0;
    const statusCell = document.createElement('td');
    statusCell.append(renderStatusPill(email.usageStatus || 'Chưa rõ', isStuck));
    row.append(statusCell);
    appendTextCell(row, formatDate(email.lastLoginAt));
    appendTextCell(row, `${Number(email.quotaUsed || 0)}/${Number(email.quotaTotal || 0)} ảnh`);
    appendTextCell(row, email.recommendedAction || '-', 'prompt-cell');
    appendTextCell(row, email.planName || '-');
    appendTextCell(row, formatShortDate(email.expiresAt));
    return row;
  }));
};

const renderEmailSequences = () => {
  const flow = sequenceFlowFilter?.value || 'free';
  const rows = emailSequences.filter((item) => item.flow === flow);
  const flowLabel = flow === 'free' ? 'Free -> trả phí' : 'Trả phí -> hỗ trợ/gia hạn';

  if (sequenceCount) {
    sequenceCount.textContent = `${flowLabel}: ${rows.length} bước`;
  }

  sequenceBody.replaceChildren(...rows.map((item) => {
    const row = document.createElement('tr');
    appendTextCell(row, `Ngày ${item.day}`);
    appendTextCell(row, item.stage || '-');
    appendTextCell(row, item.trigger || '-', 'prompt-cell');
    appendTextCell(row, item.subject || '-', 'prompt-cell');
    appendTextCell(row, item.goal || '-', 'prompt-cell');
    appendTextCell(row, item.action || '-', 'prompt-cell');
    return row;
  }));
};

const renderAgentInsights = () => {
  const lowQuota = cachedUsers.filter((user) => user.role !== 'admin' && Math.max(0, Number(user.quotaTotal || 0) - Number(user.quotaUsed || 0)) <= 5);
  const expiring = cachedUsers.filter((user) => {
    const daysLeft = getDaysLeft(user.expiresAt);
    return user.role !== 'admin' && daysLeft !== null && daysLeft >= 0 && daysLeft <= 3;
  });
  const inactive = cachedUsers.filter((user) => user.role !== 'admin' && !user.activatedAt && user.status === 'active');
  const recentFailures = cachedEvents.filter((event) => !event.ok).slice(0, 5);
  const items = [
    { level: lowQuota.length ? 'warning' : 'ok', title: 'Quota thấp', text: lowQuota.length ? `${lowQuota.length} tài khoản còn từ 5 ảnh trở xuống.` : 'Quota thành viên đang ổn.' },
    { level: expiring.length ? 'warning' : 'ok', title: 'Sắp hết hạn', text: expiring.length ? `${expiring.length} tài khoản hết hạn trong 3 ngày tới.` : 'Chưa có tài khoản sắp hết hạn.' },
    { level: inactive.length ? 'info' : 'ok', title: 'Chưa kích hoạt', text: inactive.length ? `${inactive.length} tài khoản đã cấp nhưng thành viên chưa dùng lần đầu.` : 'Tài khoản đã cấp đều đã có hoạt động.' },
    { level: recentFailures.length ? 'danger' : 'ok', title: 'Lỗi gần đây', text: recentFailures.length ? `${recentFailures.length} lỗi mới nhất cần kiểm tra trong lịch sử tạo ảnh.` : 'Không có lỗi mới trong danh sách gần đây.' }
  ];

  agentInsights.replaceChildren(...items.map((item) => {
    const card = document.createElement('article');
    card.className = `insight ${item.level}`;
    card.innerHTML = `<strong>${item.title}</strong><span>${item.text}</span>`;
    return card;
  }));
};

const loadRouterQuota = async () => {
  try {
    const quota = await api(`${ADMIN_API}/router-quota`);
    const remaining = quota.quotaRemaining == null ? '-' : Number(quota.quotaRemaining).toLocaleString('vi-VN');
    const total = quota.quotaTotal == null ? '' : ` / ${Number(quota.quotaTotal).toLocaleString('vi-VN')}`;
    document.querySelector('#statRouterQuota').textContent = `${remaining}${total}`;
    document.querySelector('#routerQuotaSource').textContent = quota.source === '9router' ? 'Theo 9Router' : 'Theo cấu hình/backend';
  } catch (error) {
    document.querySelector('#statRouterQuota').textContent = '-';
    document.querySelector('#routerQuotaSource').textContent = error.message;
  }
};

const loginAdmin = async ({ email, password }) => {
  const result = await api(`${USER_API}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      deviceId: `web-admin-${navigator.userAgent.slice(0, 80)}`
    })
  });

  if (result.user?.role !== 'admin') {
    throw new Error('Tài khoản này không có quyền admin.');
  }

  if (result.requiresTwoFactor || result.requiresTwoFactorSetup) {
    token = '';
    currentAdmin = null;
    localStorage.removeItem('adminToken');
    showTwoFactorFlow(result);
    return null;
  }

  token = result.token;
  currentAdmin = result.user;
  localStorage.setItem('adminToken', token);
  resetTwoFactorFlow();
  return result.user;
};

const verifyTwoFactor = async () => {
  if (!pendingTwoFactor?.tempToken) {
    throw new Error('Vui lòng đăng nhập lại để xác thực 2FA.');
  }

  const code = twoFactorCode.value.replace(/\D/g, '');
  if (code.length !== 6) {
    throw new Error('Nhập mã 2FA gồm 6 số.');
  }

  const result = await api(`${USER_API}/auth/2fa/verify`, {
    method: 'POST',
    body: JSON.stringify({
      tempToken: pendingTwoFactor.tempToken,
      code,
      deviceId: `web-admin-${navigator.userAgent.slice(0, 80)}`
    })
  });

  token = result.token;
  currentAdmin = result.user;
  localStorage.setItem('adminToken', token);
  resetTwoFactorFlow();
  return result.user;
};

const loadCurrentAdmin = async () => {
  if (!token) return null;
  const result = await api(`${USER_API}/auth/me`);
  if (result.user?.role !== 'admin') {
    throw new Error('Token hiện tại không có quyền admin.');
  }
  currentAdmin = result.user;
  return result.user;
};

const loadDashboard = async () => {
  const [stats, users, events, emailHistory] = await Promise.all([
    api(`${ADMIN_API}/stats`),
    api(`${ADMIN_API}/users`),
    api(`${ADMIN_API}/events?limit=200`),
    api(`${ADMIN_API}/email-history?limit=300`)
  ]);

  cachedUsers = users.users || [];
  cachedEvents = events.events || [];
  cachedEmailHistory = emailHistory.emails || [];
  setLoggedIn(true, currentAdmin);
  document.querySelector('#statUsers').textContent = stats.users;
  document.querySelector('#statActive').textContent = stats.activeUsers;
  document.querySelector('#statImages').textContent = stats.imagesCreated;
  document.querySelector('#statToday').textContent = stats.imagesToday;
  document.querySelector('#statFailures').textContent = stats.failures;
  document.querySelector('#lastUpdated').textContent = `Cập nhật ${new Date().toLocaleTimeString('vi-VN')}`;
  renderUsers();
  renderEvents(cachedEvents);
  renderEmailHistory(cachedEmailHistory);
  renderEmailSequences();
  renderAgentInsights();
  await loadRouterQuota();
};

const updateUser = async (id, changes) => {
  await api(`${ADMIN_API}/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(changes)
  });
  await loadDashboard();
};

document.querySelectorAll('.preset').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelector('#newQuota').value = button.dataset.quota;
    document.querySelector('#newDurationDays').value = button.dataset.days;
    document.querySelector('#newDeviceLimit').value = button.dataset.devices;
    activePlanFilter = activePlanFilter === button.dataset.plan ? 'all' : button.dataset.plan;
    roleFilter.value = 'user';
    renderUsers();
  });
});

[userSearch, statusFilter, roleFilter].forEach((control) => {
  control.addEventListener('input', renderUsers);
  control.addEventListener('change', renderUsers);
});

sequenceFlowFilter?.addEventListener('change', renderEmailSequences);

adminLogin.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginStatus.textContent = 'Đang đăng nhập...';

  try {
    const user = await loginAdmin({ email: emailInput.value.trim(), password: passwordInput.value });
    passwordInput.value = '';
    if (user) {
      loginStatus.textContent = '';
      await loadDashboard();
    } else {
      loginStatus.textContent = pendingTwoFactor?.setup
        ? 'Quét/thêm khóa 2FA rồi nhập mã 6 số để hoàn tất.'
        : 'Nhập mã 2FA để vào trang quản trị.';
    }
  } catch (error) {
    token = '';
    currentAdmin = null;
    localStorage.removeItem('adminToken');
    loginStatus.textContent = error.message;
  }
});

verifyTwoFactorButton.addEventListener('click', async () => {
  verifyTwoFactorButton.disabled = true;
  loginStatus.textContent = 'Đang xác thực 2FA...';

  try {
    await verifyTwoFactor();
    loginStatus.textContent = '';
    await loadDashboard();
  } catch (error) {
    loginStatus.textContent = error.message;
    verifyTwoFactorButton.disabled = false;
  }
});

twoFactorCode.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    verifyTwoFactorButton.click();
  }
});

createUserForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  createStatus.textContent = 'Đang thêm...';

  try {
    await api(`${ADMIN_API}/users`, {
      method: 'POST',
      body: JSON.stringify({
        email: document.querySelector('#newEmail').value.trim(),
        password: document.querySelector('#newPassword').value,
        quotaTotal: Number(document.querySelector('#newQuota').value || 0),
        durationDays: Number(document.querySelector('#newDurationDays').value || 0),
        expiresAt: document.querySelector('#newExpiresAt').value || null,
        deviceLimit: Number(document.querySelector('#newDeviceLimit').value || 1),
        planName: activePlanFilter !== 'all' ? planLabels[activePlanFilter] : undefined,
        role: document.querySelector('#newRole').value
      })
    });
    createUserForm.reset();
    document.querySelector('#newQuota').value = 100;
    document.querySelector('#newDurationDays').value = 30;
    document.querySelector('#newDeviceLimit').value = 1;
    createStatus.textContent = 'Đã thêm tài khoản.';
    await loadDashboard();
  } catch (error) {
    createStatus.textContent = error.message;
  }
});

logoutButton.addEventListener('click', () => {
  token = '';
  currentAdmin = null;
  localStorage.removeItem('adminToken');
  resetTwoFactorFlow();
  setLoggedIn(false);
});

refreshButton.addEventListener('click', () => {
  refreshButton.disabled = true;
  loadDashboard()
    .catch((error) => { adminEmail.textContent = error.message; })
    .finally(() => { refreshButton.disabled = false; });
});

setLoggedIn(false);
resetTwoFactorFlow();
loadCurrentAdmin()
  .then((user) => user ? loadDashboard() : null)
  .catch(() => {
    token = '';
    currentAdmin = null;
    localStorage.removeItem('adminToken');
    resetTwoFactorFlow();
    setLoggedIn(false);
  });
