/**
 * driver-nav.js
 * ----------------------------------------------------------------
 * Sidebar for the DRIVER side of the app only. Deliberately
 * separate from the admin's js/nav.js — different nav items
 * (no Drivers/Vehicles/Payments/Settings access), and lives in
 * driver/js/ per the folder-separation decision. Reuses the same
 * getActiveSession() / logout() from the shared ../js/auth.js.
 * ----------------------------------------------------------------
 */

const DRIVER_NAV_ICONS = {
  history: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
  logout: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
};

function renderDriverSidebar(sessionUser) {
  const placeholder = $('#sidebar-placeholder');
  if (!placeholder) {
    console.error('driver-nav.js: #sidebar-placeholder not found.');
    return;
  }

  placeholder.innerHTML = `
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
      <a href="dashboard.html" class="nav-link nav-link-active">
        <span class="nav-icon">${DRIVER_NAV_ICONS.history}</span>
        <span class="nav-label">My Dashboard</span>
      </a>
    </nav>

    <div class="sidebar-footer">
      <div class="sidebar-user">
        <div class="sidebar-user-avatar">${sessionUser.name.charAt(0).toUpperCase()}</div>
        <div class="sidebar-user-info">
          <span class="sidebar-user-name">${sessionUser.name}</span>
          <span class="sidebar-user-role">Driver</span>
        </div>
      </div>
      <button type="button" class="sidebar-logout-btn" id="sidebar-logout-btn" aria-label="Log out">
        ${DRIVER_NAV_ICONS.logout}
      </button>
    </div>
  `;

  $('#sidebar-logout-btn').addEventListener('click', logout);
}