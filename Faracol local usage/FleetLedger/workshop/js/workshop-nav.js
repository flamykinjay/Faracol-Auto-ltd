const WS_NAV_ITEMS = [
  { key: 'dashboard', label: 'Workshop Dashboard', href: 'dashboard.html', icon: 'grid' },
  { key: 'jobs', label: 'Jobs', href: 'jobs.html', icon: 'wrench' },
];

const WS_ICONS = {
  grid: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  wrench: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4l-6 6 2.9 2.9 6-6a4 4 0 0 0 5.4-5.4l-3.5 3.5-2.9-2.9 3.5-3.5z"/></svg>',
  logout: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
};

function renderWorkshopSidebar(activeKey) {
  const placeholder = $('#sidebar-placeholder');
  if (!placeholder) {
    console.error('workshop-nav.js: #sidebar-placeholder not found.');
    return;
  }

  const session = getActiveSession();
  const sessionUser = session || { name: 'Admin' };

  const navLinksHtml = WS_NAV_ITEMS.map((item) => {
    const isActive = item.key === activeKey;
    return `
      <a href="${item.href}" class="ws-nav-link${isActive ? ' ws-nav-link-active' : ''}">
        <span>${WS_ICONS[item.icon]}</span>
        <span>${item.label}</span>
      </a>
    `;
  }).join('');

  placeholder.innerHTML = `
    <a href="../dashboard.html" class="ws-back-link" id="ws-back-to-main">
      ${WS_ICONS.back}
      Back to Main Dashboard
    </a>

    <div class="ws-brand">
      <div class="ws-brand-icon">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2">
          <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11"/>
          <rect x="2" y="11" width="20" height="6" rx="1.5"/>
          <circle cx="7" cy="17.5" r="1.75"/>
          <circle cx="17" cy="17.5" r="1.75"/>
        </svg>
      </div>
      <div>
        <div class="ws-brand-name">Workshop</div>
        <div class="ws-brand-tagline">Repair Bay</div>
      </div>
    </div>

    <nav class="ws-nav">
      ${navLinksHtml}
    </nav>

    <div class="ws-sidebar-footer">
      <span class="ws-user-name">${sessionUser.name}</span>
      <button type="button" class="ws-logout-btn" id="ws-logout-btn" aria-label="Log out">
        ${WS_ICONS.logout}
      </button>
    </div>
  `;

  $('#ws-back-to-main').addEventListener('click', () => {
    window.sessionStorage.removeItem('flms_workshop_session_active');
  });

  $('#ws-logout-btn').addEventListener('click', logout);
}