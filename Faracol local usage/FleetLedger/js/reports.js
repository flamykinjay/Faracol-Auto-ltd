/**
 * reports.js
 * ----------------------------------------------------------------
 * Page-specific logic for reports.html.
 *
 * DRIVER LOGS — REPLY FEATURE: alongside the open/resolved status
 * toggle, the admin can now write a reply to any driver report.
 * The reply (adminReply, replyDate) is stored on the same
 * driverLogs record and is read directly by the driver's own
 * dashboard (driver/js/driver-dashboard.js) — this is the only
 * two-way communication channel between admin and driver in the
 * app so far.
 *
 * NOTE: USERS_COLLECTION is not needed on this page and is not
 * declared here to avoid clashing with auth.js's declaration.
 *
 * Depends on: utils.js, storage.js, auth.js, nav.js, and
 * js/vendor/chart.min.js (self-hosted, loaded before this file).
 * ----------------------------------------------------------------
 */

const DRIVERS_COLLECTION = 'drivers';
const PAYMENTS_COLLECTION = 'payments';
const EXPENSES_COLLECTION = 'expenses';
const WEEKS_COLLECTION = 'weeks';
const NEWS_COLLECTION = 'newsPosts';
const DRIVER_LOGS_COLLECTION = 'driverLogs';

let currentRangeStart = null;
let currentRangeEnd = null;
let currentlyEditingNewsId = null;
let pendingDeleteNewsId = null;
let pendingNewsImageBase64 = null;
let pendingReplyLogId = null;

let collectionsExpensesChart = null;
let paymentStatusChart = null;
let cumulativeChart = null;

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

function getFilteredWeeks() {
  const weeks = getCollection(WEEKS_COLLECTION).slice().sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  if (!currentRangeStart && !currentRangeEnd) {
    return weeks;
  }

  return weeks.filter((week) => {
    const weekStart = week.startDate.split('T')[0];
    if (currentRangeStart && weekStart < currentRangeStart) return false;
    if (currentRangeEnd && weekStart > currentRangeEnd) return false;
    return true;
  });
}

/**
 * ----------------------------------------------------------------
 * CHARTS
 * ----------------------------------------------------------------
 */

function renderCollectionsExpensesChart() {
  const weeks = getFilteredWeeks();
  const allPayments = getCollection(PAYMENTS_COLLECTION);
  const allExpenses = getCollection(EXPENSES_COLLECTION);

  const labels = weeks.map((week) => week.label);
  const collectedData = weeks.map((week) =>
    allPayments.filter((p) => p.weekId === week.id).reduce((sum, p) => sum + p.amountPaid, 0)
  );
  const expensesData = weeks.map((week) => {
    const start = week.startDate.split('T')[0];
    const end = week.endDate.split('T')[0];
    return allExpenses.filter((e) => e.date >= start && e.date <= end).reduce((sum, e) => sum + e.amount, 0);
  });

  const ctx = $('#collections-expenses-chart').getContext('2d');

  if (collectionsExpensesChart) {
    collectionsExpensesChart.destroy();
  }

  collectionsExpensesChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Collected', data: collectedData, backgroundColor: '#2dd4bf' },
        { label: 'Expenses', data: expensesData, backgroundColor: '#f87171' },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#f1f5f9' } } },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
        y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
      },
    },
  });
}

function renderPaymentStatusChart() {
  const openWeek = findRecord(WEEKS_COLLECTION, (record) => record.status === 'open');
  const payments = openWeek
    ? getCollection(PAYMENTS_COLLECTION).filter((p) => p.weekId === openWeek.id)
    : [];

  const paidCount = payments.filter((p) => p.status === 'paid').length;
  const partialCount = payments.filter((p) => p.status === 'partial').length;
  const unpaidCount = payments.filter((p) => p.status === 'unpaid').length;

  const ctx = $('#payment-status-chart').getContext('2d');

  if (paymentStatusChart) {
    paymentStatusChart.destroy();
  }

  paymentStatusChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Paid', 'Partial', 'Unpaid'],
      datasets: [{
        data: [paidCount, partialCount, unpaidCount],
        backgroundColor: ['#4ade80', '#fbbf24', '#f87171'],
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: '#f1f5f9' } } },
    },
  });
}

