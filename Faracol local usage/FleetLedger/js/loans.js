/**
 * loans.js
 * ----------------------------------------------------------------
 * Page-specific logic for loans.html.
 *
 * DISTINCT FROM CARRY-OVER: a loan is a deliberate one-time cash
 * advance to a driver, repaid manually and tracked completely
 * separately from weekly payment carry-over debt (which is
 * automatic and tied to the weekly cycle in payments.js). Loans
 * never affect a driver's weekly payment status.
 *
 * DATA MODEL:
 * "loans": { id, driverId, driverName (snapshot — survives driver
 *   deletion), principal, amountRepaid, status: "active" |
 *   "paid-off", dateIssued, weeklyRepaymentAmount (informational
 *   only, not enforced), notes, createdAt }
 *
 * Status auto-flips to "paid-off" once amountRepaid >= principal —
 * never set manually.
 *
 * NO LIMITS: no maximum enforced on how many loans can be issued.
 *
 * Depends on: utils.js, storage.js, auth.js, nav.js.
 * ----------------------------------------------------------------
 */

const LOANS_COLLECTION = 'loans';
const DRIVERS_COLLECTION = 'drivers';

let pendingRepaymentLoanId = null;
let pendingDeleteLoanId = null;
let currentSearchTerm = '';

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
 * STAT CARDS
 * ----------------------------------------------------------------
 */

function renderLoanStats() {
  const loans = getCollection(LOANS_COLLECTION);

  const activeLoans = loans.filter((loan) => loan.status === 'active');
  const totalOutstanding = activeLoans.reduce((sum, loan) => sum + Math.max(loan.principal - loan.amountRepaid, 0), 0);
  const totalRepaid = loans.reduce((sum, loan) => sum + loan.amountRepaid, 0);

  $('#stat-active-loan-count').textContent = activeLoans.length;
  $('#stat-loans-outstanding').textContent = formatCurrency(totalOutstanding);
  $('#stat-loans-repaid').textContent = formatCurrency(totalRepaid);
}

/**
 * ----------------------------------------------------------------
 * TABLE RENDERING
 * ----------------------------------------------------------------
 */

function buildLoanRow(loan) {
  const balance = Math.max(loan.principal - loan.amountRepaid, 0);
  const balanceClass = balance > 0 ? 'balance-owing' : 'balance-clear';
  const statusBadge = loan.status === 'paid-off'
    ? '<span class="status-badge status-badge-paid">Paid Off</span>'
    : '<span class="status-badge status-badge-owing">Active</span>';

  const repaymentButton = loan.status === 'active'
    ? `<button type="button" class="row-action-btn log-repayment-btn" data-loan-id="${loan.id}" aria-label="Log repayment">
         <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
       </button>`
    : '';

  return `
    <tr data-loan-id="${loan.id}">
      <td>${loan.driverName}</td>
      <td>${formatCurrency(loan.principal)}</td>
      <td>${formatCurrency(loan.amountRepaid)}</td>
      <td class="${balanceClass}">${formatCurrency(balance)}</td>
      <td>${new Date(loan.dateIssued).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
      <td>${statusBadge}</td>
      <td class="col-actions">
        ${repaymentButton}
        <button type="button" class="row-action-btn row-action-danger delete-loan-btn" data-loan-id="${loan.id}" aria-label="Delete loan">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </td>
    </tr>
  `;
}

function filterLoans(loans) {
  if (!currentSearchTerm.trim()) {
    return loans;
  }
  const term = currentSearchTerm.trim().toLowerCase();
  return loans.filter((loan) => loan.driverName.toLowerCase().includes(term));
}

function renderLoansTable() {
  const allLoans = getCollection(LOANS_COLLECTION).slice().sort((a, b) => new Date(b.dateIssued) - new Date(a.dateIssued));
  const loans = filterLoans(allLoans);

  const table = $('#loans-table');
  const emptyState = $('#loans-empty-state');
  const tableBody = $('#loans-table-body');
  const subtitle = $('#loan-count-subtitle');

  subtitle.textContent = `${allLoans.length} loan${allLoans.length === 1 ? '' : 's'}`;

  if (loans.length === 0) {
    table.hidden = true;
    emptyState.hidden = false;
    emptyState.querySelector('p').textContent = currentSearchTerm
      ? 'No loans match your search.'
      : 'No loans issued yet. Click "Issue Loan" to record one.';
    tableBody.innerHTML = '';
    return;
  }

  table.hidden = false;
  emptyState.hidden = true;
  tableBody.innerHTML = loans.map(buildLoanRow).join('');

  document.querySelectorAll('.log-repayment-btn').forEach((button) => {
    button.addEventListener('click', () => openRepaymentModal(button.dataset.loanId));
  });
  document.querySelectorAll('.delete-loan-btn').forEach((button) => {
    button.addEventListener('click', () => openDeleteLoanModal(button.dataset.loanId));
  });

  renderLoanStats();
}

/**
 * ----------------------------------------------------------------
 * ISSUE LOAN MODAL
 * ----------------------------------------------------------------
 */

function populateLoanDriverSelect() {
  const drivers = getCollection(DRIVERS_COLLECTION);
  const select = $('#loan-driver');
  select.innerHTML = drivers.map((driver) => `<option value="${driver.id}">${driver.name}</option>`).join('');
}

function resetLoanForm() {
  $('#loan-form').reset();
  clearFieldError($('#loan-driver'), $('#loan-driver-error'));
  clearFieldError($('#loan-principal'), $('#loan-principal-error'));
  clearFieldError($('#loan-date-issued'), $('#loan-date-issued-error'));
  $('#loan-date-issued').value = new Date().toISOString().split('T')[0];
}

