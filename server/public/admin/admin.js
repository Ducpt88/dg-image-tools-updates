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
const ADMIN_API = '/api/9router/admin';

let token = '';

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
  adminEmail.textContent = user?.email || '';
};

const formatDate = (value) => value ? new Date(value).toLocaleString('vi-VN') : '-';

const loadDashboard = async () => {
  const [stats, users, events] = await Promise.all([
    api(`${ADMIN_API}/stats`),
    api(`${ADMIN_API}/users`),
    api(`${ADMIN_API}/events?limit=200`)
  ]);

  setLoggedIn(true, { email: 'Local Admin' });
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
    const tr = document.createElement('tr');
    const remaining = Math.max(0, Number(user.quotaTotal || 0) - Number(user.quotaUsed || 0));
    tr.innerHTML = `
      <td>${user.email}</td>
      <td>${user.role}</td>
      <td><span class="pill ${user.status === 'active' ? '' : 'blocked'}">${user.status}</span></td>
      <td>${user.quotaUsed}/${user.quotaTotal} còn ${remaining}</td>
      <td>${user.expiresAt || '-'}</td>
      <td>${(user.devices || []).length}/${user.deviceLimit}</td>
      <td>${formatDate(user.lastLoginAt)}</td>
      <td></td>
    `;

    const actions = document.createElement('div');
    actions.className = 'row-actions';
    actions.append(
      actionButton(user.status === 'active' ? 'Khóa' : 'Mở', 'danger', () => updateUser(user.id, { status: user.status === 'active' ? 'blocked' : 'active' })),
      actionButton('Reset quota', 'secondary', () => updateUser(user.id, { quotaUsed: 0 })),
      actionButton('Xóa thiết bị', 'secondary', () => updateUser(user.id, { clearDevices: true })),
      actionButton('+100 quota', 'secondary', () => updateUser(user.id, { quotaTotal: Number(user.quotaTotal || 0) + 100 }))
    );
    tr.lastElementChild.append(actions);
    return tr;
  }));
};

const renderEvents = (events) => {
  eventsBody.replaceChildren(...events.map((event) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDate(event.createdAt)}</td>
      <td>${event.email}</td>
      <td><span class="pill ${event.ok ? '' : 'blocked'}">${event.ok ? 'OK' : 'Lỗi'}</span></td>
      <td>${event.deviceId || '-'}</td>
      <td class="prompt-cell" title="${event.error || event.prompt || ''}">${event.error || event.prompt || ''}</td>
    `;
    return tr;
  }));
};

const actionButton = (label, className, onClick) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
};

const updateUser = async (id, changes) => {
  await api(`${ADMIN_API}/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(changes)
  });
  await loadDashboard();
};

adminLogin.addEventListener('submit', (event) => {
  event.preventDefault();
  loadDashboard().catch((error) => {
    loginStatus.textContent = error.message;
  });
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
        expiresAt: document.querySelector('#newExpiresAt').value || null,
        deviceLimit: Number(document.querySelector('#newDeviceLimit').value || 1),
        role: document.querySelector('#newRole').value
      })
    });
    createUserForm.reset();
    document.querySelector('#newQuota').value = 100;
    document.querySelector('#newDeviceLimit').value = 1;
    createStatus.textContent = 'Đã thêm.';
    await loadDashboard();
  } catch (error) {
    createStatus.textContent = error.message;
  }
});

logoutButton.addEventListener('click', () => {
  token = '';
  localStorage.removeItem('adminToken');
  loadDashboard().catch((error) => {
    adminEmail.textContent = error.message;
  });
});

refreshButton.addEventListener('click', loadDashboard);

localStorage.removeItem('adminToken');
logoutButton.hidden = true;
loadDashboard().catch((error) => {
  setLoggedIn(true, { email: error.message });
});
