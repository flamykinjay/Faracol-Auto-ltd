/**
 * drivers.js
 * ----------------------------------------------------------------
 * Page-specific logic for drivers.html.
 *
 * DRIVER LOGIN MANAGEMENT: only the admin can create or reset a
 * driver's login — there is no self-signup path anywhere in this
 * app. A driver's login lives in the shared "users" collection as
 * a record with role: "driver" and linkedDriverId pointing back to
 * their record in "drivers". Login status is looked up live (same
 * pattern as payment status and vehicle assignment) rather than
 * stored as a flag on the driver record, so it can never drift out
 * of sync with the actual users collection.
 *
 * The Login ID is a free-text field the admin sets per driver
 * (e.g. "musa@fleetledger.com") — it is NOT validated as a real
 * email address, just styled like one for familiarity. Passwords
 * are hashed with the existing hashText() from utils.js, same as
 * the admin login, and are only ever shown once, immediately after
 * being generated or reset.
 *
 * PAYMENT STATUS: derived live from the current OPEN week's payment
 * record (see getDriverPaymentStatus).
 *
 * Depends on: utils.js, storage.js, auth.js, nav.js.
 * ----------------------------------------------------------------
 */

const DRIVERS_COLLECTION = 'drivers';
const VEHICLES_COLLECTION = 'vehicles';
const WEEKS_COLLECTION = 'weeks';
const PAYMENTS_COLLECTION = 'payments';
// USERS_COLLECTION is already declared in auth.js, which loads
// before this file on every page — reused here, not redeclared.

let currentlyEditingDriverId = null;
let pendingDeleteDriverId = null;
let pendingAssignDriverId = null;
let pendingLoginDriverId = null;
let bulkRowCounter = 0;
let currentSearchTerm = '';

function getInitials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function formatWorkStatus(status) {
  const labels = {
    'on-duty': 'On Duty',
    'off-duty': 'Off Duty',
    sick: 'Sick',
    suspended: 'Suspended',
  };
  return labels[status] || status;
}

function getDriverPaymentStatus(driverId) {
  const openWeek = findRecord(WEEKS_COLLECTION, (record) => record.status === 'open');
  if (!openWeek) {
    return null;
  }

  const payment = findRecord(
    PAYMENTS_COLLECTION,
    (record) => record.weekId === openWeek.id && record.driverId === driverId
  );

  return payment ? payment.status : null;
}

/**
 * Looks up whether a driver has a login set up yet.
 * @param {string} driverId
 * @returns {Object|null} The user record, or null if none exists.
 */
function getDriverLoginRecord(driverId) {
  return findRecord(USERS_COLLECTION, (record) => record.role === 'driver' && record.linkedDriverId === driverId) || null;
}

function buildDriverRow(driver) {
  const vehicle = findRecord(VEHICLES_COLLECTION, (record) => record.id === driver.vehicleId);
  const vehicleDisplay = vehicle
    ? `<div class="vehicle-cell-type">${vehicle.type}</div><div class="vehicle-cell-plate">${vehicle.plateNumber}</div>`
    : '<span class="vehicle-cell-plate">No vehicle linked</span>';

  const formattedTarget = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(driver.weeklyTarget);

  const paymentStatus = getDriverPaymentStatus(driver.id);
  const paymentBadge = paymentStatus
    ? `<span class="status-badge status-badge-${paymentStatus === 'paid' ? 'paid' : paymentStatus === 'partial' ? 'sick' : 'owing'}">${paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1)}</span>`
    : `<span class="status-badge status-badge-off-duty">No Data</span>`;

  const loginRecord = getDriverLoginRecord(driver.id);
  const loginBadge = loginRecord
    ? `<span class="status-badge status-badge-paid">Active</span>`
    : `<span class="status-badge status-badge-off-duty">No Login</span>`;

  return `
    <tr data-driver-id="${driver.id}">
      <td>
        <div class="driver-cell">
          <div class="driver-avatar">${getInitials(driver.name)}</div>
          <span class="driver-name">${driver.name}</span>
        </div>
      </td>
      <td>${driver.phone}</td>
      <td>${vehicleDisplay}</td>
      <td>${formattedTarget}</td>
      <td><span class="status-badge status-badge-${driver.workStatus}">${formatWorkStatus(driver.workStatus)}</span></td>
      <td>${paymentBadge}</td>
      <td>${loginBadge}</td>
      <td class="col-actions">
        <button type="button" class="row-action-btn login-driver-btn" data-driver-id="${driver.id}" aria-label="Manage login">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </button>
        <button type="button" class="row-action-btn change-vehicle-btn" data-driver-id="${driver.id}" aria-label="Change vehicle">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
        </button>
        <button type="button" class="row-action-btn edit-driver-btn" data-driver-id="${driver.id}" aria-label="Edit driver">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button type="button" class="row-action-btn row-action-danger delete-driver-btn" data-driver-id="${driver.id}" aria-label="Delete driver">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </td>
    </tr>
  `;
}

