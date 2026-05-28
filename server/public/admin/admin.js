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
const USER_API = '/api/9router/user';
const ADMIN_API = '/api/9router/admin';

let token = localStorage.getItem('adminToken') || '';
let currentAdmin = null;

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
    throw new Error(body.message || 'Yeu cau that bai.');
  }

  return body;
};

const setLoggedIn = (loggedIn, user = null) => {
  loginView.classList.toggle('hidden', loggedIn);
  dashboardView.classList.toggle('hidden', !loggedIn);
  adminEmail.textContent = user?.email || '';
  logoutButton.hidden = !loggedIn;
};

const formatDate = (value) => value ? new Date(value).toLocaleString('vi-VN') : '-';

const appendTextCell = (row, value, className = '') => {
  const cell = document.createElement('td');
  if (className) {
    cell.className = className;
  }
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
    throw new Error('Tai khoan nay khong co quyen admin.');
  }

  token = result.token;
  currentAdmin = result.user;
  localStorage.setItem('adminToken', token);
  return result.user;
};

const loadCurrentAdmin = async () => {
  if (!token) {
    return null;
  }

  const result = await api(`${USER_API}/auth/me`);
  if (result.user?.role !== 'admin') {
    throw new Error('Token hien tai khong co quyen admin.');
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

  setLoggedIn(true, currentAdmin);
  document.querySelector('#statUsers').textContent = stats.users;
  document.querySelector('#statActive').textContent = stats.activeUsers;
  document.querySelector('#statImages').textContent = stats.imagesCreated;
  document.querySelector('#statToday').textContent = stats.imagesToday;
  document.querySelector('#statFailures').textContent = stats.failures;
  renderUsers(users.users);
  renderEvents(events.events);
};

const renderUsers = (users) => {
  usersBody.replaceChildren(...users.map((user) => {
    const row = document.createElement('tr');
    const remaining = Math.max(0, Number(user.quotaTotal || 0) - Number(user.quotaUsed || 0));

    appendTextCell(row, user.email);
    appendTextCell(row, user.role);

    const statusCell = document.createElement('td');
    statusCell.append(renderStatusPill(user.status, user.status !== 'active'));
    row.append(statusCell);

    appendTextCell(row, `${user.quotaUsed}/${user.quotaTotal} con ${remaining}`);
    appendTextCell(row, user.expiresAt || '-');
    appendTextCell(row, `${(user.devices || []).length}/${user.deviceLimit}`);
    appendTextCell(row, formatDate(user.lastLoginAt));

    const actionsCell = document.createElement('td');
    const actions = document.createElement('div');
    actions.className = 'row-actions';
    actions.append(
      actionButton(user.status === 'active' ? 'Khoa' : 'Mo', 'danger', () => updateUser(user.id, { status: user.status === 'active' ? 'blocked' : 'active' })),
      actionButton('Reset quota', 'secondary', () => updateUser(user.id, { quotaUsed: 0 })),
      actionButton('Xoa thiet bi', 'secondary', () => updateUser(user.id, { clearDevices: true })),
      actionButton('+100 quota', 'secondary', () => updateUser(user.id, { quotaTotal: Number(user.quotaTotal || 0) + 100 }))
    );
    actionsCell.append(actions);
    row.append(actionsCell);
    return row;
  }));
};

const renderEvents = (events) => {
  eventsBody.replaceChildren(...events.map((event) => {
    const row = document.createElement('tr');
    appendTextCell(row, formatDate(event.createdAt));
    appendTextCell(row, event.email);

    const statusCell = document.createElement('td');
    statusCell.append(renderStatusPill(event.ok ? 'OK' : 'Loi', !event.ok));
    row.append(statusCell);

    appendTextCell(row, event.deviceId || '-');
    const promptCell = appendTextCell(row, event.error || event.prompt || '', 'prompt-cell');
    promptCell.title = event.error || event.prompt || '';
    return row;
  }));
};

const updateUser = async (id, changes) => {
  await api(`${ADMIN_API}/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(changes)
  });
  await loadDashboard();
};

adminLogin.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginStatus.textContent = 'Dang dang nhap...';

  try {
    await loginAdmin({
      email: emailInput.value.trim(),
      password: passwordInput.value
    });
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
  createStatus.textContent = 'Dang them...';

  try {
    await api(`${ADMIN_API}/users`, {
      method: 'POST',
      body: JSON.stringify({
        email: document.querySelector('#newEmail').value.trim(),
        password: document.querySelector('#newPassword').value,
        quotaTotal: Number(document.querySelector('#newQuota').value || 0),
        expiresAt: document.querySelector('#newExpiresAt').value || null,
        deviceLimit: Number(document.querySelector('#newDeviceLimit').value || 1),
        role: document.querySelector('#newRole').value
      })
    });
    createUserForm.reset();
    document.querySelector('#newQuota').value = 100;
    document.querySelector('#newDeviceLimit').value = 1;
    createStatus.textContent = 'Da them.';
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
  loadDashboard().catch((error) => {
    adminEmail.textContent = error.message;
  });
});

setLoggedIn(false);
loadCurrentAdmin()
  .then((user) => {
    if (user) {
      return loadDashboard();
    }
    return null;
  })
  .catch(() => {
    token = '';
    currentAdmin = null;
    localStorage.removeItem('adminToken');
    setLoggedIn(false);
  });