function renderCumulativeChart() {
  const weeks = getFilteredWeeks();
  const allPayments = getCollection(PAYMENTS_COLLECTION);
  const allExpenses = getCollection(EXPENSES_COLLECTION);

  let runningRevenue = 0;
  let runningExpenses = 0;

  const labels = [];
  const revenueData = [];
  const expensesData = [];

  weeks.forEach((week) => {
    const weekCollected = allPayments.filter((p) => p.weekId === week.id).reduce((sum, p) => sum + p.amountPaid, 0);
    const start = week.startDate.split('T')[0];
    const end = week.endDate.split('T')[0];
    const weekExpenses = allExpenses.filter((e) => e.date >= start && e.date <= end).reduce((sum, e) => sum + e.amount, 0);

    runningRevenue += weekCollected;
    runningExpenses += weekExpenses;

    labels.push(week.label);
    revenueData.push(runningRevenue);
    expensesData.push(runningExpenses);
  });

  const ctx = $('#cumulative-chart').getContext('2d');

  if (cumulativeChart) {
    cumulativeChart.destroy();
  }

  cumulativeChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Cumulative Revenue', data: revenueData, borderColor: '#2dd4bf', backgroundColor: 'rgba(45,212,191,0.1)', fill: true, tension: 0.3 },
        { label: 'Cumulative Expenses', data: expensesData, borderColor: '#f87171', backgroundColor: 'rgba(248,113,113,0.1)', fill: true, tension: 0.3 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#f1f5f9' } } },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
        y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
      },
    },
  });
}

function renderAllCharts() {
  renderCollectionsExpensesChart();
  renderPaymentStatusChart();
  renderCumulativeChart();
}

/**
 * ----------------------------------------------------------------
 * TOP OUTSTANDING DRIVERS
 * ----------------------------------------------------------------
 */

function renderOutstandingDrivers() {
  const weeks = getFilteredWeeks();
  const weekIds = new Set(weeks.map((w) => w.id));
  const payments = getCollection(PAYMENTS_COLLECTION).filter((p) => weekIds.has(p.weekId));

  const totalsByDriver = {};
  payments.forEach((payment) => {
    const balance = Math.max(payment.targetAmount - payment.amountPaid, 0);
    if (balance <= 0) return;
    totalsByDriver[payment.driverName] = (totalsByDriver[payment.driverName] || 0) + balance;
  });

  const ranked = Object.entries(totalsByDriver)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const tableBody = $('#outstanding-table-body');
  const table = $('#outstanding-table');
  const emptyState = $('#outstanding-empty-state');

  if (ranked.length === 0) {
    table.hidden = true;
    emptyState.hidden = false;
    tableBody.innerHTML = '';
    return;
  }

  table.hidden = false;
  emptyState.hidden = true;
  tableBody.innerHTML = ranked
    .map(([name, total], index) => `
      <tr>
        <td>#${index + 1}</td>
        <td>${name}</td>
        <td class="balance-owing">${formatCurrency(total)}</td>
      </tr>
    `)
    .join('');
}

/**
 * ----------------------------------------------------------------
 * DRIVER PAYMENT HISTORY
 * ----------------------------------------------------------------
 */

function populateHistoryDriverSelect() {
  const drivers = getCollection(DRIVERS_COLLECTION);
  const select = $('#history-driver-select');
  select.innerHTML = '<option value="">— Select a driver —</option>' +
    drivers.map((driver) => `<option value="${driver.id}">${driver.name}</option>`).join('');
}

