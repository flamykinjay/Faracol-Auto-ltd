/**
 * maintenance.js
 * ----------------------------------------------------------------
 * Page-specific logic for maintenance.html.
 *
 * EXPENSE LINKING: saving a maintenance record with a cost > 0
 * automatically creates a matching entry in the "expenses"
 * collection (category: "Maintenance"), so the cost flows into
 * Payments/Reports totals without being entered twice. The created
 * expense's id is stored on the maintenance record (linkedExpenseId)
 * so it can be kept in sync on edit and cleaned up on delete —
 * there should never be an orphaned expense with no maintenance
 * record behind it, or vice versa.
 *
 * DATA MODEL:
 * "maintenanceRecords": { id, vehicleId, vehicleLabel (snapshot —
 *   survives vehicle deletion), serviceType, description, cost,
 *   date, nextServiceDue (optional), linkedExpenseId, createdAt }
 *
 * NO LIMITS: no maximum enforced on how many records can be created.
 *
 * Depends on: utils.js, storage.js, auth.js, nav.js.
 * ----------------------------------------------------------------
 */

const MAINTENANCE_COLLECTION = 'maintenanceRecords';
const VEHICLES_COLLECTION = 'vehicles';
const EXPENSES_COLLECTION = 'expenses';

let currentlyEditingMaintenanceId = null;
let pendingDeleteMaintenanceId = null;
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
 * RENDERING
 * ----------------------------------------------------------------
 */

function formatNextDue(dateString) {
  if (!dateString) {
    return '<span class="vehicle-cell-plate">—</span>';
  }

  const dueDate = new Date(dateString);
  const today = new Date();
  const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

  const formatted = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (daysUntilDue < 0) {
    return `<span class="next-due-overdue">${formatted} (overdue)</span>`;
  }
  if (daysUntilDue <= 7) {
    return `<span class="next-due-soon">${formatted} (soon)</span>`;
  }
  return formatted;
}

function buildMaintenanceRow(record) {
  return `
    <tr data-maintenance-id="${record.id}">
      <td>${record.vehicleLabel}</td>
      <td>${record.serviceType}</td>
      <td>${record.description}</td>
      <td>${formatCurrency(record.cost)}</td>
      <td>${new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
      <td>${formatNextDue(record.nextServiceDue)}</td>
      <td class="col-actions">
        <button type="button" class="row-action-btn edit-maintenance-btn" data-maintenance-id="${record.id}" aria-label="Edit record">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button type="button" class="row-action-btn row-action-danger delete-maintenance-btn" data-maintenance-id="${record.id}" aria-label="Delete record">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </td>
    </tr>
  `;
}

function filterMaintenanceRecords(records) {
  if (!currentSearchTerm.trim()) {
    return records;
  }

  const term = currentSearchTerm.trim().toLowerCase();
  return records.filter((record) =>
    [record.vehicleLabel, record.serviceType, record.description].join(' ').toLowerCase().includes(term)
  );
}

function renderMaintenanceTable() {
  const allRecords = getCollection(MAINTENANCE_COLLECTION).slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  const records = filterMaintenanceRecords(allRecords);

  const table = $('#maintenance-table');
  const emptyState = $('#maintenance-empty-state');
  const tableBody = $('#maintenance-table-body');
  const subtitle = $('#maintenance-count-subtitle');

  subtitle.textContent = `${allRecords.length} record${allRecords.length === 1 ? '' : 's'}`;

  if (records.length === 0) {
    table.hidden = true;
    emptyState.hidden = false;
    emptyState.querySelector('p').textContent = currentSearchTerm
      ? 'No maintenance records match your search.'
      : 'No maintenance records yet. Click "Log Maintenance" to add one.';
    tableBody.innerHTML = '';
    return;
  }

  table.hidden = false;
  emptyState.hidden = true;
  tableBody.innerHTML = records.map(buildMaintenanceRow).join('');

  document.querySelectorAll('.edit-maintenance-btn').forEach((button) => {
    button.addEventListener('click', () => openEditMaintenanceModal(button.dataset.maintenanceId));
  });
  document.querySelectorAll('.delete-maintenance-btn').forEach((button) => {
    button.addEventListener('click', () => openDeleteMaintenanceModal(button.dataset.maintenanceId));
  });
}

