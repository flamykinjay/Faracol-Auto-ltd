/**
 * driver-dashboard.js
 * ----------------------------------------------------------------
 * Page-specific logic for driver/dashboard.html.
 *
 * MY REPORTS TAB: shows every report this driver has submitted,
 * their current status (open/resolved), and the admin's written
 * reply if one has been given — reading the same adminReply and
 * replyDate fields the admin writes to on reports.html. This is
 * the driver-facing half of the two-way communication feature.
 *
 * ROLE GUARD: requires an active session with role === "driver".
 * An admin session gets redirected to the admin dashboard instead.
 *
 * NOTE: USERS_COLLECTION is already declared in ../js/auth.js and
 * intentionally not redeclared here.
 *
 * Depends on: ../js/utils.js, ../js/storage.js, ../js/auth.js,
 * js/driver-nav.js (all loaded before this file).
 * ----------------------------------------------------------------
 */

const PAYMENTS_COLLECTION = 'payments';
const WEEKS_COLLECTION = 'weeks';
const VEHICLES_COLLECTION = 'vehicles';
const DRIVERS_COLLECTION = 'drivers';
const NEWS_COLLECTION = 'newsPosts';
const DRIVER_LOGS_COLLECTION = 'driverLogs';

let myDriverId = null;

function formatCurrency(amount) {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch (error) {
    return `₦${amount}`;
  }
}

function populateStatCards() {
  const openWeek = findRecord(WEEKS_COLLECTION, (record) => record.status === 'open');
  const myPayment = openWeek
    ? findRecord(PAYMENTS_COLLECTION, (p) => p.weekId === openWeek.id && p.driverId === myDriverId)
    : null;

  if (myPayment) {
    const balance = Math.max(myPayment.targetAmount - myPayment.amountPaid, 0);
    $('#stat-week-target').textContent = formatCurrency(myPayment.targetAmount);
    $('#stat-week-paid').textContent = formatCurrency(myPayment.amountPaid);
    $('#stat-week-balance').textContent = formatCurrency(balance);
  } else {
    $('#stat-week-target').textContent = '₦0';
    $('#stat-week-paid').textContent = '₦0';
    $('#stat-week-balance').textContent = '₦0';
  }

  const driver = findRecord(DRIVERS_COLLECTION, (record) => record.id === myDriverId);
  const vehicle = driver ? findRecord(VEHICLES_COLLECTION, (record) => record.id === driver.vehicleId) : null;
  $('#stat-my-vehicle').textContent = vehicle ? `${vehicle.type}` : 'None Assigned';
}