function filterDrivers(drivers) {
  if (!currentSearchTerm.trim()) {
    return drivers;
  }

  const term = currentSearchTerm.trim().toLowerCase();

  return drivers.filter((driver) => {
    const vehicle = findRecord(VEHICLES_COLLECTION, (record) => record.id === driver.vehicleId);

    const haystack = [
      driver.name,
      driver.phone,
      vehicle ? vehicle.type : '',
      vehicle ? vehicle.plateNumber : '',
      vehicle ? vehicle.chassisNumber : '',
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(term);
  });
}

function renderDriversTable() {
  const allDrivers = getCollection(DRIVERS_COLLECTION);
  const drivers = filterDrivers(allDrivers);
  const tableBody = $('#drivers-table-body');
  const emptyState = $('#drivers-empty-state');
  const table = $('#drivers-table');
  const subtitle = $('#driver-count-subtitle');

  subtitle.textContent = `${allDrivers.length} driver${allDrivers.length === 1 ? '' : 's'}`;

  if (drivers.length === 0) {
    table.hidden = true;
    emptyState.hidden = false;
    emptyState.querySelector('p').textContent = currentSearchTerm
      ? 'No drivers match your search.'
      : 'No drivers added yet. Click "Add Driver" to get started.';
    tableBody.innerHTML = '';
    return;
  }

  table.hidden = false;
  emptyState.hidden = true;
  tableBody.innerHTML = drivers.map(buildDriverRow).join('');

  document.querySelectorAll('.edit-driver-btn').forEach((button) => {
    button.addEventListener('click', () => openEditDriverModal(button.dataset.driverId));
  });

  document.querySelectorAll('.delete-driver-btn').forEach((button) => {
    button.addEventListener('click', () => openDeleteConfirmModal(button.dataset.driverId));
  });

  document.querySelectorAll('.change-vehicle-btn').forEach((button) => {
    button.addEventListener('click', () => openAssignVehicleModal(button.dataset.driverId));
  });

  document.querySelectorAll('.login-driver-btn').forEach((button) => {
    button.addEventListener('click', () => openDriverLoginModal(button.dataset.driverId));
  });
}

function resetSingleDriverForm() {
  const form = $('#single-driver-form');
  form.reset();

  ['name', 'phone', 'weekly-target', 'vehicle-type', 'plate-number', 'chassis-number'].forEach((field) => {
    const input = $(`#single-${field}`);
    const error = $(`#single-${field}-error`);
    if (input && error) {
      clearFieldError(input, error);
    }
  });

  $('#single-join-date').value = new Date().toISOString().split('T')[0];
}

function openEditDriverModal(driverId) {
  const driver = findRecord(DRIVERS_COLLECTION, (record) => record.id === driverId);
  if (!driver) {
    return;
  }

  const vehicle = findRecord(VEHICLES_COLLECTION, (record) => record.id === driver.vehicleId);

  currentlyEditingDriverId = driverId;

  $('#driver-modal-title').textContent = 'Edit Driver';
  $('#driver-modal-tabs').hidden = true;
  $('#bulk-driver-form').hidden = true;
  $('#single-driver-form').hidden = false;

  $('#single-name').value = driver.name;
  $('#single-phone').value = driver.phone;
  $('#single-weekly-target').value = driver.weeklyTarget;
  $('#single-join-date').value = driver.joinDate;
  $('#single-work-status').value = driver.workStatus;

  $('#single-vehicle-type').value = vehicle ? vehicle.type : '';
  $('#single-plate-number').value = vehicle ? vehicle.plateNumber : '';
  $('#single-chassis-number').value = vehicle ? vehicle.chassisNumber : '';

  $('#driver-modal-overlay').hidden = false;
}

function openAddDriverModal() {
  currentlyEditingDriverId = null;

  $('#driver-modal-title').textContent = 'Add Driver';
  $('#driver-modal-tabs').hidden = false;
  switchDriverModalTab('single');
  resetSingleDriverForm();
  resetBulkDriverForm();

  $('#driver-modal-overlay').hidden = false;
}

function closeDriverModal() {
  $('#driver-modal-overlay').hidden = true;
  currentlyEditingDriverId = null;
}

function switchDriverModalTab(mode) {
  const singleTab = $('#tab-single');
  const bulkTab = $('#tab-bulk');
  const singleForm = $('#single-driver-form');
  const bulkForm = $('#bulk-driver-form');

  const isSingle = mode === 'single';

  singleTab.classList.toggle('modal-tab-active', isSingle);
  bulkTab.classList.toggle('modal-tab-active', !isSingle);
  singleForm.hidden = !isSingle;
  bulkForm.hidden = isSingle;
}

async function handleSingleDriverSubmit(event) {
  event.preventDefault();

  const fields = {
    name: $('#single-name'),
    phone: $('#single-phone'),
    'weekly-target': $('#single-weekly-target'),
    'join-date': $('#single-join-date'),
    'vehicle-type': $('#single-vehicle-type'),
    'plate-number': $('#single-plate-number'),
    'chassis-number': $('#single-chassis-number'),
  };

  let hasError = false;

  Object.entries(fields).forEach(([key, input]) => {
    const errorEl = $(`#single-${key}-error`);
    clearFieldError(input, errorEl);

    if (!input.value.trim()) {
      showFieldError(input, errorEl, 'This field is required.');
      hasError = true;
    }
  });

  if (hasError) {
    return;
  }

  const submitButton = $('#single-submit-btn');
  const submitLabel = $('.btn-label', submitButton);
  const submitSpinner = $('.btn-spinner', submitButton);
  submitButton.disabled = true;
  submitLabel.hidden = true;
  submitSpinner.hidden = false;

  if (currentlyEditingDriverId) {
    updateDriverAndVehicle(currentlyEditingDriverId, fields);
  } else {
    createDriverWithVehicle(fields);
  }

  renderDriversTable();
  closeDriverModal();

  submitButton.disabled = false;
  submitLabel.hidden = false;
  submitSpinner.hidden = true;
}

function createDriverWithVehicle(fields) {
  const newVehicle = {
    id: generateId(),
    type: fields['vehicle-type'].value.trim(),
    plateNumber: fields['plate-number'].value.trim(),
    chassisNumber: fields['chassis-number'].value.trim(),
    createdAt: new Date().toISOString(),
  };
  addRecord(VEHICLES_COLLECTION, newVehicle);

  const newDriver = {
    id: generateId(),
    name: fields.name.value.trim(),
    phone: fields.phone.value.trim(),
    vehicleId: newVehicle.id,
    weeklyTarget: Number(fields['weekly-target'].value),
    joinDate: fields['join-date'].value,
    workStatus: $('#single-work-status').value,
    createdAt: new Date().toISOString(),
  };
  addRecord(DRIVERS_COLLECTION, newDriver);
}

function updateDriverAndVehicle(driverId, fields) {
  const drivers = getCollection(DRIVERS_COLLECTION);
  const driverIndex = drivers.findIndex((record) => record.id === driverId);
  if (driverIndex === -1) {
    return;
  }

  drivers[driverIndex] = {
    ...drivers[driverIndex],
    name: fields.name.value.trim(),
    phone: fields.phone.value.trim(),
    weeklyTarget: Number(fields['weekly-target'].value),
    joinDate: fields['join-date'].value,
    workStatus: $('#single-work-status').value,
  };
  saveCollection(DRIVERS_COLLECTION, drivers);

  const vehicles = getCollection(VEHICLES_COLLECTION);
  const vehicleIndex = vehicles.findIndex((record) => record.id === drivers[driverIndex].vehicleId);
  if (vehicleIndex !== -1) {
    vehicles[vehicleIndex] = {
      ...vehicles[vehicleIndex],
      type: fields['vehicle-type'].value.trim(),
      plateNumber: fields['plate-number'].value.trim(),
      chassisNumber: fields['chassis-number'].value.trim(),
    };
    saveCollection(VEHICLES_COLLECTION, vehicles);
  }
}

function buildBulkRow(rowNumber) {
  return `
    <div class="bulk-row" data-row-number="${rowNumber}">
      <div class="bulk-row-header">
        <span class="bulk-row-label">Driver ${rowNumber}</span>
        <button type="button" class="bulk-row-remove-btn" data-row-number="${rowNumber}" aria-label="Remove row">
          <svg viewBox="0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label" for="bulk-name-${rowNumber}">Driver Name</label>
          <input type="text" id="bulk-name-${rowNumber}" class="form-input bulk-field" placeholder="Full name" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="bulk-phone-${rowNumber}">Phone Number</label>
          <input type="tel" id="bulk-phone-${rowNumber}" class="form-input bulk-field" placeholder="Phone number" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="bulk-weekly-target-${rowNumber}">Weekly Target (₦)</label>
          <input type="number" id="bulk-weekly-target-${rowNumber}" class="form-input bulk-field" placeholder="0" min="0" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="bulk-vehicle-type-${rowNumber}">Vehicle Type</label>
          <input type="text" id="bulk-vehicle-type-${rowNumber}" class="form-input bulk-field" placeholder="e.g. Toyota Camry" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="bulk-plate-number-${rowNumber}">Plate Number</label>
          <input type="text" id="bulk-plate-number-${rowNumber}" class="form-input bulk-field" placeholder="Plate number" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="bulk-chassis-number-${rowNumber}">Chassis Number</label>
          <input type="text" id="bulk-chassis-number-${rowNumber}" class="form-input bulk-field" placeholder="Chassis number" required>
        </div>
      </div>
    </div>
  `;
}

function resetBulkDriverForm() {
  bulkRowCounter = 1;
  $('#bulk-rows-wrapper').innerHTML = buildBulkRow(bulkRowCounter);
  wireBulkRowRemoveButtons();
}

function addBulkRow() {
  bulkRowCounter += 1;
  $('#bulk-rows-wrapper').insertAdjacentHTML('beforeend', buildBulkRow(bulkRowCounter));
  wireBulkRowRemoveButtons();
}

function wireBulkRowRemoveButtons() {
  document.querySelectorAll('.bulk-row-remove-btn').forEach((button) => {
    button.onclick = () => {
      const rows = document.querySelectorAll('.bulk-row');
      if (rows.length <= 1) {
        return;
      }
      button.closest('.bulk-row').remove();
    };
  });
}

function handleBulkDriverSubmit(event) {
  event.preventDefault();

  const rows = document.querySelectorAll('.bulk-row');
  let hasError = false;

  rows.forEach((row) => {
    row.querySelectorAll('.bulk-field').forEach((input) => {
      if (!input.value.trim()) {
        input.classList.add('input-invalid');
        hasError = true;
      } else {
        input.classList.remove('input-invalid');
      }
    });
  });

  if (hasError) {
    return;
  }

  const submitButton = $('#bulk-submit-btn');
  const submitLabel = $('.btn-label', submitButton);
  const submitSpinner = $('.btn-spinner', submitButton);
  submitButton.disabled = true;
  submitLabel.hidden = true;
  submitSpinner.hidden = false;

  rows.forEach((row) => {
    const rowNumber = row.dataset.rowNumber;

    const newVehicle = {
      id: generateId(),
      type: $(`#bulk-vehicle-type-${rowNumber}`).value.trim(),
      plateNumber: $(`#bulk-plate-number-${rowNumber}`).value.trim(),
      chassisNumber: $(`#bulk-chassis-number-${rowNumber}`).value.trim(),
      createdAt: new Date().toISOString(),
    };
    addRecord(VEHICLES_COLLECTION, newVehicle);

    const newDriver = {
      id: generateId(),
      name: $(`#bulk-name-${rowNumber}`).value.trim(),
      phone: $(`#bulk-phone-${rowNumber}`).value.trim(),
      vehicleId: newVehicle.id,
      weeklyTarget: Number($(`#bulk-weekly-target-${rowNumber}`).value),
      joinDate: new Date().toISOString().split('T')[0],
      workStatus: 'on-duty',
      createdAt: new Date().toISOString(),
    };
    addRecord(DRIVERS_COLLECTION, newDriver);
  });

  renderDriversTable();
  closeDriverModal();

  submitButton.disabled = false;
  submitLabel.hidden = false;
  submitSpinner.hidden = true;
}

function openAssignVehicleModal(driverId) {
  const driver = findRecord(DRIVERS_COLLECTION, (record) => record.id === driverId);
  if (!driver) {
    return;
  }

  pendingAssignDriverId = driverId;

  $('#assign-vehicle-driver-label').textContent = `Assigning vehicle for: ${driver.name}`;

  const vehicles = getCollection(VEHICLES_COLLECTION);
  const allDrivers = getCollection(DRIVERS_COLLECTION);
  const select = $('#assign-vehicle-select');

  const options = ['<option value="">— No vehicle —</option>'];

  vehicles.forEach((vehicle) => {
    const assignedDriver = allDrivers.find((record) => record.vehicleId === vehicle.id && record.id !== driverId);
    const suffix = assignedDriver ? ` (currently: ${assignedDriver.name})` : '';
    const isSelected = vehicle.id === driver.vehicleId ? 'selected' : '';
    options.push(`<option value="${vehicle.id}" ${isSelected}>${vehicle.type} — ${vehicle.plateNumber}${suffix}</option>`);
  });

  select.innerHTML = options.join('');
  $('#assign-vehicle-warning').textContent = '';

  $('#assign-vehicle-modal-overlay').hidden = false;
}

function closeAssignVehicleModal() {
  pendingAssignDriverId = null;
  $('#assign-vehicle-modal-overlay').hidden = true;
}

function confirmAssignVehicle() {
  if (!pendingAssignDriverId) {
    return;
  }

  const selectedVehicleId = $('#assign-vehicle-select').value || null;
  const drivers = getCollection(DRIVERS_COLLECTION);

  const updatedDrivers = drivers.map((driver) => {
    if (driver.id === pendingAssignDriverId) {
      return { ...driver, vehicleId: selectedVehicleId };
    }
    if (selectedVehicleId && driver.vehicleId === selectedVehicleId) {
      return { ...driver, vehicleId: null };
    }
    return driver;
  });

  saveCollection(DRIVERS_COLLECTION, updatedDrivers);

  renderDriversTable();
  closeAssignVehicleModal();
}

/**
 * ----------------------------------------------------------------
 * DRIVER LOGIN MANAGEMENT
 * ----------------------------------------------------------------
 */

/**
 * Generates a random, reasonably secure password: 10 characters,
 * mixing letters, numbers, and a couple of symbols — easy enough
 * to read aloud or type from a screenshot, but not guessable.
 * @returns {string}
 */
function generateSecurePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#';
  let password = '';
  for (let i = 0; i < 10; i += 1) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function openDriverLoginModal(driverId) {
  const driver = findRecord(DRIVERS_COLLECTION, (record) => record.id === driverId);
  if (!driver) {
    return;
  }

  pendingLoginDriverId = driverId;
  const existingLogin = getDriverLoginRecord(driverId);

  $('#login-result-view').hidden = true;
  $('#driver-login-save-btn').hidden = false;
  $('#driver-login-done-btn').hidden = true;

  if (existingLogin) {
    $('#driver-login-modal-title').textContent = `Login — ${driver.name}`;
    $('#login-setup-view').hidden = true;
    $('#login-existing-view').hidden = false;
    $('#existing-login-id-display').value = existingLogin.email;
    $('#driver-login-save-btn').hidden = true;
  } else {
    $('#driver-login-modal-title').textContent = `Set Up Login — ${driver.name}`;
    $('#login-setup-view').hidden = false;
    $('#login-existing-view').hidden = true;
    $('#driver-login-id').value = '';
    $('#driver-login-password').value = generateSecurePassword();
    clearFieldError($('#driver-login-id'), $('#driver-login-id-error'));
    clearFieldError($('#driver-login-password'), $('#driver-login-password-error'));
  }

  $('#driver-login-modal-overlay').hidden = false;
}

function closeDriverLoginModal() {
  pendingLoginDriverId = null;
  $('#driver-login-modal-overlay').hidden = true;
}

/**
 * Creates a brand-new driver login: validates the Login ID is
 * unique across all users, hashes the password, and links the new
 * user record back to this driver.
 */
async function handleCreateDriverLogin() {
  const idInput = $('#driver-login-id');
  const passwordInput = $('#driver-login-password');
  clearFieldError(idInput, $('#driver-login-id-error'));
  clearFieldError(passwordInput, $('#driver-login-password-error'));

  const loginId = idInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  if (!loginId) {
    showFieldError(idInput, $('#driver-login-id-error'), 'Login ID is required.');
    return;
  }

  if (!password || password.length < 6) {
    showFieldError(passwordInput, $('#driver-login-password-error'), 'Password must be at least 6 characters.');
    return;
  }

  const existingUsers = getCollection(USERS_COLLECTION);
  const idTaken = existingUsers.some((record) => record.email.toLowerCase() === loginId);
  if (idTaken) {
    showFieldError(idInput, $('#driver-login-id-error'), 'This Login ID is already in use.');
    return;
  }

  const driver = findRecord(DRIVERS_COLLECTION, (record) => record.id === pendingLoginDriverId);
  const passwordHash = await hashText(password);

  addRecord(USERS_COLLECTION, {
    id: generateId(),
    name: driver.name,
    email: loginId,
    passwordHash,
    role: 'driver',
    linkedDriverId: pendingLoginDriverId,
  });

  showLoginResult(loginId, password);
}

/**
 * Resets an existing driver's password to a new randomly generated
 * one, keeping their Login ID unchanged.
 */
async function handleResetDriverPassword() {
  const existingLogin = getDriverLoginRecord(pendingLoginDriverId);
  if (!existingLogin) return;

  const newPassword = generateSecurePassword();
  const newHash = await hashText(newPassword);

  const users = getCollection(USERS_COLLECTION);
  const index = users.findIndex((record) => record.id === existingLogin.id);
  if (index !== -1) {
    users[index] = { ...users[index], passwordHash: newHash };
    saveCollection(USERS_COLLECTION, users);
  }

  showLoginResult(existingLogin.email, newPassword);
}

/**
 * Displays the final "copy this now" view with the Login ID and
 * plain-text password — the only moment the password is ever visible.
 */
function showLoginResult(loginId, password) {
  $('#login-setup-view').hidden = true;
  $('#login-existing-view').hidden = true;
  $('#login-result-view').hidden = false;

  $('#result-login-id').value = loginId;
  $('#result-password').value = password;

  $('#driver-login-save-btn').hidden = true;
  $('#driver-login-done-btn').hidden = false;

  renderDriversTable();
}

/**
 * ----------------------------------------------------------------
 * DELETE CONFIRMATION MODAL
 * ----------------------------------------------------------------
 */

function openDeleteConfirmModal(driverId) {
  pendingDeleteDriverId = driverId;
  $('#delete-modal-overlay').hidden = false;
}

function closeDeleteConfirmModal() {
  pendingDeleteDriverId = null;
  $('#delete-modal-overlay').hidden = true;
}

/**
 * Deletes the driver record. Also removes their login (if any) —
 * a login with no driver behind it would be a dangling account
 * with no purpose. Payment history is intentionally left intact.
 */
function confirmDeleteDriver() {
  if (!pendingDeleteDriverId) {
    return;
  }

  const users = getCollection(USERS_COLLECTION);
  const updatedUsers = users.filter(
    (record) => !(record.role === 'driver' && record.linkedDriverId === pendingDeleteDriverId)
  );
  saveCollection(USERS_COLLECTION, updatedUsers);

  const drivers = getCollection(DRIVERS_COLLECTION);
  const updatedDrivers = drivers.filter((record) => record.id !== pendingDeleteDriverId);
  saveCollection(DRIVERS_COLLECTION, updatedDrivers);

  renderDriversTable();
  closeDeleteConfirmModal();
}

document.addEventListener('DOMContentLoaded', () => {
  const session = getActiveSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }

  renderSidebar('drivers');
  renderDriversTable();

  $('#driver-search-input').addEventListener('input', (event) => {
    currentSearchTerm = event.target.value;
    renderDriversTable();
  });

  $('#open-add-driver-btn').addEventListener('click', openAddDriverModal);
  $('#driver-modal-close-btn').addEventListener('click', closeDriverModal);
  $('#single-cancel-btn').addEventListener('click', closeDriverModal);
  $('#bulk-cancel-btn').addEventListener('click', closeDriverModal);

  $('#tab-single').addEventListener('click', () => switchDriverModalTab('single'));
  $('#tab-bulk').addEventListener('click', () => switchDriverModalTab('bulk'));

  $('#single-driver-form').addEventListener('submit', handleSingleDriverSubmit);
  $('#bulk-driver-form').addEventListener('submit', handleBulkDriverSubmit);

  $('#add-bulk-row-btn').addEventListener('click', addBulkRow);

  $('#delete-cancel-btn').addEventListener('click', closeDeleteConfirmModal);
  $('#delete-confirm-btn').addEventListener('click', confirmDeleteDriver);

  $('#assign-vehicle-close-btn').addEventListener('click', closeAssignVehicleModal);
  $('#assign-vehicle-cancel-btn').addEventListener('click', closeAssignVehicleModal);
  $('#assign-vehicle-confirm-btn').addEventListener('click', confirmAssignVehicle);

  $('#driver-login-close-btn').addEventListener('click', closeDriverLoginModal);
  $('#driver-login-cancel-btn').addEventListener('click', closeDriverLoginModal);
  $('#driver-login-done-btn').addEventListener('click', closeDriverLoginModal);
  $('#generate-password-btn').addEventListener('click', () => {
    $('#driver-login-password').value = generateSecurePassword();
  });
  $('#driver-login-save-btn').addEventListener('click', handleCreateDriverLogin);
  $('#reset-password-btn').addEventListener('click', handleResetDriverPassword);
});