function renderDriverHistory(driverId) {
  const table = $('#history-table');
  const emptyState = $('#history-empty-state');
  const tableBody = $('#history-table-body');

  if (!driverId) {
    table.hidden = true;
    emptyState.hidden = false;
    return;
  }

  const payments = getCollection(PAYMENTS_COLLECTION)
    .filter((p) => p.driverId === driverId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const weeks = getCollection(WEEKS_COLLECTION);

  if (payments.length === 0) {
    table.hidden = true;
    emptyState.hidden = false;
    emptyState.querySelector('p').textContent = 'No payment history found for this driver yet.';
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
          <td>${week ? week.label : 'Deleted Week'}</td>
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
 * DRIVER LOGS (admin inbox, with reply)
 * ----------------------------------------------------------------
 */

function renderDriverLogs() {
  const filter = $('#log-status-filter').value;
  let logs = getCollection(DRIVER_LOGS_COLLECTION).slice().sort((a, b) => new Date(b.date) - new Date(a.date));

  if (filter !== 'all') {
    logs = logs.filter((log) => log.status === filter);
  }

  const table = $('#logs-table');
  const emptyState = $('#logs-empty-state');
  const tableBody = $('#logs-table-body');

  if (logs.length === 0) {
    table.hidden = true;
    emptyState.hidden = false;
    tableBody.innerHTML = '';
    return;
  }

  table.hidden = false;
  emptyState.hidden = true;

  tableBody.innerHTML = logs
    .map((log) => {
      const replyPreview = log.adminReply
        ? log.adminReply.length > 40 ? `${log.adminReply.slice(0, 40)}…` : log.adminReply
        : '<span class="vehicle-cell-plate">No reply yet</span>';

      return `
        <tr data-log-id="${log.id}">
          <td>${log.driverName}</td>
          <td>${log.category}</td>
          <td>${log.message}</td>
          <td>${new Date(log.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
          <td><span class="status-badge status-badge-${log.status === 'resolved' ? 'paid' : 'owing'}">${log.status === 'resolved' ? 'Resolved' : 'Open'}</span></td>
          <td>${replyPreview}</td>
          <td class="col-actions">
            <button type="button" class="row-action-btn reply-log-btn" data-log-id="${log.id}" aria-label="Reply">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </button>
            <button type="button" class="row-action-btn toggle-log-status-btn" data-log-id="${log.id}" aria-label="Toggle status">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
          </td>
        </tr>
      `;
    })
    .join('');

  document.querySelectorAll('.toggle-log-status-btn').forEach((button) => {
    button.addEventListener('click', () => toggleLogStatus(button.dataset.logId));
  });

  document.querySelectorAll('.reply-log-btn').forEach((button) => {
    button.addEventListener('click', () => openReplyModal(button.dataset.logId));
  });
}

function toggleLogStatus(logId) {
  const logs = getCollection(DRIVER_LOGS_COLLECTION);
  const index = logs.findIndex((record) => record.id === logId);
  if (index === -1) return;

  logs[index] = {
    ...logs[index],
    status: logs[index].status === 'resolved' ? 'open' : 'resolved',
  };
  saveCollection(DRIVER_LOGS_COLLECTION, logs);
  renderDriverLogs();
}

/**
 * Opens the reply modal for a specific driver log, pre-filling any
 * existing reply so the admin can edit rather than overwrite blind.
 * @param {string} logId
 */
function openReplyModal(logId) {
  const log = findRecord(DRIVER_LOGS_COLLECTION, (record) => record.id === logId);
  if (!log) return;

  pendingReplyLogId = logId;

  $('#log-reply-title').textContent = `Reply to ${log.driverName}`;
  $('#log-reply-original-message').textContent = `Their message: "${log.message}"`;
  $('#log-reply-text').value = log.adminReply || '';
  clearFieldError($('#log-reply-text'), $('#log-reply-text-error'));

  $('#log-reply-modal-overlay').hidden = false;
}

function closeReplyModal() {
  pendingReplyLogId = null;
  $('#log-reply-modal-overlay').hidden = true;
}

/**
 * Saves the admin's reply onto the driver log record. This is
 * read directly by the driver's own dashboard — the only two-way
 * communication channel between admin and driver in the app.
 */
function handleReplySubmit(event) {
  event.preventDefault();

  const replyInput = $('#log-reply-text');
  clearFieldError(replyInput, $('#log-reply-text-error'));

  if (!replyInput.value.trim()) {
    showFieldError(replyInput, $('#log-reply-text-error'), 'Write a reply before saving.');
    return;
  }

  const logs = getCollection(DRIVER_LOGS_COLLECTION);
  const index = logs.findIndex((record) => record.id === pendingReplyLogId);
  if (index === -1) return;

  logs[index] = {
    ...logs[index],
    adminReply: replyInput.value.trim(),
    replyDate: new Date().toISOString(),
  };
  saveCollection(DRIVER_LOGS_COLLECTION, logs);

  renderDriverLogs();
  closeReplyModal();
}

/**
 * ----------------------------------------------------------------
 * COMPANY NEWS / BULLETIN
 * ----------------------------------------------------------------
 */

function buildNewsCard(post) {
  const imageHtml = post.imageBase64
    ? `<img src="${post.imageBase64}" class="news-card-image" alt="${post.title}">`
    : '';

  return `
    <div class="news-card" data-news-id="${post.id}">
      <div class="news-card-header">
        <span class="news-card-title">${post.title}</span>
        <span class="news-card-date">${new Date(post.datePosted).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
      </div>
      <div class="news-card-body">${post.body}</div>
      ${imageHtml}
      <div class="news-card-actions">
        <button type="button" class="row-action-btn edit-news-btn" data-news-id="${post.id}" aria-label="Edit post">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button type="button" class="row-action-btn delete-news-btn" data-news-id="${post.id}" aria-label="Delete post">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    </div>
  `;
}

function renderNewsFeed() {
  const posts = getCollection(NEWS_COLLECTION).slice().sort((a, b) => new Date(b.datePosted) - new Date(a.datePosted));
  const feed = $('#news-feed');
  const emptyState = $('#news-empty-state');

  if (posts.length === 0) {
    feed.hidden = true;
    emptyState.hidden = false;
    feed.innerHTML = '';
    return;
  }

  feed.hidden = false;
  emptyState.hidden = true;
  feed.innerHTML = posts.map(buildNewsCard).join('');

  document.querySelectorAll('.edit-news-btn').forEach((button) => {
    button.addEventListener('click', () => openEditNewsModal(button.dataset.newsId));
  });
  document.querySelectorAll('.delete-news-btn').forEach((button) => {
    button.addEventListener('click', () => openDeleteNewsModal(button.dataset.newsId));
  });
}

function resetNewsForm() {
  $('#news-form').reset();
  clearFieldError($('#news-title'), $('#news-title-error'));
  clearFieldError($('#news-body'), $('#news-body-error'));
  $('#news-image-preview').hidden = true;
  $('#news-image-preview').src = '';
  pendingNewsImageBase64 = null;
}

function openAddNewsModal() {
  currentlyEditingNewsId = null;
  $('#news-modal-title').textContent = 'New Post';
  resetNewsForm();
  $('#news-modal-overlay').hidden = false;
}

function openEditNewsModal(newsId) {
  const post = findRecord(NEWS_COLLECTION, (record) => record.id === newsId);
  if (!post) return;

  currentlyEditingNewsId = newsId;
  $('#news-modal-title').textContent = 'Edit Post';
  $('#news-title').value = post.title;
  $('#news-body').value = post.body;

  if (post.imageBase64) {
    pendingNewsImageBase64 = post.imageBase64;
    $('#news-image-preview').src = post.imageBase64;
    $('#news-image-preview').hidden = false;
  } else {
    pendingNewsImageBase64 = null;
    $('#news-image-preview').hidden = true;
  }

  $('#news-modal-overlay').hidden = false;
}

function closeNewsModal() {
  currentlyEditingNewsId = null;
  $('#news-modal-overlay').hidden = true;
}

function handleNewsImageSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    pendingNewsImageBase64 = reader.result;
    $('#news-image-preview').src = reader.result;
    $('#news-image-preview').hidden = false;
  };
  reader.readAsDataURL(file);
}

function handleNewsSubmit(event) {
  event.preventDefault();

  const titleInput = $('#news-title');
  const bodyInput = $('#news-body');
  clearFieldError(titleInput, $('#news-title-error'));
  clearFieldError(bodyInput, $('#news-body-error'));

  let hasError = false;
  if (!titleInput.value.trim()) {
    showFieldError(titleInput, $('#news-title-error'), 'Title is required.');
    hasError = true;
  }
  if (!bodyInput.value.trim()) {
    showFieldError(bodyInput, $('#news-body-error'), 'Message is required.');
    hasError = true;
  }
  if (hasError) return;

  const postData = {
    title: titleInput.value.trim(),
    body: bodyInput.value.trim(),
    imageBase64: pendingNewsImageBase64,
  };

  if (currentlyEditingNewsId) {
    const posts = getCollection(NEWS_COLLECTION);
    const index = posts.findIndex((record) => record.id === currentlyEditingNewsId);
    if (index !== -1) {
      posts[index] = { ...posts[index], ...postData };
      saveCollection(NEWS_COLLECTION, posts);
    }
  } else {
    addRecord(NEWS_COLLECTION, {
      id: generateId(),
      ...postData,
      datePosted: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
  }

  renderNewsFeed();
  closeNewsModal();
}

function openDeleteNewsModal(newsId) {
  pendingDeleteNewsId = newsId;
  $('#delete-news-modal-overlay').hidden = false;
}

function closeDeleteNewsModal() {
  pendingDeleteNewsId = null;
  $('#delete-news-modal-overlay').hidden = true;
}

function confirmDeleteNews() {
  if (!pendingDeleteNewsId) return;
  const posts = getCollection(NEWS_COLLECTION).filter((record) => record.id !== pendingDeleteNewsId);
  saveCollection(NEWS_COLLECTION, posts);
  renderNewsFeed();
  closeDeleteNewsModal();
}

/**
 * ----------------------------------------------------------------
 * DATE RANGE FILTER
 * ----------------------------------------------------------------
 */

function applyDateRange() {
  currentRangeStart = $('#report-range-start').value || null;
  currentRangeEnd = $('#report-range-end').value || null;
  renderAllCharts();
  renderOutstandingDrivers();
}

function clearDateRange() {
  currentRangeStart = null;
  currentRangeEnd = null;
  $('#report-range-start').value = '';
  $('#report-range-end').value = '';
  renderAllCharts();
  renderOutstandingDrivers();
}

/**
 * ----------------------------------------------------------------
 * PAGE INITIALIZATION
 * ----------------------------------------------------------------
 */
document.addEventListener('DOMContentLoaded', () => {
  const session = getActiveSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }

  renderSidebar('reports');

  renderAllCharts();
  renderOutstandingDrivers();
  populateHistoryDriverSelect();
  renderDriverLogs();
  renderNewsFeed();

  $('#apply-range-btn').addEventListener('click', applyDateRange);
  $('#clear-range-btn').addEventListener('click', clearDateRange);

  $('#history-driver-select').addEventListener('change', (event) => {
    renderDriverHistory(event.target.value);
  });

  $('#log-status-filter').addEventListener('change', renderDriverLogs);

  $('#open-add-news-btn').addEventListener('click', openAddNewsModal);
  $('#news-modal-close-btn').addEventListener('click', closeNewsModal);
  $('#news-cancel-btn').addEventListener('click', closeNewsModal);
  $('#news-form').addEventListener('submit', handleNewsSubmit);
  $('#news-image').addEventListener('change', handleNewsImageSelect);

  $('#delete-news-cancel-btn').addEventListener('click', closeDeleteNewsModal);
  $('#delete-news-confirm-btn').addEventListener('click', confirmDeleteNews);

  $('#log-reply-close-btn').addEventListener('click', closeReplyModal);
  $('#log-reply-cancel-btn').addEventListener('click', closeReplyModal);
  $('#log-reply-form').addEventListener('submit', handleReplySubmit);
});