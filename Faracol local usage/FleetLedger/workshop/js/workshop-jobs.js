const WORKSHOP_JOBS_COLLECTION = 'workshopJobs';

let currentlyEditingJobId = null;
let pendingDeleteJobId = null;
let currentSearchTerm = '';
let currentRangeStart = null;
let currentRangeEnd = null;
let toastTimeout = null;

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

function calculatePaymentStatus(amountPaid, cost) {
  if (amountPaid >= cost && cost > 0) return 'paid';
  if (amountPaid > 0) return 'partial';
  return 'unpaid';
}

function showToast(message) {
  const toast = $('#ws-toast');
  clearTimeout(toastTimeout);

  toast.textContent = message;
  toast.hidden = false;
  toast.classList.add('ws-toast-visible');

  toastTimeout = setTimeout(() => {
    toast.classList.remove('ws-toast-visible');
    setTimeout(() => { toast.hidden = true; }, 300);
  }, 2500);
}

function formatJobStatus(status) {
  const labels = { 'in-progress': 'In Progress', 'ready-for-pickup': 'Ready for Pickup', 'picked-up': 'Picked Up' };
  return labels[status] || status;
}

function jobStatusBadgeClass(status) {
  if (status === 'picked-up') return 'ws-badge-picked';
  if (status === 'ready-for-pickup') return 'ws-badge-ready';
  return 'ws-badge-progress';
}

function jobStatusBadgeContent(status) {
  const label = formatJobStatus(status);

  if (status === 'in-progress') {
    return `
      <svg class="ws-spin-icon" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4l-6 6 2.9 2.9 6-6a4 4 0 0 0 5.4-5.4l-3.5 3.5-2.9-2.9 3.5-3.5z"/></svg>
      ${label}
    `;
  }

  return label;
}

function buildJobRow(job) {
  const balance = Math.max(job.cost - job.amountPaid, 0);

  return `
    <tr data-job-id="${job.id}">
      <td>${job.customerName}<div style="font-size:0.75rem; color: var(--ws-text-muted);">${job.customerPhone}</div></td>
      <td>${job.vehicleType}${job.plateNumber ? `<div style="font-size:0.75rem; color: var(--ws-text-muted);">${job.plateNumber}</div>` : ''}</td>
      <td>${job.repairDescription}</td>
      <td>${formatCurrency(job.cost)}</td>
      <td>${formatCurrency(job.amountPaid)}</td>
      <td>${formatCurrency(balance)}</td>
      <td><span class="ws-badge ${paymentBadgeClass(job.paymentStatus)}">${job.paymentStatus.charAt(0).toUpperCase() + job.paymentStatus.slice(1)}</span></td>
      <td><span class="ws-badge ${jobStatusBadgeClass(job.jobStatus)}">${jobStatusBadgeContent(job.jobStatus)}</span></td>
      <td>${new Date(job.dateIn).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
      <td class="ws-col-actions">
        <button type="button" class="ws-row-action-btn print-receipt-btn" data-job-id="${job.id}" aria-label="Print receipt">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        </button>
        <button type="button" class="ws-row-action-btn edit-job-btn" data-job-id="${job.id}" aria-label="Edit job">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button type="button" class="ws-row-action-btn ws-row-action-danger delete-job-btn" data-job-id="${job.id}" aria-label="Delete job">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </td>
    </tr>
  `;
}

function paymentBadgeClass(status) {
  if (status === 'paid') return 'ws-badge-paid';
  if (status === 'partial') return 'ws-badge-partial';
  return 'ws-badge-unpaid';
}

function filterJobs(jobs) {
  let filtered = jobs;

  if (currentSearchTerm.trim()) {
    const term = currentSearchTerm.trim().toLowerCase();
    filtered = filtered.filter((job) =>
      [job.customerName, job.customerPhone, job.plateNumber || ''].join(' ').toLowerCase().includes(term)
    );
  }

  if (currentRangeStart || currentRangeEnd) {
    filtered = filtered.filter((job) => {
      const jobDate = job.dateIn.split('T')[0];
      if (currentRangeStart && jobDate < currentRangeStart) return false;
      if (currentRangeEnd && jobDate > currentRangeEnd) return false;
      return true;
    });
  }

  return filtered;
}

