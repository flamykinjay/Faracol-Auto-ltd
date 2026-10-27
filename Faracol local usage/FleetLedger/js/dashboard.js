/**
 * dashboard.js
 * ----------------------------------------------------------------
 * Page-specific logic for dashboard.html (admin overview).
 *
 * This page is READ-ONLY with respect to the "payments", "expenses",
 * and "weeks" collections — it displays figures already computed
 * elsewhere (the same formulas used on payments.html) rather than
 * recalculating its own version of them. This keeps a single source
 * of truth: if the math ever needs to change, it changes in one
 * place (payments.js's logic, mirrored here), not two.
 *
 * Depends on: utils.js, storage.js, auth.js, nav.js.
 * ----------------------------------------------------------------
 */

const DRIVERS_COLLECTION = 'drivers';
const VEHICLES_COLLECTION = 'vehicles';
const PAYMENTS_COLLECTION = 'payments';
const EXPENSES_COLLECTION = 'expenses';
const WEEKS_COLLECTION = 'weeks';

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

function getOpenWeek() {
  return findRecord(WEEKS_COLLECTION, (record) => record.status === 'open') || null;
}

/**
 * Populates every stat card with live figures. This week's numbers
 * come from the currently open week only (if none is open, they
 * correctly show ₦0 rather than guessing). All-Time Net Profit
 * mirrors the same Revenue − Expenses formula used on payments.html.
 */
function populateStatCards() {
  const drivers = getCollection(DRIVERS_COLLECTION);
  const vehicles = getCollection(VEHICLES_COLLECTION);
  const allPayments = getCollection(PAYMENTS_COLLECTION);
  const allExpenses = getCollection(EXPENSES_COLLECTION);

  $('#stat-total-drivers').textContent = drivers.length;
  $('#stat-total-vehicles').textContent = vehicles.length;

  const openWeek = getOpenWeek();
  const weekPayments = openWeek ? allPayments.filter((p) => p.weekId === openWeek.id) : [];

  const weekCollected = weekPayments.reduce((sum, p) => sum + p.amountPaid, 0);
  const weekOutstanding = weekPayments.reduce((sum, p) => sum + Math.max(p.targetAmount - p.amountPaid, 0), 0);

  const weekExpenses = openWeek
    ? allExpenses
        .filter((e) => e.date >= openWeek.startDate.split('T')[0] && e.date <= openWeek.endDate.split('T')[0])
        .reduce((sum, e) => sum + e.amount, 0)
    : 0;

  const weekNetProfit = weekCollected - weekExpenses;

  $('#stat-week-collected').textContent = formatCurrency(weekCollected);
  $('#stat-week-outstanding').textContent = formatCurrency(weekOutstanding);
  $('#stat-week-net-profit').textContent = formatCurrency(weekNetProfit);

  // All-time net profit mirrors payments.js: Revenue (collected + misc
  // income) minus all-time Expenses. Misc income is included here too
  // for consistency, even though it has no dedicated card on this page.
  const miscIncome = getCollection('miscIncome');
  const allTimeCollected = allPayments.reduce((sum, p) => sum + p.amountPaid, 0);
  const allTimeMiscIncome = miscIncome.reduce((sum, m) => sum + m.amount, 0);
  const allTimeExpenses = allExpenses.reduce((sum, e) => sum + e.amount, 0);
  const allTimeRevenue = allTimeCollected + allTimeMiscIncome;
  const allTimeNetProfit = allTimeRevenue - allTimeExpenses;

  $('#stat-alltime-net-profit').textContent = formatCurrency(allTimeNetProfit);
}

/**
 * Builds a single line item for the Recent Activity feed.
 * @param {{ type: "payment"|"expense", date: string, text: string }} item
 * @returns {string}
 */
function buildActivityItem(item) {
  const icon = item.type === 'payment'
    ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>'
    : '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>';

  const iconClass = item.type === 'payment' ? 'activity-icon-payment' : 'activity-icon-expense';
  const formattedDate = new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return `
    <li class="activity-item">
      <span class="activity-icon ${iconClass}">${icon}</span>
      <span class="activity-text">${item.text}</span>
      <span class="activity-date">${formattedDate}</span>
    </li>
  `;
}

/**
 * Merges the most recent payment logs and expense entries into a
 * single chronological feed, most recent first, capped at 5 items.
 * Only includes payments that have actually had money logged
 * against them (amountPaid > 0) — a freshly-seeded ₦0 payment record
 * isn't "activity," it's just bookkeeping setup.
 */
function renderRecentActivity() {
  const payments = getCollection(PAYMENTS_COLLECTION).filter((p) => p.amountPaid > 0);
  const expenses = getCollection(EXPENSES_COLLECTION);

  const paymentItems = payments.map((payment) => ({
    type: 'payment',
    date: payment.updatedAt || payment.createdAt,
    text: `${payment.driverName} paid ${formatCurrency(payment.amountPaid)}`,
  }));

  const expenseItems = expenses.map((expense) => ({
    type: 'expense',
    date: expense.createdAt,
    text: `${expense.category} expense logged — ${formatCurrency(expense.amount)}`,
  }));

  const combined = [...paymentItems, ...expenseItems]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  const list = $('#recent-activity-list');
  const emptyState = $('#recent-activity-empty');

  if (combined.length === 0) {
    list.hidden = true;
    emptyState.hidden = false;
    return;
  }

  list.hidden = false;
  emptyState.hidden = true;
  list.innerHTML = combined.map(buildActivityItem).join('');
}

function renderHeaderGreeting(session) {
  $('#header-greeting').textContent = `Welcome back, ${session.name}`;

  const today = new Date();
  $('#header-date').textContent = today.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const session = getActiveSession();

  if (!session) {
    window.location.href = 'index.html';
    return;
  }

  renderSidebar('dashboard');
  renderHeaderGreeting(session);
  populateStatCards();
  renderRecentActivity();
});