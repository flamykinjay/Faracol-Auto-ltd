/**
 * vehicles.js
 * ----------------------------------------------------------------
 * Page-specific logic for vehicles.html.
 *
 * FIX: the Assign Driver dropdown now labels EVERY driver who
 * doesn't currently have a vehicle at all as "(no vehicle assigned)",
 * not just drivers who have a DIFFERENT vehicle — previously,
 * unassigned drivers showed no label at all, making it unclear
 * they were free to assign.
 *
 * SEARCH: a live client-side filter across vehicle type, plate
 * number, chassis number, and the assigned driver's name (if any).
 *
 * VEHICLE ASSIGNMENT RULE: a vehicle can only be linked to one
 * driver at a time.
 *
 * NO LIMITS: no maximum is enforced anywhere on how many vehicles
 * can be created.
 *
 * Depends on: utils.js, storage.js, auth.js, nav.js.
 * ----------------------------------------------------------------
 */

const VEHICLES_COLLECTION = 'vehicles';
const DRIVERS_COLLECTION = 'drivers';

let currentlyEditingVehicleId = null;
let pendingDeleteVehicleId = null;
let pendingAssignVehicleId = null;
let bulkVehicleRowCounter = 0;
let currentSearchTerm = '';

const CAR_ICON_SVG = `
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11"/>
    <rect x="2" y="11" width="20" height="6" rx="1.5"/>
    <circle cx="7" cy="17.5" r="1.75"/>
    <circle cx="17" cy="17.5" r="1.75"/>
  </svg>
`;

function findAssignedDriver(vehicleId) {
  return findRecord(DRIVERS_COLLECTION, (record) => record.vehicleId === vehicleId);
}

function buildVehicleCard(vehicle) {
  const assignedDriver = findAssignedDriver(vehicle.id);

  const driverBadge = assignedDriver
    ? `<span class="vehicle-driver-badge">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        ${assignedDriver.name}
      </span>`
    : `<span class="vehicle-driver-badge vehicle-driver-badge-unassigned">Unassigned</span>`;

  return `
    <div class="vehicle-card" data-vehicle-id="${vehicle.id}">
      <div class="vehicle-card-top">
        <div class="vehicle-icon-badge">${CAR_ICON_SVG}</div>
        <div class="vehicle-card-actions">
          <button type="button" class="row-action-btn assign-driver-btn" data-vehicle-id="${vehicle.id}" aria-label="Assign driver">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
          </button>
          <button type="button" class="row-action-btn edit-vehicle-btn" data-vehicle-id="${vehicle.id}" aria-label="Edit vehicle">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button type="button" class="row-action-btn row-action-danger delete-vehicle-btn" data-vehicle-id="${vehicle.id}" aria-label="Delete vehicle">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </div>

      <div class="vehicle-card-body">
        <span class="vehicle-type">${vehicle.type}</span>
        <span class="vehicle-plate">${vehicle.plateNumber}</span>
        <span class="vehicle-chassis">Chassis: ${vehicle.chassisNumber}</span>
      </div>

      <div class="vehicle-card-footer">
        ${driverBadge}
      </div>
    </div>
  `;
}

/**
 * Filters vehicles by type, plate number, chassis number, or the
 * name of whichever driver (if any) is currently assigned.
 * @param {Array<Object>} vehicles
 * @returns {Array<Object>}
 */
