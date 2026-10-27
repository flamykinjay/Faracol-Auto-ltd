/**
 * payments.js
 * ----------------------------------------------------------------
 * Page-specific logic for payments.html.
 *
 * DATA MODEL:
 * "weeks": { id, label, startDate, endDate, status: "open"|"closed", createdAt }
 * "payments": { id, weekId, driverId, driverName (snapshot at time of
 *   creation — survives driver deletion), targetAmount, carriedOverAmount,
 *   amountPaid, status, notes, createdAt, updatedAt }
 * "expenses": { id, category, description, amount, date, createdAt }
 * "miscIncome": { id, description, amount, date, createdAt }
 *
 * CARRY-OVER RULE: starting a new week checks each driver's payment
 * record from the week just closed. Any unpaid balance is added on
 * top of their current weekly target for the new week.
 *
 * DELETION RULE: deleting a driver never deletes their payment
 * history — the driverName snapshot keeps old records readable.
 *
 * WEEKLY STAT CARDS: reflect whichever week is currently SELECTED
 * in the week dropdown (defaults to the open week), not always the
 * open week — so browsing a past week shows that week's real numbers
 * instead of silently showing zeros.
 *
 * FINANCE FORMULAS:
 * Revenue = payments collected + misc income (actual cash in)
 * Net Profit = Revenue - Expenses (actual cash in minus actual cash out)
 * Outstanding/Receivable is tracked separately, never subtracted from profit.
 *
 * Depends on: utils.js, storage.js, auth.js, nav.js.
 * ----------------------------------------------------------------
 */

const WEEKS_COLLECTION = 'weeks';
const PAYMENTS_COLLECTION = 'payments';
const EXPENSES_COLLECTION = 'expenses';
const MISC_INCOME_COLLECTION = 'miscIncome';
const DRIVERS_COLLECTION = 'drivers';

let currentlyViewedWeekId = null;
let pendingPaymentId = null;
let currentlyEditingExpenseId = null;
let pendingDeleteExpenseId = null;
let currentlyEditingMiscId = null;
let pendingDeleteMiscId = null;

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

/**
 * ----------------------------------------------------------------
 * WEEK MANAGEMENT
 * ----------------------------------------------------------------
 */

function getOpenWeek() {
  return findRecord(WEEKS_COLLECTION, (record) => record.status === 'open') || null;
}

function formatWeekLabel(start, end) {
  const options = { month: 'short', day: 'numeric' };
  const startLabel = start.toLocaleDateString('en-US', options);
  const endLabel = end.toLocaleDateString('en-US', { ...options, year: 'numeric' });
  return `${startLabel} – ${endLabel}`;
}