function renderJobsTable() {
  const allJobs = getCollection(WORKSHOP_JOBS_COLLECTION).slice().sort((a, b) => new Date(b.dateIn) - new Date(a.dateIn));
  const jobs = filterJobs(allJobs);

  const table = $('#jobs-table');
  const emptyState = $('#jobs-empty-state');
  const tableBody = $('#jobs-table-body');
  const subtitle = $('#ws-job-count');

  subtitle.textContent = `${allJobs.length} job${allJobs.length === 1 ? '' : 's'}`;

  if (jobs.length === 0) {
    table.hidden = true;
    emptyState.hidden = false;
    emptyState.querySelector('p').textContent = currentSearchTerm || currentRangeStart || currentRangeEnd
      ? 'No jobs match your search or date range.'
      : 'No jobs yet. Click "New Job Intake" to bring in your first vehicle.';
    tableBody.innerHTML = '';
    return;
  }

  table.hidden = false;
  emptyState.hidden = true;
  tableBody.innerHTML = jobs.map(buildJobRow).join('');

  document.querySelectorAll('.edit-job-btn').forEach((button) => {
    button.addEventListener('click', () => openEditJobModal(button.dataset.jobId));
  });
  document.querySelectorAll('.delete-job-btn').forEach((button) => {
    button.addEventListener('click', () => openDeleteJobModal(button.dataset.jobId));
  });
  document.querySelectorAll('.print-receipt-btn').forEach((button) => {
    button.addEventListener('click', () => printReceipt(button.dataset.jobId));
  });
}

function findPastJobByPhone(phone) {
  const jobs = getCollection(WORKSHOP_JOBS_COLLECTION)
    .filter((job) => job.customerPhone === phone)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return jobs[0] || null;
}

function handlePhoneInput(event) {
  const phone = event.target.value.trim();
  const note = $('#ws-autofill-note');

  if (!phone || currentlyEditingJobId) {
    note.hidden = true;
    return;
  }

  const pastJob = findPastJobByPhone(phone);

  if (pastJob) {
    $('#job-customer-name').value = pastJob.customerName;
    $('#job-vehicle-type').value = pastJob.vehicleType;
    $('#job-plate-number').value = pastJob.plateNumber || '';
    note.hidden = false;
    note.textContent = `Returning customer detected — auto-filled from a previous visit (${new Date(pastJob.dateIn).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}).`;
  } else {
    note.hidden = true;
  }
}

function resetJobForm() {
  $('#job-form').reset();
  ['customer-phone', 'customer-name', 'vehicle-type', 'repair-description', 'cost'].forEach((field) => {
    clearFieldError($(`#job-${field}`), $(`#job-${field}-error`));
  });
  $('#job-date-in').value = new Date().toISOString().split('T')[0];
  $('#job-amount-paid').value = 0;
  $('#ws-autofill-note').hidden = true;
}

function openIntakeModal() {
  currentlyEditingJobId = null;
  $('#job-modal-title').textContent = 'New Job Intake';
  resetJobForm();
  $('#job-modal-overlay').hidden = false;
}

function openEditJobModal(jobId) {
  const job = findRecord(WORKSHOP_JOBS_COLLECTION, (record) => record.id === jobId);
  if (!job) return;

  currentlyEditingJobId = jobId;
  $('#job-modal-title').textContent = 'Edit Job';
  $('#ws-autofill-note').hidden = true;

  $('#job-customer-phone').value = job.customerPhone;
  $('#job-customer-name').value = job.customerName;
  $('#job-vehicle-type').value = job.vehicleType;
  $('#job-plate-number').value = job.plateNumber || '';
  $('#job-repair-description').value = job.repairDescription;
  $('#job-cost').value = job.cost;
  $('#job-amount-paid').value = job.amountPaid;
  $('#job-date-in').value = job.dateIn.split('T')[0];
  $('#job-status').value = job.jobStatus;

  $('#job-modal-overlay').hidden = false;
}

function closeJobModal() {
  $('#job-modal-overlay').hidden = true;
  currentlyEditingJobId = null;
}