/**
 * ----------------------------------------------------------------
 * ADD / EDIT MODAL
 * ----------------------------------------------------------------
 */

function populateVehicleSelect() {
  const vehicles = getCollection(VEHICLES_COLLECTION);
  const select = $('#maintenance-vehicle');
  select.innerHTML = vehicles
    .map((vehicle) => `<option value="${vehicle.id}">${vehicle.type} — ${vehicle.plateNumber}</option>`)
    .join('');
}

function resetMaintenanceForm() {
  $('#maintenance-form').reset();
  clearFieldError($('#maintenance-vehicle'), $('#maintenance-vehicle-error'));
  clearFieldError($('#maintenance-description'), $('#maintenance-description-error'));
  clearFieldError($('#maintenance-cost'), $('#maintenance-cost-error'));
  clearFieldError($('#maintenance-date'), $('#maintenance-date-error'));
  $('#maintenance-date').value = new Date().toISOString().split('T')[0];
}

function openAddMaintenanceModal() {
  currentlyEditingMaintenanceId = null;
  $('#maintenance-modal-title').textContent = 'Log Maintenance';
  populateVehicleSelect();
  resetMaintenanceForm();
  $('#maintenance-modal-overlay').hidden = false;
}

function openEditMaintenanceModal(recordId) {
  const record = findRecord(MAINTENANCE_COLLECTION, (r) => r.id === recordId);
  if (!record) return;

  currentlyEditingMaintenanceId = recordId;
  $('#maintenance-modal-title').textContent = 'Edit Maintenance Record';
  populateVehicleSelect();

  $('#maintenance-vehicle').value = record.vehicleId;
  $('#maintenance-service-type').value = record.serviceType;
  $('#maintenance-description').value = record.description;
  $('#maintenance-cost').value = record.cost;
  $('#maintenance-date').value = record.date;
  $('#maintenance-next-due').value = record.nextServiceDue || '';

  $('#maintenance-modal-overlay').hidden = false;
}

function closeMaintenanceModal() {
  currentlyEditingMaintenanceId = null;
  $('#maintenance-modal-overlay').hidden = true;
}

/**
 * Creates or updates the linked expense record to match a
 * maintenance record's current cost/description/date. Returns
 * the expense id to store on the maintenance record.
 * @param {Object} maintenanceData
 * @param {string|null} existingExpenseId
 * @returns {string}
 */
function syncLinkedExpense(maintenanceData, existingExpenseId) {
  const expenseData = {
    category: 'Maintenance',
    description: `${maintenanceData.serviceType} — ${maintenanceData.vehicleLabel}: ${maintenanceData.description}`,
    amount: maintenanceData.cost,
    date: maintenanceData.date,
  };

  if (existingExpenseId) {
    const expenses = getCollection(EXPENSES_COLLECTION);
    const index = expenses.findIndex((record) => record.id === existingExpenseId);
    if (index !== -1) {
      expenses[index] = { ...expenses[index], ...expenseData };
      saveCollection(EXPENSES_COLLECTION, expenses);
      return existingExpenseId;
    }
  }

  const newExpenseId = generateId();
  addRecord(EXPENSES_COLLECTION, {
    id: newExpenseId,
    ...expenseData,
    createdAt: new Date().toISOString(),
  });
  return newExpenseId;
}

