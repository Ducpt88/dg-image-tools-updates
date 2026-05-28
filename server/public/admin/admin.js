const loginView = document.querySelector('#loginView');
const dashboardView = document.querySelector('#dashboardView');
const adminLogin = document.querySelector('#adminLogin');
const emailInput = document.querySelector('#email');
const passwordInput = document.querySelector('#password');
const loginStatus = document.querySelector('#loginStatus');
const adminEmail = document.querySelector('#adminEmail');
const logoutButton = document.querySelector('#logout');
const refreshButton = document.querySelector('#refresh');
const createUserForm = document.querySelector('#createUser');
const createStatus = document.querySelector('#createStatus');
const usersBody = document.querySelector('#usersBody');
const eventsBody = document.querySelector('#eventsBody');
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
let activePlanFilter = 'all';

const planLabels = {
  all: 'Tất cả gói',
  trial: 'Dùng thử',
  monthly: 'Gói tháng',
  vip: 'VIP'
};

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

  token = result.token;
  currentAdmin = result.user;
  localStorage.setItem('adminToken', token);
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
  const [stats, users, events] = await Promise.all([
    api(`${ADMIN_API}/stats`),
    api(`${ADMIN_API}/users`),
    api(`${ADMIN_API}/events?limit=200`)
  ]);

  cachedUsers = users.users || [];
  cachedEvents = events.events || [];
  setLoggedIn(true, currentAdmin);
  document.querySelector('#statUsers').textContent = stats.users;
  document.querySelector('#statActive').textContent = stats.activeUsers;
  document.querySelector('#statImages').textContent = stats.imagesCreated;
  document.querySelector('#statToday').textContent = stats.imagesToday;
  document.querySelector('#statFailures').textContent = stats.failures;
  document.querySelector('#lastUpdated').textContent = `Cập nhật ${new Date().toLocaleTimeString('vi-VN')}`;
  renderUsers();
  renderEvents(cachedEvents);
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

adminLogin.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginStatus.textContent = 'Đang đăng nhập...';

  try {
    await loginAdmin({ email: emailInput.value.trim(), password: passwordInput.value });
    passwordInput.value = '';
    loginStatus.textContent = '';
    await loadDashboard();
  } catch (error) {
    token = '';
    currentAdmin = null;
    localStorage.removeItem('adminToken');
    loginStatus.textContent = error.message;
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
  setLoggedIn(false);
});

refreshButton.addEventListener('click', () => {
  refreshButton.disabled = true;
  loadDashboard()
    .catch((error) => { adminEmail.textContent = error.message; })
    .finally(() => { refreshButton.disabled = false; });
});

setLoggedIn(false);
loadCurrentAdmin()
  .then((user) => user ? loadDashboard() : null)
  .catch(() => {
    token = '';
    currentAdmin = null;
    localStorage.removeItem('adminToken');
    setLoggedIn(false);
  });