function handleJobSubmit(event) {
  event.preventDefault();

  const fields = {
    'customer-phone': $('#job-customer-phone'),
    'customer-name': $('#job-customer-name'),
    'vehicle-type': $('#job-vehicle-type'),
    'repair-description': $('#job-repair-description'),
    cost: $('#job-cost'),
  };

  let hasError = false;
  Object.entries(fields).forEach(([key, input]) => {
    const errorEl = $(`#job-${key}-error`);
    clearFieldError(input, errorEl);
    if (!input.value.trim()) {
      showFieldError(input, errorEl, 'This field is required.');
      hasError = true;
    }
  });

  if (hasError) return;

  const cost = Number(fields.cost.value);
  const amountPaid = Number($('#job-amount-paid').value) || 0;
  const jobStatus = $('#job-status').value;
  const isEditing = Boolean(currentlyEditingJobId);

  const jobData = {
    customerPhone: fields['customer-phone'].value.trim(),
    customerName: fields['customer-name'].value.trim(),
    vehicleType: fields['vehicle-type'].value.trim(),
    plateNumber: $('#job-plate-number').value.trim(),
    repairDescription: fields['repair-description'].value.trim(),
    cost,
    amountPaid,
    paymentStatus: calculatePaymentStatus(amountPaid, cost),
    jobStatus,
    dateIn: $('#job-date-in').value,
  };

  if (isEditing) {
    const jobs = getCollection(WORKSHOP_JOBS_COLLECTION);
    const index = jobs.findIndex((record) => record.id === currentlyEditingJobId);
    if (index !== -1) {
      const wasNotPickedUp = jobs[index].jobStatus !== 'picked-up';
      jobs[index] = {
        ...jobs[index],
        ...jobData,
        dateOut: jobStatus === 'picked-up' && wasNotPickedUp ? new Date().toISOString() : jobs[index].dateOut,
        updatedAt: new Date().toISOString(),
      };
      saveCollection(WORKSHOP_JOBS_COLLECTION, jobs);
    }
  } else {
    addRecord(WORKSHOP_JOBS_COLLECTION, {
      id: generateId(),
      ...jobData,
      dateOut: jobStatus === 'picked-up' ? new Date().toISOString() : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  renderJobsTable();
  closeJobModal();
  showToast(isEditing ? 'Job updated successfully.' : 'Job saved successfully.');
}

function openDeleteJobModal(jobId) {
  pendingDeleteJobId = jobId;
  $('#delete-job-modal-overlay').hidden = false;
}

function closeDeleteJobModal() {
  pendingDeleteJobId = null;
  $('#delete-job-modal-overlay').hidden = true;
}

function confirmDeleteJob() {
  if (!pendingDeleteJobId) return;
  const jobs = getCollection(WORKSHOP_JOBS_COLLECTION).filter((record) => record.id !== pendingDeleteJobId);
  saveCollection(WORKSHOP_JOBS_COLLECTION, jobs);
  renderJobsTable();
  closeDeleteJobModal();
  showToast('Job deleted.');
}

function printReceipt(jobId) {
  const job = findRecord(WORKSHOP_JOBS_COLLECTION, (record) => record.id === jobId);
  if (!job) return;

  const balance = Math.max(job.cost - job.amountPaid, 0);

  $('#receipt-date').textContent = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  $('#receipt-customer').textContent = job.customerName;
  $('#receipt-phone').textContent = job.customerPhone;
  $('#receipt-vehicle').textContent = job.vehicleType;
  $('#receipt-plate').textContent = job.plateNumber || '—';
  $('#receipt-repair').textContent = job.repairDescription;
  $('#receipt-job-status').textContent = formatJobStatus(job.jobStatus);
  $('#receipt-cost').textContent = formatCurrency(job.cost);
  $('#receipt-paid').textContent = formatCurrency(job.amountPaid);
  $('#receipt-balance').textContent = formatCurrency(balance);

  window.print();
}

function applyDateRange() {
  currentRangeStart = $('#ws-range-start').value || null;
  currentRangeEnd = $('#ws-range-end').value || null;
  renderJobsTable();
}

function clearDateRange() {
  currentRangeStart = null;
  currentRangeEnd = null;
  $('#ws-range-start').value = '';
  $('#ws-range-end').value = '';
  renderJobsTable();
}

document.addEventListener('DOMContentLoaded', () => {
  const session = getActiveSession();
  if (!session) {
    window.location.href = '../index.html';
    return;
  }

  if (session.role !== 'admin') {
    window.location.href = '../driver/dashboard.html';
    return;
  }

  renderWorkshopSidebar('jobs');
  renderJobsTable();

  $('#job-search-input').addEventListener('input', (event) => {
    currentSearchTerm = event.target.value;
    renderJobsTable();
  });

  $('#job-customer-phone').addEventListener('blur', handlePhoneInput);

  $('#open-intake-btn').addEventListener('click', openIntakeModal);
  $('#job-modal-close-btn').addEventListener('click', closeJobModal);
  $('#job-cancel-btn').addEventListener('click', closeJobModal);
  $('#job-form').addEventListener('submit', handleJobSubmit);

  $('#delete-job-cancel-btn').addEventListener('click', closeDeleteJobModal);
  $('#delete-job-confirm-btn').addEventListener('click', confirmDeleteJob);

  $('#ws-apply-range-btn').addEventListener('click', applyDateRange);
  $('#ws-clear-range-btn').addEventListener('click', clearDateRange);
});