function handleMaintenanceSubmit(event) {
  event.preventDefault();

  const vehicleSelect = $('#maintenance-vehicle');
  const descriptionInput = $('#maintenance-description');
  const costInput = $('#maintenance-cost');
  const dateInput = $('#maintenance-date');

  clearFieldError(vehicleSelect, $('#maintenance-vehicle-error'));
  clearFieldError(descriptionInput, $('#maintenance-description-error'));
  clearFieldError(costInput, $('#maintenance-cost-error'));
  clearFieldError(dateInput, $('#maintenance-date-error'));

  let hasError = false;

  if (!vehicleSelect.value) {
    showFieldError(vehicleSelect, $('#maintenance-vehicle-error'), 'Select a vehicle.');
    hasError = true;
  }
  if (!descriptionInput.value.trim()) {
    showFieldError(descriptionInput, $('#maintenance-description-error'), 'Description is required.');
    hasError = true;
  }
  if (!costInput.value || Number(costInput.value) < 0) {
    showFieldError(costInput, $('#maintenance-cost-error'), 'Enter a valid cost.');
    hasError = true;
  }
  if (!dateInput.value) {
    showFieldError(dateInput, $('#maintenance-date-error'), 'Date is required.');
    hasError = true;
  }

  if (hasError) return;

  const vehicle = findRecord(VEHICLES_COLLECTION, (record) => record.id === vehicleSelect.value);

  const maintenanceData = {
    vehicleId: vehicleSelect.value,
    vehicleLabel: vehicle ? `${vehicle.type} — ${vehicle.plateNumber}` : 'Unknown Vehicle',
    serviceType: $('#maintenance-service-type').value,
    description: descriptionInput.value.trim(),
    cost: Number(costInput.value),
    date: dateInput.value,
    nextServiceDue: $('#maintenance-next-due').value || null,
  };

  if (currentlyEditingMaintenanceId) {
    const records = getCollection(MAINTENANCE_COLLECTION);
    const index = records.findIndex((record) => record.id === currentlyEditingMaintenanceId);
    if (index !== -1) {
      const linkedExpenseId = syncLinkedExpense(maintenanceData, records[index].linkedExpenseId);
      records[index] = { ...records[index], ...maintenanceData, linkedExpenseId };
      saveCollection(MAINTENANCE_COLLECTION, records);
    }
  } else {
    const linkedExpenseId = syncLinkedExpense(maintenanceData, null);
    addRecord(MAINTENANCE_COLLECTION, {
      id: generateId(),
      ...maintenanceData,
      linkedExpenseId,
      createdAt: new Date().toISOString(),
    });
  }

  renderMaintenanceTable();
  closeMaintenanceModal();
}

/**
 * ----------------------------------------------------------------
 * DELETE CONFIRMATION
 * ----------------------------------------------------------------
 */

function openDeleteMaintenanceModal(recordId) {
  pendingDeleteMaintenanceId = recordId;
  $('#delete-maintenance-modal-overlay').hidden = false;
}

function closeDeleteMaintenanceModal() {
  pendingDeleteMaintenanceId = null;
  $('#delete-maintenance-modal-overlay').hidden = true;
}

/**
 * Deletes the maintenance record AND its linked expense entry —
 * keeping the two collections from ever drifting out of sync.
 */
function confirmDeleteMaintenance() {
  if (!pendingDeleteMaintenanceId) return;

  const records = getCollection(MAINTENANCE_COLLECTION);
  const record = records.find((r) => r.id === pendingDeleteMaintenanceId);

  if (record && record.linkedExpenseId) {
    const expenses = getCollection(EXPENSES_COLLECTION).filter((e) => e.id !== record.linkedExpenseId);
    saveCollection(EXPENSES_COLLECTION, expenses);
  }

  const updatedRecords = records.filter((r) => r.id !== pendingDeleteMaintenanceId);
  saveCollection(MAINTENANCE_COLLECTION, updatedRecords);

  renderMaintenanceTable();
  closeDeleteMaintenanceModal();
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

  renderSidebar('maintenance');
  renderMaintenanceTable();

  $('#maintenance-search-input').addEventListener('input', (event) => {
    currentSearchTerm = event.target.value;
    renderMaintenanceTable();
  });

  $('#open-add-maintenance-btn').addEventListener('click', openAddMaintenanceModal);
  $('#maintenance-modal-close-btn').addEventListener('click', closeMaintenanceModal);
  $('#maintenance-cancel-btn').addEventListener('click', closeMaintenanceModal);
  $('#maintenance-form').addEventListener('submit', handleMaintenanceSubmit);

  $('#delete-maintenance-cancel-btn').addEventListener('click', closeDeleteMaintenanceModal);
  $('#delete-maintenance-confirm-btn').addEventListener('click', confirmDeleteMaintenance);
});