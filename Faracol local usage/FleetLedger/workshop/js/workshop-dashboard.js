const WORKSHOP_JOBS_COLLECTION = 'workshopJobs';

let wsRevenueChart = null;

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

function getStartOfCurrentWeek() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - dayOfWeek);
  start.setHours(0, 0, 0, 0);
  return start;
}

function animateCountUp(element, finalValue, isCurrency) {
  const duration = 700;
  const startTime = performance.now();

  function frame(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const currentValue = Math.round(finalValue * eased);

    element.textContent = isCurrency ? formatCurrency(currentValue) : String(currentValue);

    if (progress < 1) {
      requestAnimationFrame(frame);
    }
  }

  requestAnimationFrame(frame);
}

function populateWorkshopStats() {
  const jobs = getCollection(WORKSHOP_JOBS_COLLECTION);

  const activeJobs = jobs.filter((job) => job.jobStatus !== 'picked-up');
  const startOfWeek = getStartOfCurrentWeek();

  const weekRevenue = jobs
    .filter((job) => new Date(job.dateIn) >= startOfWeek)
    .reduce((sum, job) => sum + job.amountPaid, 0);

  const allTimeRevenue = jobs.reduce((sum, job) => sum + job.amountPaid, 0);
  const outstanding = jobs.reduce((sum, job) => sum + Math.max(job.cost - job.amountPaid, 0), 0);

  animateCountUp($('#stat-active-jobs'), activeJobs.length, false);
  animateCountUp($('#stat-week-revenue'), weekRevenue, true);
  animateCountUp($('#stat-alltime-revenue'), allTimeRevenue, true);
  animateCountUp($('#stat-outstanding'), outstanding, true);
}

function renderWorkshopChart() {
  const jobs = getCollection(WORKSHOP_JOBS_COLLECTION);
  const labels = [];
  const data = [];

  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    const dayString = day.toISOString().split('T')[0];

    const dayRevenue = jobs
      .filter((job) => job.dateIn.split('T')[0] === dayString)
      .reduce((sum, job) => sum + job.amountPaid, 0);

    labels.push(day.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }));
    data.push(dayRevenue);
  }

  const ctx = $('#ws-revenue-chart').getContext('2d');

  if (wsRevenueChart) {
    wsRevenueChart.destroy();
  }

  wsRevenueChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Revenue', data, backgroundColor: '#ef4444', borderRadius: 6 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#d4a5a5' }, grid: { color: '#5c1f1f' } },
        y: { ticks: { color: '#d4a5a5' }, grid: { color: '#5c1f1f' } },
      },
    },
  });
}

function renderWorkshopActivity() {
  const jobs = getCollection(WORKSHOP_JOBS_COLLECTION)
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  const list = $('#ws-activity-list');
  const emptyState = $('#ws-activity-empty');

  if (jobs.length === 0) {
    list.hidden = true;
    emptyState.hidden = false;
    return;
  }

  list.hidden = false;
  emptyState.hidden = true;

  list.innerHTML = jobs
    .map((job) => `
      <div class="ws-activity-item">
        <span class="ws-activity-icon">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4l-6 6 2.9 2.9 6-6a4 4 0 0 0 5.4-5.4l-3.5 3.5-2.9-2.9 3.5-3.5z"/></svg>
        </span>
        <span class="ws-activity-text">${job.customerName} — ${job.vehicleType} (${formatCurrency(job.amountPaid)} paid)</span>
        <span class="ws-activity-date">${new Date(job.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
      </div>
    `)
    .join('');
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

  renderWorkshopSidebar('dashboard');
  playWorkshopWelcome();
  renderWorkshopShowcase();

  $('#ws-date').textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  populateWorkshopStats();
  renderWorkshopChart();
  renderWorkshopActivity();
});