function startNewWeek() {
  const weeks = getCollection(WEEKS_COLLECTION);
  const previousOpenWeek = weeks.find((week) => week.status === 'open') || null;

  const updatedWeeks = weeks.map((week) =>
    week.status === 'open' ? { ...week, status: 'closed' } : week
  );

  // ---------------------------------------------------------------
  // DATE CALCULATION FIX: previously this always used today's date,
  // which meant every new week collapsed onto the same date range —
  // impossible to test multiple sequential weeks in one sitting.
  //
  // Now: if a previous week exists (open or otherwise, we check all
  // weeks to find the latest one ever created), the new week starts
  // the day AFTER that week's end date — so weeks always progress
  // forward in sequence, regardless of the real calendar date. Only
  // the very first week ever created falls back to today's date.
  // ---------------------------------------------------------------
  const allWeeksSortedByEnd = weeks.slice().sort((a, b) => new Date(b.endDate) - new Date(a.endDate));
  const mostRecentWeek = allWeeksSortedByEnd[0] || null;

  let startDate;
  if (mostRecentWeek) {
    startDate = new Date(mostRecentWeek.endDate);
    startDate.setDate(startDate.getDate() + 1);
  } else {
    startDate = new Date();
  }

  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);

  const newWeek = {
    id: generateId(),
    label: formatWeekLabel(startDate, endDate),
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    status: 'open',
    createdAt: new Date().toISOString(),
  };

  updatedWeeks.push(newWeek);
  saveCollection(WEEKS_COLLECTION, updatedWeeks);

  const drivers = getCollection(DRIVERS_COLLECTION);
  const previousPayments = previousOpenWeek
    ? getCollection(PAYMENTS_COLLECTION).filter((p) => p.weekId === previousOpenWeek.id)
    : [];

  drivers.forEach((driver) => {
    const previousRecord = previousPayments.find((p) => p.driverId === driver.id);
    const carriedOverAmount = previousRecord
      ? Math.max(previousRecord.targetAmount - previousRecord.amountPaid, 0)
      : 0;

    addRecord(PAYMENTS_COLLECTION, {
      id: generateId(),
      weekId: newWeek.id,
      driverId: driver.id,
      driverName: driver.name,
      targetAmount: driver.weeklyTarget + carriedOverAmount,
      carriedOverAmount,
      amountPaid: 0,
      status: 'unpaid',
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  currentlyViewedWeekId = newWeek.id;
  refreshWeekSelector();
  renderPaymentsTab();
  renderStatCards();
}

function ensureWeekPaymentsForAllDrivers(weekId) {
  const drivers = getCollection(DRIVERS_COLLECTION);
  const existingPayments = getCollection(PAYMENTS_COLLECTION);

  drivers.forEach((driver) => {
    const exists = existingPayments.some((p) => p.weekId === weekId && p.driverId === driver.id);
    if (!exists) {
      addRecord(PAYMENTS_COLLECTION, {
        id: generateId(),
        weekId,
        driverId: driver.id,
        driverName: driver.name,
        targetAmount: driver.weeklyTarget,
        carriedOverAmount: 0,
        amountPaid: 0,
        status: 'unpaid',
        notes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  });
}

function refreshWeekSelector() {
  const weeks = getCollection(WEEKS_COLLECTION).slice().sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  const select = $('#week-selector');
  const openWeek = getOpenWeek();
  const pill = $('#active-week-pill');

  if (weeks.length === 0) {
    select.innerHTML = '<option value="">No weeks yet</option>';
    pill.hidden = true;
    return;
  }

  select.innerHTML = weeks
    .map((week) => `<option value="${week.id}">${week.label}${week.status === 'open' ? ' (Active)' : ''}</option>`)
    .join('');

  if (!currentlyViewedWeekId || !weeks.some((w) => w.id === currentlyViewedWeekId)) {
    currentlyViewedWeekId = openWeek ? openWeek.id : weeks[0].id;
  }
  select.value = currentlyViewedWeekId;

  if (openWeek) {
    pill.hidden = false;
    $('#active-week-label').textContent = openWeek.label;
  } else {
    pill.hidden = true;
  }
}

function confirmDeleteWeek() {
  if (!currentlyViewedWeekId) {
    closeDeleteWeekModal();
    return;
  }

  const weeks = getCollection(WEEKS_COLLECTION).filter((week) => week.id !== currentlyViewedWeekId);
  saveCollection(WEEKS_COLLECTION, weeks);

  const payments = getCollection(PAYMENTS_COLLECTION).filter((p) => p.weekId !== currentlyViewedWeekId);
  saveCollection(PAYMENTS_COLLECTION, payments);

  currentlyViewedWeekId = null;
  refreshWeekSelector();
  renderPaymentsTab();
  renderStatCards();
  closeDeleteWeekModal();
}

function openDeleteWeekModal() {
  if (!currentlyViewedWeekId) return;
  $('#delete-week-modal-overlay').hidden = false;
}

function closeDeleteWeekModal() {
  $('#delete-week-modal-overlay').hidden = true;
}

/**
 * ----------------------------------------------------------------
 * PAYMENTS TAB
 * ----------------------------------------------------------------
 */

function calculatePaymentStatus(amountPaid, targetAmount) {
  if (amountPaid >= targetAmount && targetAmount > 0) return 'paid';
  if (amountPaid > 0) return 'partial';
  return 'unpaid';
}

function buildPaymentRow(payment) {
  const driverStillExists = findRecord(DRIVERS_COLLECTION, (d) => d.id === payment.driverId);
  const balance = payment.targetAmount - payment.amountPaid;
  const balanceClass = balance > 0 ? 'balance-owing' : 'balance-clear';
  const statusKey = payment.status === 'paid' ? 'paid' : payment.status === 'partial' ? 'sick' : 'owing';

  const nameDisplay = driverStillExists
    ? payment.driverName
    : `${payment.driverName} <span class="driver-cell-deleted">(removed)</span>`;

  const carryOverNote = payment.carriedOverAmount > 0
    ? `<div class="vehicle-cell-plate">Includes ${formatCurrency(payment.carriedOverAmount)} carried over</div>`
    : '';

  return `
    <tr data-payment-id="${payment.id}">
      <td>${nameDisplay}${carryOverNote}</td>
      <td>${formatCurrency(payment.targetAmount)}</td>
      <td>${formatCurrency(payment.amountPaid)}</td>
      <td class="${balanceClass}">${formatCurrency(Math.max(balance, 0))}</td>
      <td><span class="status-badge status-badge-${statusKey}">${payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}</span></td>
      <td class="col-actions">
        <button type="button" class="row-action-btn log-payment-btn" data-payment-id="${payment.id}" aria-label="Log payment">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
      </td>
    </tr>
  `;
}

function renderPaymentsTab() {
  const table = $('#payments-table');
  const emptyState = $('#payments-empty-state');
  const tableBody = $('#payments-table-body');
  const weekLabel = $('#week-selector-label');

  if (!currentlyViewedWeekId) {
    table.hidden = true;
    emptyState.hidden = false;
    weekLabel.textContent = '—';
    return;
  }

  const week = findRecord(WEEKS_COLLECTION, (record) => record.id === currentlyViewedWeekId);
  if (!week) {
    table.hidden = true;
    emptyState.hidden = false;
    return;
  }

  if (week.status === 'open') {
    ensureWeekPaymentsForAllDrivers(week.id);
  }

  weekLabel.textContent = week.label;

  const payments = getCollection(PAYMENTS_COLLECTION).filter((record) => record.weekId === currentlyViewedWeekId);

  if (payments.length === 0) {
    table.hidden = true;
    emptyState.hidden = false;
    tableBody.innerHTML = '';
    return;
  }

  table.hidden = false;
  emptyState.hidden = true;
  tableBody.innerHTML = payments.map(buildPaymentRow).join('');

  document.querySelectorAll('.log-payment-btn').forEach((button) => {
    button.addEventListener('click', () => openLogPaymentModal(button.dataset.paymentId));
  });
}

function openLogPaymentModal(paymentId) {
  const payment = findRecord(PAYMENTS_COLLECTION, (record) => record.id === paymentId);
  if (!payment) return;

  pendingPaymentId = paymentId;

  $('#log-payment-title').textContent = `Log Payment — ${payment.driverName}`;
  $('#log-payment-target-label').textContent = `Target This Week: ${formatCurrency(payment.targetAmount)}`;

  const carryNote = $('#log-payment-carryover-note');
  if (payment.carriedOverAmount > 0) {
    carryNote.hidden = false;
    carryNote.textContent = `Includes ${formatCurrency(payment.carriedOverAmount)} carried over from a previous week.`;
  } else {
    carryNote.hidden = true;
  }

  $('#log-payment-amount').value = payment.amountPaid;
  $('#log-payment-notes').value = payment.notes || '';

  $('#log-payment-modal-overlay').hidden = false;
}

function closeLogPaymentModal() {
  pendingPaymentId = null;
  $('#log-payment-modal-overlay').hidden = true;
}

function handleLogPaymentSubmit(event) {
  event.preventDefault();

  const amountInput = $('#log-payment-amount');
  const amountError = $('#log-payment-amount-error');
  clearFieldError(amountInput, amountError);

  const amountPaid = Number(amountInput.value);
  if (Number.isNaN(amountPaid) || amountPaid < 0) {
    showFieldError(amountInput, amountError, 'Enter a valid amount.');
    return;
  }

  const payments = getCollection(PAYMENTS_COLLECTION);
  const index = payments.findIndex((record) => record.id === pendingPaymentId);
  if (index === -1) return;

  payments[index] = {
    ...payments[index],
    amountPaid,
    status: calculatePaymentStatus(amountPaid, payments[index].targetAmount),
    notes: $('#log-payment-notes').value.trim(),
    updatedAt: new Date().toISOString(),
  };
  saveCollection(PAYMENTS_COLLECTION, payments);

  renderPaymentsTab();
  renderStatCards();
  closeLogPaymentModal();
}

/**
 * ----------------------------------------------------------------
 * FINANCE STAT CARDS
 * FIX: weekly cards now follow the SELECTED week (currentlyViewedWeekId),
 * not silently only the open week — so browsing history shows real
 * numbers instead of zeros. All-Time cards remain unaffected by selection.
 * ----------------------------------------------------------------
 */

function renderStatCards() {
  const allPayments = getCollection(PAYMENTS_COLLECTION);
  const allExpenses = getCollection(EXPENSES_COLLECTION);
  const allMiscIncome = getCollection(MISC_INCOME_COLLECTION);

  // ---- SELECTED WEEK figures (the week currently chosen in the dropdown) ----
  const selectedWeek = currentlyViewedWeekId
    ? findRecord(WEEKS_COLLECTION, (record) => record.id === currentlyViewedWeekId)
    : null;

  const weekPayments = selectedWeek
    ? allPayments.filter((p) => p.weekId === selectedWeek.id)
    : [];

  const weekCollected = weekPayments.reduce((sum, p) => sum + p.amountPaid, 0);
  const weekExpected = weekPayments.reduce((sum, p) => sum + p.targetAmount, 0);
  const weekOutstanding = weekPayments.reduce((sum, p) => sum + Math.max(p.targetAmount - p.amountPaid, 0), 0);

  const weekExpenses = selectedWeek
    ? allExpenses
        .filter((e) => e.date >= selectedWeek.startDate.split('T')[0] && e.date <= selectedWeek.endDate.split('T')[0])
        .reduce((sum, e) => sum + e.amount, 0)
    : 0;

  const weekNetProfit = weekCollected - weekExpenses;

  // ---- ALL-TIME figures (always global, unaffected by week selection) ----
  const allTimeCollected = allPayments.reduce((sum, p) => sum + p.amountPaid, 0);
  const allTimeExpenses = allExpenses.reduce((sum, e) => sum + e.amount, 0);
  const allTimeOutstanding = allPayments.reduce((sum, p) => sum + Math.max(p.targetAmount - p.amountPaid, 0), 0);
  const allTimeMiscIncome = allMiscIncome.reduce((sum, m) => sum + m.amount, 0);
  const allTimeRevenue = allTimeCollected + allTimeMiscIncome;
  const allTimeNetProfit = allTimeRevenue - allTimeExpenses;

  $('#stat-week-collected').textContent = formatCurrency(weekCollected);
  $('#stat-week-expected').textContent = formatCurrency(weekExpected);
  $('#stat-week-outstanding').textContent = formatCurrency(weekOutstanding);
  $('#stat-week-expenses').textContent = formatCurrency(weekExpenses);
  $('#stat-week-net-profit').textContent = formatCurrency(weekNetProfit);

  $('#stat-alltime-collected').textContent = formatCurrency(allTimeCollected);
  $('#stat-alltime-expenses').textContent = formatCurrency(allTimeExpenses);
  $('#stat-alltime-outstanding').textContent = formatCurrency(allTimeOutstanding);
  $('#stat-alltime-revenue').textContent = formatCurrency(allTimeRevenue);
  $('#stat-alltime-net-profit').textContent = formatCurrency(allTimeNetProfit);
}

/**
 * ----------------------------------------------------------------
 * PAGE TABS
 * ----------------------------------------------------------------
 */

function switchPageTab(tab) {
  $('#tab-payments-view').classList.toggle('page-tab-active', tab === 'payments');
  $('#tab-expenses-view').classList.toggle('page-tab-active', tab === 'expenses');
  $('#tab-misc-view').classList.toggle('page-tab-active', tab === 'misc');

  $('#payments-tab-content').hidden = tab !== 'payments';
  $('#expenses-tab-content').hidden = tab !== 'expenses';
  $('#misc-tab-content').hidden = tab !== 'misc';
}

/**
 * ----------------------------------------------------------------
 * EXPENSES TAB
 * ----------------------------------------------------------------
 */

function buildExpenseRow(expense) {
  return `
    <tr data-expense-id="${expense.id}">
      <td>${expense.category}</td>
      <td>${expense.description}</td>
      <td>${formatCurrency(expense.amount)}</td>
      <td>${new Date(expense.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
      <td class="col-actions">
        <button type="button" class="row-action-btn edit-expense-btn" data-expense-id="${expense.id}" aria-label="Edit expense">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button type="button" class="row-action-btn row-action-danger delete-expense-btn" data-expense-id="${expense.id}" aria-label="Delete expense">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </td>
    </tr>
  `;
}

function renderExpensesTab() {
  const expenses = getCollection(EXPENSES_COLLECTION).slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  const table = $('#expenses-table');
  const emptyState = $('#expenses-empty-state');
  const tableBody = $('#expenses-table-body');

  if (expenses.length === 0) {
    table.hidden = true;
    emptyState.hidden = false;
    tableBody.innerHTML = '';
    return;
  }

  table.hidden = false;
  emptyState.hidden = true;
  tableBody.innerHTML = expenses.map(buildExpenseRow).join('');

  document.querySelectorAll('.edit-expense-btn').forEach((button) => {
    button.addEventListener('click', () => openEditExpenseModal(button.dataset.expenseId));
  });
  document.querySelectorAll('.delete-expense-btn').forEach((button) => {
    button.addEventListener('click', () => openDeleteExpenseModal(button.dataset.expenseId));
  });
}

function resetExpenseForm() {
  $('#expense-form').reset();
  ['description', 'amount', 'date'].forEach((field) => clearFieldError($(`#expense-${field}`), $(`#expense-${field}-error`)));
  $('#expense-date').value = new Date().toISOString().split('T')[0];
}

function openAddExpenseModal() {
  currentlyEditingExpenseId = null;
  $('#expense-modal-title').textContent = 'Add Expense';
  resetExpenseForm();
  $('#expense-modal-overlay').hidden = false;
}

function openEditExpenseModal(expenseId) {
  const expense = findRecord(EXPENSES_COLLECTION, (record) => record.id === expenseId);
  if (!expense) return;

  currentlyEditingExpenseId = expenseId;
  $('#expense-modal-title').textContent = 'Edit Expense';
  $('#expense-category').value = expense.category;
  $('#expense-description').value = expense.description;
  $('#expense-amount').value = expense.amount;
  $('#expense-date').value = expense.date.split('T')[0];
  $('#expense-modal-overlay').hidden = false;
}

function closeExpenseModal() {
  currentlyEditingExpenseId = null;
  $('#expense-modal-overlay').hidden = true;
}

function handleExpenseSubmit(event) {
  event.preventDefault();

  const fields = { description: $('#expense-description'), amount: $('#expense-amount'), date: $('#expense-date') };
  let hasError = false;

  Object.entries(fields).forEach(([key, input]) => {
    const errorEl = $(`#expense-${key}-error`);
    clearFieldError(input, errorEl);
    if (!input.value.trim()) {
      showFieldError(input, errorEl, 'This field is required.');
      hasError = true;
    }
  });

  if (hasError) return;

  const expenseData = {
    category: $('#expense-category').value,
    description: fields.description.value.trim(),
    amount: Number(fields.amount.value),
    date: fields.date.value,
  };

  if (currentlyEditingExpenseId) {
    const expenses = getCollection(EXPENSES_COLLECTION);
    const index = expenses.findIndex((record) => record.id === currentlyEditingExpenseId);
    if (index !== -1) {
      expenses[index] = { ...expenses[index], ...expenseData };
      saveCollection(EXPENSES_COLLECTION, expenses);
    }
  } else {
    addRecord(EXPENSES_COLLECTION, { id: generateId(), ...expenseData, createdAt: new Date().toISOString() });
  }

  renderExpensesTab();
  renderStatCards();
  closeExpenseModal();
}

function openDeleteExpenseModal(expenseId) {
  pendingDeleteExpenseId = expenseId;
  $('#delete-expense-modal-overlay').hidden = false;
}

function closeDeleteExpenseModal() {
  pendingDeleteExpenseId = null;
  $('#delete-expense-modal-overlay').hidden = true;
}

function confirmDeleteExpense() {
  if (!pendingDeleteExpenseId) return;
  const expenses = getCollection(EXPENSES_COLLECTION).filter((record) => record.id !== pendingDeleteExpenseId);
  saveCollection(EXPENSES_COLLECTION, expenses);
  renderExpensesTab();
  renderStatCards();
  closeDeleteExpenseModal();
}

/**
 * ----------------------------------------------------------------
 * MISC INCOME TAB
 * ----------------------------------------------------------------
 */

function buildMiscRow(item) {
  return `
    <tr data-misc-id="${item.id}">
      <td>${item.description}</td>
      <td>${formatCurrency(item.amount)}</td>
      <td>${new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
      <td class="col-actions">
        <button type="button" class="row-action-btn edit-misc-btn" data-misc-id="${item.id}" aria-label="Edit income">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button type="button" class="row-action-btn row-action-danger delete-misc-btn" data-misc-id="${item.id}" aria-label="Delete income">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </td>
    </tr>
  `;
}

function renderMiscTab() {
  const items = getCollection(MISC_INCOME_COLLECTION).slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  const table = $('#misc-table');
  const emptyState = $('#misc-empty-state');
  const tableBody = $('#misc-table-body');

  if (items.length === 0) {
    table.hidden = true;
    emptyState.hidden = false;
    tableBody.innerHTML = '';
    return;
  }

  table.hidden = false;
  emptyState.hidden = true;
  tableBody.innerHTML = items.map(buildMiscRow).join('');

  document.querySelectorAll('.edit-misc-btn').forEach((button) => {
    button.addEventListener('click', () => openEditMiscModal(button.dataset.miscId));
  });
  document.querySelectorAll('.delete-misc-btn').forEach((button) => {
    button.addEventListener('click', () => openDeleteMiscModal(button.dataset.miscId));
  });
}

function resetMiscForm() {
  $('#misc-form').reset();
  ['description', 'amount', 'date'].forEach((field) => clearFieldError($(`#misc-${field}`), $(`#misc-${field}-error`)));
  $('#misc-date').value = new Date().toISOString().split('T')[0];
}

function openAddMiscModal() {
  currentlyEditingMiscId = null;
  $('#misc-modal-title').textContent = 'Add Income';
  resetMiscForm();
  $('#misc-modal-overlay').hidden = false;
}

function openEditMiscModal(miscId) {
  const item = findRecord(MISC_INCOME_COLLECTION, (record) => record.id === miscId);
  if (!item) return;

  currentlyEditingMiscId = miscId;
  $('#misc-modal-title').textContent = 'Edit Income';
  $('#misc-description').value = item.description;
  $('#misc-amount').value = item.amount;
  $('#misc-date').value = item.date.split('T')[0];
  $('#misc-modal-overlay').hidden = false;
}

function closeMiscModal() {
  currentlyEditingMiscId = null;
  $('#misc-modal-overlay').hidden = true;
}

function handleMiscSubmit(event) {
  event.preventDefault();

  const fields = { description: $('#misc-description'), amount: $('#misc-amount'), date: $('#misc-date') };
  let hasError = false;

  Object.entries(fields).forEach(([key, input]) => {
    const errorEl = $(`#misc-${key}-error`);
    clearFieldError(input, errorEl);
    if (!input.value.trim()) {
      showFieldError(input, errorEl, 'This field is required.');
      hasError = true;
    }
  });

  if (hasError) return;

  const miscData = {
    description: fields.description.value.trim(),
    amount: Number(fields.amount.value),
    date: fields.date.value,
  };

  if (currentlyEditingMiscId) {
    const items = getCollection(MISC_INCOME_COLLECTION);
    const index = items.findIndex((record) => record.id === currentlyEditingMiscId);
    if (index !== -1) {
      items[index] = { ...items[index], ...miscData };
      saveCollection(MISC_INCOME_COLLECTION, items);
    }
  } else {
    addRecord(MISC_INCOME_COLLECTION, { id: generateId(), ...miscData, createdAt: new Date().toISOString() });
  }

  renderMiscTab();
  renderStatCards();
  closeMiscModal();
}

function openDeleteMiscModal(miscId) {
  pendingDeleteMiscId = miscId;
  $('#delete-misc-modal-overlay').hidden = false;
}

function closeDeleteMiscModal() {
  pendingDeleteMiscId = null;
  $('#delete-misc-modal-overlay').hidden = true;
}

function confirmDeleteMisc() {
  if (!pendingDeleteMiscId) return;
  const items = getCollection(MISC_INCOME_COLLECTION).filter((record) => record.id !== pendingDeleteMiscId);
  saveCollection(MISC_INCOME_COLLECTION, items);
  renderMiscTab();
  renderStatCards();
  closeDeleteMiscModal();
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

  renderSidebar('payments');

  refreshWeekSelector();
  renderPaymentsTab();
  renderStatCards();
  renderExpensesTab();
  renderMiscTab();

  $('#start-week-btn').addEventListener('click', startNewWeek);
  $('#delete-week-btn').addEventListener('click', openDeleteWeekModal);
  $('#delete-week-cancel-btn').addEventListener('click', closeDeleteWeekModal);
  $('#delete-week-confirm-btn').addEventListener('click', confirmDeleteWeek);

  // FIX: selecting a different week now updates the stat cards too,
  // not just the table below.
  $('#week-selector').addEventListener('change', (event) => {
    currentlyViewedWeekId = event.target.value;
    renderPaymentsTab();
    renderStatCards();
  });

  $('#tab-payments-view').addEventListener('click', () => switchPageTab('payments'));
  $('#tab-expenses-view').addEventListener('click', () => switchPageTab('expenses'));
  $('#tab-misc-view').addEventListener('click', () => switchPageTab('misc'));

  $('#log-payment-close-btn').addEventListener('click', closeLogPaymentModal);
  $('#log-payment-cancel-btn').addEventListener('click', closeLogPaymentModal);
  $('#log-payment-form').addEventListener('submit', handleLogPaymentSubmit);

  $('#open-add-expense-btn').addEventListener('click', openAddExpenseModal);
  $('#expense-modal-close-btn').addEventListener('click', closeExpenseModal);
  $('#expense-cancel-btn').addEventListener('click', closeExpenseModal);
  $('#expense-form').addEventListener('submit', handleExpenseSubmit);
  $('#delete-expense-cancel-btn').addEventListener('click', closeDeleteExpenseModal);
  $('#delete-expense-confirm-btn').addEventListener('click', confirmDeleteExpense);

  $('#open-add-misc-btn').addEventListener('click', openAddMiscModal);
  $('#misc-modal-close-btn').addEventListener('click', closeMiscModal);
  $('#misc-cancel-btn').addEventListener('click', closeMiscModal);
  $('#misc-form').addEventListener('submit', handleMiscSubmit);
  $('#delete-misc-cancel-btn').addEventListener('click', closeDeleteMiscModal);
  $('#delete-misc-confirm-btn').addEventListener('click', confirmDeleteMisc);
});