function openIssueLoanModal() {
  $('#loan-modal-title').textContent = 'Issue Loan';
  populateLoanDriverSelect();
  resetLoanForm();
  $('#loan-modal-overlay').hidden = false;
}

function closeLoanModal() {
  $('#loan-modal-overlay').hidden = true;
}

function handleLoanSubmit(event) {
  event.preventDefault();

  const driverSelect = $('#loan-driver');
  const principalInput = $('#loan-principal');
  const dateInput = $('#loan-date-issued');

  clearFieldError(driverSelect, $('#loan-driver-error'));
  clearFieldError(principalInput, $('#loan-principal-error'));
  clearFieldError(dateInput, $('#loan-date-issued-error'));

  let hasError = false;

  if (!driverSelect.value) {
    showFieldError(driverSelect, $('#loan-driver-error'), 'Select a driver.');
    hasError = true;
  }
  if (!principalInput.value || Number(principalInput.value) <= 0) {
    showFieldError(principalInput, $('#loan-principal-error'), 'Enter a valid loan amount.');
    hasError = true;
  }
  if (!dateInput.value) {
    showFieldError(dateInput, $('#loan-date-issued-error'), 'Date is required.');
    hasError = true;
  }

  if (hasError) return;

  const driver = findRecord(DRIVERS_COLLECTION, (record) => record.id === driverSelect.value);

  addRecord(LOANS_COLLECTION, {
    id: generateId(),
    driverId: driverSelect.value,
    driverName: driver ? driver.name : 'Unknown Driver',
    principal: Number(principalInput.value),
    amountRepaid: 0,
    status: 'active',
    dateIssued: dateInput.value,
    weeklyRepaymentAmount: Number($('#loan-weekly-repayment').value) || null,
    notes: $('#loan-notes').value.trim(),
    createdAt: new Date().toISOString(),
  });

  renderLoansTable();
  closeLoanModal();
}

/**
 * ----------------------------------------------------------------
 * LOG REPAYMENT MODAL
 * ----------------------------------------------------------------
 */

function openRepaymentModal(loanId) {
  const loan = findRecord(LOANS_COLLECTION, (record) => record.id === loanId);
  if (!loan) return;

  pendingRepaymentLoanId = loanId;
  const balance = Math.max(loan.principal - loan.amountRepaid, 0);

  $('#repayment-modal-title').textContent = `Log Repayment — ${loan.driverName}`;
  $('#repayment-balance-label').textContent = `Remaining Balance: ${formatCurrency(balance)}`;
  $('#repayment-amount').value = '';
  clearFieldError($('#repayment-amount'), $('#repayment-amount-error'));

  $('#repayment-modal-overlay').hidden = false;
}

function closeRepaymentModal() {
  pendingRepaymentLoanId = null;
  $('#repayment-modal-overlay').hidden = true;
}

/**
 * Applies a repayment to the loan, capping amountRepaid so it can
 * never exceed the principal, and auto-flips status to "paid-off"
 * once the balance reaches zero.
 */
function handleRepaymentSubmit(event) {
  event.preventDefault();

  const amountInput = $('#repayment-amount');
  clearFieldError(amountInput, $('#repayment-amount-error'));

  const repaymentAmount = Number(amountInput.value);
  if (!repaymentAmount || repaymentAmount <= 0) {
    showFieldError(amountInput, $('#repayment-amount-error'), 'Enter a valid repayment amount.');
    return;
  }

  const loans = getCollection(LOANS_COLLECTION);
  const index = loans.findIndex((record) => record.id === pendingRepaymentLoanId);
  if (index === -1) return;

  const newAmountRepaid = Math.min(loans[index].amountRepaid + repaymentAmount, loans[index].principal);

  loans[index] = {
    ...loans[index],
    amountRepaid: newAmountRepaid,
    status: newAmountRepaid >= loans[index].principal ? 'paid-off' : 'active',
  };
  saveCollection(LOANS_COLLECTION, loans);

  renderLoansTable();
  closeRepaymentModal();
}

/**
 * ----------------------------------------------------------------
 * DELETE CONFIRMATION
 * ----------------------------------------------------------------
 */

function openDeleteLoanModal(loanId) {
  pendingDeleteLoanId = loanId;
  $('#delete-loan-modal-overlay').hidden = false;
}

function closeDeleteLoanModal() {
  pendingDeleteLoanId = null;
  $('#delete-loan-modal-overlay').hidden = true;
}

function confirmDeleteLoan() {
  if (!pendingDeleteLoanId) return;
  const loans = getCollection(LOANS_COLLECTION).filter((record) => record.id !== pendingDeleteLoanId);
  saveCollection(LOANS_COLLECTION, loans);
  renderLoansTable();
  closeDeleteLoanModal();
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

  renderSidebar('loans');
  renderLoansTable();

  $('#loan-search-input').addEventListener('input', (event) => {
    currentSearchTerm = event.target.value;
    renderLoansTable();
  });

  $('#open-issue-loan-btn').addEventListener('click', openIssueLoanModal);
  $('#loan-modal-close-btn').addEventListener('click', closeLoanModal);
  $('#loan-cancel-btn').addEventListener('click', closeLoanModal);
  $('#loan-form').addEventListener('submit', handleLoanSubmit);

  $('#repayment-modal-close-btn').addEventListener('click', closeRepaymentModal);
  $('#repayment-cancel-btn').addEventListener('click', closeRepaymentModal);
  $('#repayment-form').addEventListener('submit', handleRepaymentSubmit);

  $('#delete-loan-cancel-btn').addEventListener('click', closeDeleteLoanModal);
  $('#delete-loan-confirm-btn').addEventListener('click', confirmDeleteLoan);
});