/**
 * settings.js
 * ----------------------------------------------------------------
 * Page-specific logic for settings.html.
 *
 * DATA BACKUP: exports every known collection to a single JSON
 * file, and can restore from one. ALL_COLLECTION_NAMES below is
 * the single source of truth for what gets backed up — any future
 * collection added to the app should be registered here too, or
 * it will silently be left out of exports.
 *
 * IMPORT SAFETY: if any existing data is detected before an import,
 * the user sees an explicit warning with record counts and must
 * confirm before their data is overwritten. Fresh/empty systems
 * import directly with no warning needed.
 *
 * CHANGE PASSWORD: validates the current password against the
 * stored hash, then re-hashes and saves the new one — reuses
 * hashText() from utils.js, same hashing approach as login.
 *
 * Depends on: utils.js, storage.js, auth.js, nav.js.
 * ----------------------------------------------------------------
 */

const ALL_COLLECTION_NAMES = [
  'users',
  'drivers',
  'vehicles',
  'weeks',
  'payments',
  'expenses',
  'miscIncome',
  'maintenanceRecords',
  'newsPosts',
  'driverLogs',
  'loans',
];

let pendingImportData = null;

/**
 * ----------------------------------------------------------------
 * EXPORT
 * ----------------------------------------------------------------
 */

function exportBackup() {
  const backup = {
    exportedAt: new Date().toISOString(),
    appVersion: 'FLMS v1',
    data: {},
  };

  ALL_COLLECTION_NAMES.forEach((name) => {
    backup.data[name] = getCollection(name);
  });

  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const dateStamp = new Date().toISOString().split('T')[0];
  const link = document.createElement('a');
  link.href = url;
  link.download = `fleetledger-backup-${dateStamp}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showStatusMessage('settings-status-message', 'Backup downloaded successfully.', 'success');
}

/**
 * ----------------------------------------------------------------
 * IMPORT
 * ----------------------------------------------------------------
 */

/**
 * Counts total records currently stored across every known
 * collection, used to decide whether the overwrite warning
 * needs to be shown.
 * @returns {number}
 */
function countExistingRecords() {
  return ALL_COLLECTION_NAMES.reduce((sum, name) => sum + getCollection(name).length, 0);
}

function handleImportFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);

      if (!parsed.data || typeof parsed.data !== 'object') {
        showStatusMessage('settings-status-message', 'This file doesn\'t look like a valid Fleet Ledger backup.', 'error');
        return;
      }

      pendingImportData = parsed.data;

      const existingCount = countExistingRecords();
      if (existingCount > 0) {
        const driverCount = getCollection('drivers').length;
        const vehicleCount = getCollection('vehicles').length;
        const paymentCount = getCollection('payments').length;

        $('#import-warning-text').textContent =
          `You currently have ${driverCount} driver(s), ${vehicleCount} vehicle(s), and ${paymentCount} payment record(s) stored. Importing this backup will completely replace all existing data.`;
        $('#import-warning-modal-overlay').hidden = false;
      } else {
        performImport();
      }
    } catch (error) {
      showStatusMessage('settings-status-message', 'Could not read this file — it may be corrupted or not a valid backup.', 'error');
    }
  };
  reader.readAsText(file);
}

/**
 * Applies the pending import data, overwriting every known
 * collection with whatever was found in the backup file (missing
 * collections in an older backup are simply skipped, not cleared).
 */
function performImport() {
  if (!pendingImportData) return;

  ALL_COLLECTION_NAMES.forEach((name) => {
    if (Array.isArray(pendingImportData[name])) {
      saveCollection(name, pendingImportData[name]);
    }
  });

  pendingImportData = null;
  $('#import-warning-modal-overlay').hidden = true;

  showStatusMessage('settings-status-message', 'Data restored successfully. Reloading...', 'success');

  setTimeout(() => {
    window.location.reload();
  }, 1200);
}

function cancelImport() {
  pendingImportData = null;
  $('#import-warning-modal-overlay').hidden = true;
  $('#import-file-input').value = '';
}

/**
 * ----------------------------------------------------------------
 * CHANGE PASSWORD
 * ----------------------------------------------------------------
 */

async function handleChangePasswordSubmit(event) {
  event.preventDefault();

  const currentInput = $('#current-password');
  const newInput = $('#new-password');
  const confirmInput = $('#confirm-new-password');

  clearFieldError(currentInput, $('#current-password-error'));
  clearFieldError(newInput, $('#new-password-error'));
  clearFieldError(confirmInput, $('#confirm-new-password-error'));

  const session = getActiveSession();
  if (!session) return;

  const users = getCollection('users');
  const userIndex = users.findIndex((record) => record.id === session.userId);

  if (userIndex === -1) {
    showStatusMessage('password-status-message', 'Could not find your account record.', 'error');
    return;
  }

  const currentHash = await hashText(currentInput.value);
  if (currentHash !== users[userIndex].passwordHash) {
    showFieldError(currentInput, $('#current-password-error'), 'Current password is incorrect.');
    return;
  }

  if (newInput.value.length < 6) {
    showFieldError(newInput, $('#new-password-error'), 'New password must be at least 6 characters.');
    return;
  }

  if (newInput.value !== confirmInput.value) {
    showFieldError(confirmInput, $('#confirm-new-password-error'), 'Passwords do not match.');
    return;
  }

  const newHash = await hashText(newInput.value);
  users[userIndex] = { ...users[userIndex], passwordHash: newHash };
  saveCollection('users', users);

  $('#change-password-form').reset();
  showStatusMessage('password-status-message', 'Password updated successfully.', 'success');
}

/**
 * ----------------------------------------------------------------
 * SHARED HELPERS
 * ----------------------------------------------------------------
 */

function showStatusMessage(elementId, message, type) {
  const el = $(`#${elementId}`);
  el.textContent = message;
  el.className = `settings-status settings-status-${type}`;
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

  renderSidebar('settings');

  $('#export-backup-btn').addEventListener('click', exportBackup);

  $('#import-backup-btn').addEventListener('click', () => {
    $('#import-file-input').click();
  });
  $('#import-file-input').addEventListener('change', handleImportFileSelect);

  $('#import-warning-cancel-btn').addEventListener('click', cancelImport);
  $('#import-warning-confirm-btn').addEventListener('click', performImport);

  $('#change-password-form').addEventListener('submit', handleChangePasswordSubmit);
});