function filterVehicles(vehicles) {
  if (!currentSearchTerm.trim()) {
    return vehicles;
  }

  const term = currentSearchTerm.trim().toLowerCase();

  return vehicles.filter((vehicle) => {
    const assignedDriver = findAssignedDriver(vehicle.id);

    const haystack = [
      vehicle.type,
      vehicle.plateNumber,
      vehicle.chassisNumber,
      assignedDriver ? assignedDriver.name : '',
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(term);
  });
}

function renderVehicleGrid() {
  const allVehicles = getCollection(VEHICLES_COLLECTION);
  const vehicles = filterVehicles(allVehicles);
  const grid = $('#vehicle-grid');
  const emptyState = $('#vehicles-empty-state');
  const subtitle = $('#vehicle-count-subtitle');

  subtitle.textContent = `${allVehicles.length} vehicle${allVehicles.length === 1 ? '' : 's'}`;

  if (vehicles.length === 0) {
    grid.hidden = true;
    emptyState.hidden = false;
    emptyState.querySelector('p').textContent = currentSearchTerm
      ? 'No vehicles match your search.'
      : 'No vehicles added yet. Click "Add Vehicle" to get started.';
    grid.innerHTML = '';
    return;
  }

  grid.hidden = false;
  emptyState.hidden = true;
  grid.innerHTML = vehicles.map(buildVehicleCard).join('');

  document.querySelectorAll('.edit-vehicle-btn').forEach((button) => {
    button.addEventListener('click', () => openEditVehicleModal(button.dataset.vehicleId));
  });

  document.querySelectorAll('.delete-vehicle-btn').forEach((button) => {
    button.addEventListener('click', () => openDeleteVehicleConfirmModal(button.dataset.vehicleId));
  });

  document.querySelectorAll('.assign-driver-btn').forEach((button) => {
    button.addEventListener('click', () => openAssignDriverModal(button.dataset.vehicleId));
  });
}

function resetSingleVehicleForm() {
  const form = $('#single-vehicle-form');
  form.reset();

  ['veh-type', 'veh-plate', 'veh-chassis'].forEach((field) => {
    const input = $(`#single-${field}`);
    const error = $(`#single-${field}-error`);
    clearFieldError(input, error);
  });
}

function openEditVehicleModal(vehicleId) {
  const vehicle = findRecord(VEHICLES_COLLECTION, (record) => record.id === vehicleId);
  if (!vehicle) {
    return;
  }

  currentlyEditingVehicleId = vehicleId;

  $('#vehicle-modal-title').textContent = 'Edit Vehicle';
  $('#vehicle-modal-tabs').hidden = true;
  $('#bulk-vehicle-form').hidden = true;
  $('#single-vehicle-form').hidden = false;

  $('#single-veh-type').value = vehicle.type;
  $('#single-veh-plate').value = vehicle.plateNumber;
  $('#single-veh-chassis').value = vehicle.chassisNumber;

  $('#vehicle-modal-overlay').hidden = false;
}

function openAddVehicleModal() {
  currentlyEditingVehicleId = null;

  $('#vehicle-modal-title').textContent = 'Add Vehicle';
  $('#vehicle-modal-tabs').hidden = false;
  switchVehicleModalTab('single');
  resetSingleVehicleForm();
  resetBulkVehicleForm();

  $('#vehicle-modal-overlay').hidden = false;
}

function closeVehicleModal() {
  $('#vehicle-modal-overlay').hidden = true;
  currentlyEditingVehicleId = null;
}

function switchVehicleModalTab(mode) {
  const singleTab = $('#vehicle-tab-single');
  const bulkTab = $('#vehicle-tab-bulk');
  const singleForm = $('#single-vehicle-form');
  const bulkForm = $('#bulk-vehicle-form');

  const isSingle = mode === 'single';

  singleTab.classList.toggle('modal-tab-active', isSingle);
  bulkTab.classList.toggle('modal-tab-active', !isSingle);
  singleForm.hidden = !isSingle;
  bulkForm.hidden = isSingle;
}

function handleSingleVehicleSubmit(event) {
  event.preventDefault();

  const fields = {
    'veh-type': $('#single-veh-type'),
    'veh-plate': $('#single-veh-plate'),
    'veh-chassis': $('#single-veh-chassis'),
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

  const submitButton = $('#single-veh-submit-btn');
  const submitLabel = $('.btn-label', submitButton);
  const submitSpinner = $('.btn-spinner', submitButton);
  submitButton.disabled = true;
  submitLabel.hidden = true;
  submitSpinner.hidden = false;

  if (currentlyEditingVehicleId) {
    updateVehicle(currentlyEditingVehicleId, fields);
  } else {
    createVehicle(fields);
  }

  renderVehicleGrid();
  closeVehicleModal();

  submitButton.disabled = false;
  submitLabel.hidden = false;
  submitSpinner.hidden = true;
}

function createVehicle(fields) {
  const newVehicle = {
    id: generateId(),
    type: fields['veh-type'].value.trim(),
    plateNumber: fields['veh-plate'].value.trim(),
    chassisNumber: fields['veh-chassis'].value.trim(),
    createdAt: new Date().toISOString(),
  };
  addRecord(VEHICLES_COLLECTION, newVehicle);
}

function updateVehicle(vehicleId, fields) {
  const vehicles = getCollection(VEHICLES_COLLECTION);
  const index = vehicles.findIndex((record) => record.id === vehicleId);
  if (index === -1) {
    return;
  }

  vehicles[index] = {
    ...vehicles[index],
    type: fields['veh-type'].value.trim(),
    plateNumber: fields['veh-plate'].value.trim(),
    chassisNumber: fields['veh-chassis'].value.trim(),
  };
  saveCollection(VEHICLES_COLLECTION, vehicles);
}

function buildBulkVehicleRow(rowNumber) {
  return `
    <div class="bulk-row" data-row-number="${rowNumber}">
      <div class="bulk-row-header">
        <span class="bulk-row-label">Vehicle ${rowNumber}</span>
        <button type="button" class="bulk-row-remove-btn" data-row-number="${rowNumber}" aria-label="Remove row">
          <svg viewBox="0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label" for="bulk-veh-type-${rowNumber}">Vehicle Type</label>
          <input type="text" id="bulk-veh-type-${rowNumber}" class="form-input bulk-veh-field" placeholder="e.g. Toyota Camry" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="bulk-veh-plate-${rowNumber}">Plate Number</label>
          <input type="text" id="bulk-veh-plate-${rowNumber}" class="form-input bulk-veh-field" placeholder="Plate number" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="bulk-veh-chassis-${rowNumber}">Chassis Number</label>
          <input type="text" id="bulk-veh-chassis-${rowNumber}" class="form-input bulk-veh-field" placeholder="Chassis number" required>
        </div>
      </div>
    </div>
  `;
}

function resetBulkVehicleForm() {
  bulkVehicleRowCounter = 1;
  $('#bulk-vehicle-rows-wrapper').innerHTML = buildBulkVehicleRow(bulkVehicleRowCounter);
  wireBulkVehicleRowRemoveButtons();
}

function addBulkVehicleRow() {
  bulkVehicleRowCounter += 1;
  $('#bulk-vehicle-rows-wrapper').insertAdjacentHTML('beforeend', buildBulkVehicleRow(bulkVehicleRowCounter));
  wireBulkVehicleRowRemoveButtons();
}

function wireBulkVehicleRowRemoveButtons() {
  document.querySelectorAll('#bulk-vehicle-rows-wrapper .bulk-row-remove-btn').forEach((button) => {
    button.onclick = () => {
      const rows = document.querySelectorAll('#bulk-vehicle-rows-wrapper .bulk-row');
      if (rows.length <= 1) {
        return;
      }
      button.closest('.bulk-row').remove();
    };
  });
}

function handleBulkVehicleSubmit(event) {
  event.preventDefault();

  const rows = document.querySelectorAll('#bulk-vehicle-rows-wrapper .bulk-row');
  let hasError = false;

  rows.forEach((row) => {
    row.querySelectorAll('.bulk-veh-field').forEach((input) => {
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

  const submitButton = $('#bulk-veh-submit-btn');
  const submitLabel = $('.btn-label', submitButton);
  const submitSpinner = $('.btn-spinner', submitButton);
  submitButton.disabled = true;
  submitLabel.hidden = true;
  submitSpinner.hidden = false;

  rows.forEach((row) => {
    const rowNumber = row.dataset.rowNumber;

    const newVehicle = {
      id: generateId(),
      type: $(`#bulk-veh-type-${rowNumber}`).value.trim(),
      plateNumber: $(`#bulk-veh-plate-${rowNumber}`).value.trim(),
      chassisNumber: $(`#bulk-veh-chassis-${rowNumber}`).value.trim(),
      createdAt: new Date().toISOString(),
    };
    addRecord(VEHICLES_COLLECTION, newVehicle);
  });

  renderVehicleGrid();
  closeVehicleModal();

  submitButton.disabled = false;
  submitLabel.hidden = false;
  submitSpinner.hidden = true;
}

/**
 * Opens the Assign Driver modal for a vehicle. Every driver in the
 * dropdown gets a clear status suffix: drivers with a DIFFERENT
 * vehicle are labeled as such, and drivers with NO vehicle at all
 * are now also explicitly labeled "(no vehicle assigned)" — fixing
 * the earlier gap where unassigned drivers showed no indication at all.
 * @param {string} vehicleId
 */
function openAssignDriverModal(vehicleId) {
  const vehicle = findRecord(VEHICLES_COLLECTION, (record) => record.id === vehicleId);
  if (!vehicle) {
    return;
  }

  pendingAssignVehicleId = vehicleId;

  $('#assign-driver-vehicle-label').textContent = `Assigning driver for: ${vehicle.type} — ${vehicle.plateNumber}`;

  const drivers = getCollection(DRIVERS_COLLECTION);
  const currentDriver = findAssignedDriver(vehicleId);
  const select = $('#assign-driver-select');

  const options = ['<option value="">— No driver —</option>'];

  drivers.forEach((driver) => {
    let suffix = '';

    if (driver.vehicleId && driver.vehicleId !== vehicleId) {
      suffix = ' (currently has a different vehicle)';
    } else if (!driver.vehicleId) {
      suffix = ' (no vehicle assigned)';
    }

    const isSelected = currentDriver && currentDriver.id === driver.id ? 'selected' : '';
    options.push(`<option value="${driver.id}" ${isSelected}>${driver.name}${suffix}</option>`);
  });

  select.innerHTML = options.join('');

  $('#assign-driver-modal-overlay').hidden = false;
}

function closeAssignDriverModal() {
  pendingAssignVehicleId = null;
  $('#assign-driver-modal-overlay').hidden = true;
}

function confirmAssignDriver() {
  if (!pendingAssignVehicleId) {
    return;
  }

  const selectedDriverId = $('#assign-driver-select').value || null;
  const drivers = getCollection(DRIVERS_COLLECTION);

  const updatedDrivers = drivers.map((driver) => {
    if (selectedDriverId && driver.id === selectedDriverId) {
      return { ...driver, vehicleId: pendingAssignVehicleId };
    }
    if (driver.vehicleId === pendingAssignVehicleId && driver.id !== selectedDriverId) {
      return { ...driver, vehicleId: null };
    }
    return driver;
  });

  saveCollection(DRIVERS_COLLECTION, updatedDrivers);

  renderVehicleGrid();
  closeAssignDriverModal();
}

function openDeleteVehicleConfirmModal(vehicleId) {
  pendingDeleteVehicleId = vehicleId;
  $('#delete-vehicle-modal-overlay').hidden = false;
}

function closeDeleteVehicleConfirmModal() {
  pendingDeleteVehicleId = null;
  $('#delete-vehicle-modal-overlay').hidden = true;
}

function confirmDeleteVehicle() {
  if (!pendingDeleteVehicleId) {
    return;
  }

  const drivers = getCollection(DRIVERS_COLLECTION);
  const updatedDrivers = drivers.map((driver) => {
    if (driver.vehicleId === pendingDeleteVehicleId) {
      return { ...driver, vehicleId: null };
    }
    return driver;
  });
  saveCollection(DRIVERS_COLLECTION, updatedDrivers);

  const vehicles = getCollection(VEHICLES_COLLECTION);
  const updatedVehicles = vehicles.filter((record) => record.id !== pendingDeleteVehicleId);
  saveCollection(VEHICLES_COLLECTION, updatedVehicles);

  renderVehicleGrid();
  closeDeleteVehicleConfirmModal();
}

document.addEventListener('DOMContentLoaded', () => {
  const session = getActiveSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }

  renderSidebar('vehicles');
  renderVehicleGrid();

  $('#vehicle-search-input').addEventListener('input', (event) => {
    currentSearchTerm = event.target.value;
    renderVehicleGrid();
  });

  $('#open-add-vehicle-btn').addEventListener('click', openAddVehicleModal);
  $('#vehicle-modal-close-btn').addEventListener('click', closeVehicleModal);
  $('#single-veh-cancel-btn').addEventListener('click', closeVehicleModal);
  $('#bulk-veh-cancel-btn').addEventListener('click', closeVehicleModal);

  $('#vehicle-tab-single').addEventListener('click', () => switchVehicleModalTab('single'));
  $('#vehicle-tab-bulk').addEventListener('click', () => switchVehicleModalTab('bulk'));

  $('#single-vehicle-form').addEventListener('submit', handleSingleVehicleSubmit);
  $('#bulk-vehicle-form').addEventListener('submit', handleBulkVehicleSubmit);

  $('#add-bulk-vehicle-row-btn').addEventListener('click', addBulkVehicleRow);

  $('#delete-veh-cancel-btn').addEventListener('click', closeDeleteVehicleConfirmModal);
  $('#delete-veh-confirm-btn').addEventListener('click', confirmDeleteVehicle);

  $('#assign-driver-close-btn').addEventListener('click', closeAssignDriverModal);
  $('#assign-driver-cancel-btn').addEventListener('click', closeAssignDriverModal);
  $('#assign-driver-confirm-btn').addEventListener('click', confirmAssignDriver);
});