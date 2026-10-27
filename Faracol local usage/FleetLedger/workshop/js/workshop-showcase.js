const WORKSHOP_SHOWCASE_IMAGE = 'assets/images/cars.jpg';
const WORKSHOP_SHOWCASE_COUNT_KEY = 'flms_workshop_showcase_count';

const WORKSHOP_SHOWCASE_MESSAGES = [
  'Precision repairs, every time.',
  'Our brand, Our pride.',
  'From dented to driven — every day.',
  'Quality you can trust.',
  'Every job, done right.',
];

function renderWorkshopShowcase() {
  const count = Number(window.localStorage.getItem(WORKSHOP_SHOWCASE_COUNT_KEY) || '0');
  const message = WORKSHOP_SHOWCASE_MESSAGES[count % WORKSHOP_SHOWCASE_MESSAGES.length];
  window.localStorage.setItem(WORKSHOP_SHOWCASE_COUNT_KEY, String(count + 1));

  const wrap = $('#ws-showcase-wrap');

  const imageHtml = WORKSHOP_SHOWCASE_IMAGE
    ? `<img src="${WORKSHOP_SHOWCASE_IMAGE}" alt="${message}" class="ws-showcase-img" decoding="async">`
    : `
      <div class="ws-showcase-placeholder">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11"/>
          <rect x="2" y="11" width="20" height="6" rx="1.5"/>
          <circle cx="7" cy="17.5" r="1.75"/>
          <circle cx="17" cy="17.5" r="1.75"/>
        </svg>
      </div>
    `;

  wrap.innerHTML = `
    ${imageHtml}
    <div class="ws-showcase-caption">${message}</div>
  `;
}