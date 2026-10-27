const WS_THEME_STORAGE_KEY = 'flms_theme_preference';
const WS_THEME_OPTIONS = [
  { key: 'dark', label: 'Dark', icon: '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>' },
  { key: 'light', label: 'Light', icon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>' },
  { key: 'grey', label: 'Grey', icon: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M3 12h18"/>' },
];

function wsGetStoredTheme() {
  return window.localStorage.getItem(WS_THEME_STORAGE_KEY) || 'dark';
}

function wsApplyTheme(themeName) {
  document.documentElement.setAttribute('data-theme', themeName);
  window.localStorage.setItem(WS_THEME_STORAGE_KEY, themeName);
}

function wsInitThemeToggle() {
  const currentTheme = wsGetStoredTheme();

  const wrapper = document.createElement('div');
  wrapper.className = 'ws-theme-toggle-wrap';
  wrapper.innerHTML = `
    <button type="button" class="ws-theme-toggle-btn" id="ws-theme-toggle-btn" aria-label="Change theme">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5z"/></svg>
    </button>
    <div class="ws-theme-menu" id="ws-theme-menu" hidden>
      ${WS_THEME_OPTIONS.map((opt) => `
        <button type="button" class="ws-theme-option${opt.key === currentTheme ? ' ws-theme-option-active' : ''}" data-theme-key="${opt.key}">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">${opt.icon}</svg>
          ${opt.label}
        </button>
      `).join('')}
    </div>
  `;

  document.body.appendChild(wrapper);

  const menu = wrapper.querySelector('#ws-theme-menu');
  const toggleBtn = wrapper.querySelector('#ws-theme-toggle-btn');

  toggleBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    menu.hidden = !menu.hidden;
  });

  document.addEventListener('click', () => {
    menu.hidden = true;
  });

  wrapper.querySelectorAll('.ws-theme-option').forEach((button) => {
    button.addEventListener('click', () => {
      const themeKey = button.dataset.themeKey;
      wsApplyTheme(themeKey);
      wrapper.querySelectorAll('.ws-theme-option').forEach((b) => b.classList.remove('ws-theme-option-active'));
      button.classList.add('ws-theme-option-active');
      menu.hidden = true;
    });
  });
}

wsApplyTheme(wsGetStoredTheme());

document.addEventListener('DOMContentLoaded', wsInitThemeToggle);