function renderMyHistory() {
  const payments = getCollection(PAYMENTS_COLLECTION)
    .filter((p) => p.driverId === myDriverId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const weeks = getCollection(WEEKS_COLLECTION);
  const table = $('#my-history-table');
  const emptyState = $('#my-history-empty-state');
  const tableBody = $('#my-history-table-body');

  if (payments.length === 0) {
    table.hidden = true;
    emptyState.hidden = false;
    return;
  }

  table.hidden = false;
  emptyState.hidden = true;

  tableBody.innerHTML = payments
    .map((payment) => {
      const week = weeks.find((w) => w.id === payment.weekId);
      const balance = Math.max(payment.targetAmount - payment.amountPaid, 0);
      const balanceClass = balance > 0 ? 'balance-owing' : 'balance-clear';
      const statusKey = payment.status === 'paid' ? 'paid' : payment.status === 'partial' ? 'sick' : 'owing';

      return `
        <tr>
          <td>${week ? week.label : 'Past Week'}</td>
          <td>${formatCurrency(payment.targetAmount)}</td>
          <td>${formatCurrency(payment.amountPaid)}</td>
          <td class="${balanceClass}">${formatCurrency(balance)}</td>
          <td><span class="status-badge status-badge-${statusKey}">${payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}</span></td>
        </tr>
      `;
    })
    .join('');
}

/**
 * ----------------------------------------------------------------
 * MY REPORTS TAB
 * ----------------------------------------------------------------
 */

function buildMyReportCard(log) {
  const statusBadge = log.status === 'resolved'
    ? '<span class="status-badge status-badge-paid">Resolved</span>'
    : '<span class="status-badge status-badge-owing">Open</span>';

  const replySection = log.adminReply
    ? `
      <div class="reply-block">
        <span class="reply-block-label">Admin Reply</span>
        <p class="reply-block-text">${log.adminReply}</p>
      </div>
    `
    : `<p class="reply-block-pending">No reply yet — the admin will respond here once reviewed.</p>`;

  return `
    <div class="news-card">
      <div class="news-card-header">
        <span class="news-card-title">${log.category}</span>
        <span class="news-card-date">${new Date(log.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
      </div>
      <div class="news-card-body">${log.message}</div>
      <div style="margin-top: 8px;">${statusBadge}</div>
      ${replySection}
    </div>
  `;
}

function renderMyReports() {
  const logs = getCollection(DRIVER_LOGS_COLLECTION)
    .filter((log) => log.driverId === myDriverId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const list = $('#my-reports-list');
  const emptyState = $('#my-reports-empty-state');

  if (logs.length === 0) {
    list.hidden = true;
    emptyState.hidden = false;
    return;
  }

  list.hidden = false;
  emptyState.hidden = true;
  list.innerHTML = logs.map(buildMyReportCard).join('');
}

function renderDriverNews() {
  const posts = getCollection(NEWS_COLLECTION).slice().sort((a, b) => new Date(b.datePosted) - new Date(a.datePosted));
  const feed = $('#driver-news-feed');
  const emptyState = $('#driver-news-empty-state');

  if (posts.length === 0) {
    feed.hidden = true;
    emptyState.hidden = false;
    return;
  }

  feed.hidden = false;
  emptyState.hidden = true;

  feed.innerHTML = posts
    .map((post) => {
      const imageHtml = post.imageBase64 ? `<img src="${post.imageBase64}" class="news-card-image" alt="${post.title}">` : '';
      return `
        <div class="news-card">
          <div class="news-card-header">
            <span class="news-card-title">${post.title}</span>
            <span class="news-card-date">${new Date(post.datePosted).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
          <div class="news-card-body">${post.body}</div>
          ${imageHtml}
        </div>
      `;
    })
    .join('');
}

function handleLogSubmit(event) {
  event.preventDefault();

  const messageInput = $('#log-message');
  clearFieldError(messageInput, $('#log-message-error'));

  if (!messageInput.value.trim()) {
    showFieldError(messageInput, $('#log-message-error'), 'Please enter a message.');
    return;
  }

  const driver = findRecord(DRIVERS_COLLECTION, (record) => record.id === myDriverId);

  addRecord(DRIVER_LOGS_COLLECTION, {
    id: generateId(),
    driverId: myDriverId,
    driverName: driver ? driver.name : 'Unknown Driver',
    category: $('#log-category').value,
    message: messageInput.value.trim(),
    status: 'open',
    adminReply: '',
    replyDate: null,
    date: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });

  $('#submit-log-form').reset();
  const statusEl = $('#log-submit-status');
  statusEl.textContent = 'Report submitted. The admin will review it soon.';
  statusEl.className = 'settings-status settings-status-success';

  // Refresh "My Reports" immediately so the new submission shows up
  // without needing a manual tab switch.
  renderMyReports();
}

function switchDriverTab(tab) {
  $('#tab-history-view').classList.toggle('page-tab-active', tab === 'history');
  $('#tab-my-reports-view').classList.toggle('page-tab-active', tab === 'my-reports');
  $('#tab-news-view').classList.toggle('page-tab-active', tab === 'news');
  $('#tab-log-view').classList.toggle('page-tab-active', tab === 'submit-log');

  $('#history-tab-content').hidden = tab !== 'history';
  $('#my-reports-tab-content').hidden = tab !== 'my-reports';
  $('#news-tab-content').hidden = tab !== 'news';
  $('#log-tab-content').hidden = tab !== 'submit-log';
}

document.addEventListener('DOMContentLoaded', () => {
  const session = getActiveSession();

  if (!session) {
    window.location.href = '../index.html';
    return;
  }

  if (session.role !== 'driver') {
    window.location.href = '../dashboard.html';
    return;
  }

  myDriverId = session.linkedDriverId;

  if (!myDriverId) {
    logout();
    return;
  }

  renderDriverSidebar(session);

  $('#header-greeting').textContent = `Welcome back, ${session.name}`;
  $('#header-date').textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  populateStatCards();
  renderMyHistory();
  renderMyReports();
  renderDriverNews();

  $('#tab-history-view').addEventListener('click', () => switchDriverTab('history'));
  $('#tab-my-reports-view').addEventListener('click', () => switchDriverTab('my-reports'));
  $('#tab-news-view').addEventListener('click', () => switchDriverTab('news'));
  $('#tab-log-view').addEventListener('click', () => switchDriverTab('submit-log'));

  $('#submit-log-form').addEventListener('submit', handleLogSubmit);
});