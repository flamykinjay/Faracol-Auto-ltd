/**
 * nav.js
 * ----------------------------------------------------------------
 * Shared sidebar navigation component used across every authenticated
 * admin page. Single source of truth for nav links.
 *
 * Depends on: auth.js (for getActiveSession() and logout()) and
 * storage.js being loaded before this file.
 * ----------------------------------------------------------------
 */

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', href: 'dashboard.html', icon: 'grid' },
  { key: 'drivers', label: 'Drivers', href: 'drivers.html', icon: 'users' },
  { key: 'vehicles', label: 'Vehicles', href: 'vehicles.html', icon: 'truck' },
  { key: 'payments', label: 'Payments', href: 'payments.html', icon: 'wallet' },
  { key: 'loans', label: 'Loans', href: 'loans.html', icon: 'loans' },
  { key: 'maintenance', label: 'Maintenance', href: 'maintenance.html', icon: 'wrench' },
  { key: 'reports', label: 'Reports', href: 'reports.html', icon: 'bar-chart' },
  { key: 'workshop', label: 'Workshop', href: 'workshop/dashboard.html', icon: 'workshop' },
  { key: 'settings', label: 'Settings', href: 'settings.html', icon: 'settings' },
];

const NAV_ICONS = {
  grid: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  users: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  truck: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
  wallet: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5h-4a2 2 0 0 1 0-4h4z"/></svg>',
  loans: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  wrench: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4l-6 6 2.9 2.9 6-6a4 4 0 0 0 5.4-5.4l-3.5 3.5-2.9-2.9 3.5-3.5z"/></svg>',
  'bar-chart': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>',
  workshop: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11"/><rect x="2" y="11" width="20" height="6" rx="1.5"/><circle cx="7" cy="17.5" r="1.75"/><circle cx="17" cy="17.5" r="1.75"/></svg>',
  settings: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  logout: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
};

function buildSidebarMarkup(activeKey, sessionUser) {
  const navLinksHtml = NAV_ITEMS.map((item) => {
    const isActive = item.key === activeKey;
    return `
      <a href="${item.href}" class="nav-link${isActive ? ' nav-link-active' : ''}">
        <span class="nav-icon">${NAV_ICONS[item.icon]}</span>
        <span class="nav-label">${item.label}</span>
      </a>
    `;
  }).join('');

  return `
    <div class="sidebar-brand">
      <svg class="sidebar-logo" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect width="48" height="48" rx="12" fill="var(--color-accent)"/>
        <path d="M14 30V22C14 20.8954 14.8954 20 16 20H26L32 26V30C32 31.1046 31.1046 32 30 32H16C14.8954 32 14 31.1046 14 30Z" stroke="var(--color-surface)" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="19" cy="32" r="2.5" fill="var(--color-surface)"/>
        <circle cx="27" cy="32" r="2.5" fill="var(--color-surface)"/>
        <path d="M26 20V26H32" stroke="var(--color-surface)" stroke-width="2" stroke-linejoin="round"/>
      </svg>
      <span class="sidebar-brand-name">Fleet Ledger</span>
    </div>

    <nav class="sidebar-nav">
      ${navLinksHtml}
    </nav>

    <div class="sidebar-footer">
      <div class="sidebar-user">
        <div class="sidebar-user-avatar">${sessionUser.name.charAt(0).toUpperCase()}</div>
        <div class="sidebar-user-info">
          <span class="sidebar-user-name">${sessionUser.name}</span>
          <span class="sidebar-user-role">${sessionUser.role}</span>
        </div>
      </div>
      <button type="button" class="sidebar-logout-btn" id="sidebar-logout-btn" aria-label="Log out">
        ${NAV_ICONS.logout}
      </button>
    </div>
  `;
}

function renderSidebar(activeKey) {
  const placeholder = $('#sidebar-placeholder');

  if (!placeholder) {
    console.error('nav.js: #sidebar-placeholder element not found on this page.');
    return;
  }

  const session = getActiveSession();
  const sessionUser = session || { name: 'Guest', role: 'unknown' };

  placeholder.innerHTML = buildSidebarMarkup(activeKey, sessionUser);

  const logoutButton = $('#sidebar-logout-btn');
  logoutButton.addEventListener('click', logout);
}