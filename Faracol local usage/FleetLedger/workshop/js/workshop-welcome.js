const WORKSHOP_VISITED_KEY = 'flms_workshop_visited';
const WORKSHOP_RETURN_COUNT_KEY = 'flms_workshop_return_count';
const WORKSHOP_SESSION_ACTIVE_KEY = 'flms_workshop_session_active';

const WORKSHOP_VIDEO_CLIPS = [
  'assets/videos/welcome/blackmain.mp4',
  'assets/videos/welcome/smoothmain.mp4',
];

const WS_ICON_CAR = `
  <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11"/>
  <rect x="2" y="11" width="20" height="6" rx="1.5"/>
  <circle cx="7" cy="17.5" r="1.75"/>
  <circle cx="17" cy="17.5" r="1.75"/>
`;

const WS_ICON_WRENCH = `<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4l-6 6 2.9 2.9 6-6a4 4 0 0 0 5.4-5.4l-3.5 3.5-2.9-2.9 3.5-3.5z"/>`;
const WS_ICON_GAUGE = `<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2"/><path d="M9 3h6"/>`;
const WS_ICON_TOOLBOX = `
  <rect x="2" y="9" width="20" height="11" rx="2"/>
  <path d="M7 9V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3"/>
  <line x1="2" y1="13" x2="22" y2="13"/>
`;

const WORKSHOP_FIRST_VISIT = {
  title: 'Welcome to the Workshop',
  sub: 'Your repair bay, fully wired in.',
  icon: WS_ICON_CAR,
  variant: 'v1',
};

const WORKSHOP_RETURN_MESSAGES = [
  { title: 'More Work To Do', sub: "Let's get back to it.", icon: WS_ICON_WRENCH, variant: 'v2' },
  { title: 'More Task At Hand', sub: 'Time to keep things moving.', icon: WS_ICON_GAUGE, variant: 'v3' },
  { title: 'Back In The Bay', sub: 'Every job counts.', icon: WS_ICON_TOOLBOX, variant: 'v4' },
  { title: "Let's Get Rolling", sub: 'Another day, another engine.', icon: WS_ICON_CAR, variant: 'v5' },
  { title: 'Time To Turn Wrenches', sub: "The bay's ready when you are.", icon: WS_ICON_WRENCH, variant: 'v6' },
];

function getTimeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { title: 'Good Morning', sub: 'Ready for the bay.' };
  if (hour >= 12 && hour < 17) return { title: 'Good Afternoon', sub: "Let's keep it rolling." };
  if (hour >= 17 && hour < 21) return { title: 'Good Evening', sub: 'Evening shift, finishing strong.' };
  return { title: 'Working Late', sub: 'Burning the midnight oil.' };
}

function revealMainContent() {
  const main = document.getElementById('ws-main-content');
  if (main) {
    main.classList.add('ws-visible');
  }
}

function playVideoWelcome() {
  const greeting = getTimeOfDayGreeting();
  const clip = WORKSHOP_VIDEO_CLIPS[Math.floor(Math.random() * WORKSHOP_VIDEO_CLIPS.length)];

  const overlay = document.createElement('div');
  overlay.className = 'ws-video-overlay';
  overlay.innerHTML = `
    <video class="ws-video-bg" muted playsinline preload="none" loop></video>
    <div class="ws-video-gradient"></div>
    <div class="ws-video-text-wrap">
      <div class="ws-video-title">${greeting.title}</div>
      <div class="ws-video-sub">${greeting.sub}</div>
    </div>
  `;

  document.body.appendChild(overlay);
  revealMainContent();

  const video = overlay.querySelector('.ws-video-bg');

  video.addEventListener('error', () => {
    overlay.remove();
    playStandardReturnWelcome(greeting.title, greeting.sub, WS_ICON_CAR, 'v5');
  });

  video.src = clip;
  video.load();
  video.play().catch(() => {
  });

  setTimeout(() => {
    overlay.classList.add('ws-fade-out');
    setTimeout(() => {
      video.pause();
      video.removeAttribute('src');
      video.load();
      overlay.remove();
    }, 700);
  }, 4000);
}

function playStandardReturnWelcome(title, sub, icon, variant) {
  const overlay = document.createElement('div');
  overlay.className = `ws-welcome-overlay ws-welcome-back ws-variant-${variant}`;
  overlay.innerHTML = `
    <svg class="ws-welcome-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">${icon}</svg>
    <div class="ws-welcome-text-wrap"><div class="ws-welcome-text">${title}</div></div>
    <div class="ws-welcome-sub">${sub}</div>
  `;

  document.body.appendChild(overlay);
  revealMainContent();

  setTimeout(() => {
    overlay.classList.add('ws-fade-out');
    setTimeout(() => overlay.remove(), 700);
  }, 2600);
}

function playWorkshopWelcome() {
  if (window.sessionStorage.getItem(WORKSHOP_SESSION_ACTIVE_KEY) === 'true') {
    revealMainContent();
    return;
  }

  const hasVisitedBefore = window.localStorage.getItem(WORKSHOP_VISITED_KEY) === 'true';
  window.localStorage.setItem(WORKSHOP_VISITED_KEY, 'true');
  window.sessionStorage.setItem(WORKSHOP_SESSION_ACTIVE_KEY, 'true');

  if (!hasVisitedBefore) {
    const overlay = document.createElement('div');
    overlay.className = `ws-welcome-overlay ws-variant-${WORKSHOP_FIRST_VISIT.variant}`;
    overlay.innerHTML = `
      <svg class="ws-welcome-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">${WORKSHOP_FIRST_VISIT.icon}</svg>
      <div class="ws-welcome-text-wrap"><div class="ws-welcome-text">${WORKSHOP_FIRST_VISIT.title}</div></div>
      <div class="ws-welcome-sub">${WORKSHOP_FIRST_VISIT.sub}</div>
    `;
    document.body.appendChild(overlay);
    revealMainContent();

    setTimeout(() => {
      overlay.classList.add('ws-fade-out');
      setTimeout(() => overlay.remove(), 700);
    }, 4200);
    return;
  }

  const returnCount = Number(window.localStorage.getItem(WORKSHOP_RETURN_COUNT_KEY) || '0') + 1;
  window.localStorage.setItem(WORKSHOP_RETURN_COUNT_KEY, String(returnCount));

  if (returnCount % 10 === 0) {
    playVideoWelcome();
    return;
  }

  const variant = WORKSHOP_RETURN_MESSAGES[returnCount % WORKSHOP_RETURN_MESSAGES.length];
  playStandardReturnWelcome(variant.title, variant.sub, variant.icon, variant.variant);
}