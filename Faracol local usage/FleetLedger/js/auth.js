/**
 * auth.js
 * ----------------------------------------------------------------
 * Handles authentication for Fleet Ledger: seeding a default admin
 * account, validating login credentials, managing the active
 * session, and redirecting users based on their role.
 *
 * IMPORTANT — SHARED FILE SCOPING:
 * This file is loaded on EVERY authenticated page, including
 * driver/dashboard.html and workshop/*.html via relative paths.
 * logout() clears the Workshop "inside session" flag too, so
 * logging out and back in always treats the next Workshop visit
 * as a fresh entry.
 * ----------------------------------------------------------------
 */

const SESSION_STORAGE_KEY = 'flms_session';
const USERS_COLLECTION = 'users';

const DEFAULT_ADMIN = {
  name: 'Admin User',
  email: 'admin@fleetledger.com',
  password: 'Admin123!',
  role: 'admin',
};

async function seedAdminUser() {
  if (collectionExists(USERS_COLLECTION)) {
    return;
  }

  const passwordHash = await hashText(DEFAULT_ADMIN.password);

  const adminRecord = {
    id: generateId(),
    name: DEFAULT_ADMIN.name,
    email: DEFAULT_ADMIN.email,
    passwordHash,
    role: DEFAULT_ADMIN.role,
  };

  saveCollection(USERS_COLLECTION, [adminRecord]);
}

async function login(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = findRecord(USERS_COLLECTION, (record) => record.email.toLowerCase() === normalizedEmail);

  if (!user) {
    return { success: false, message: 'No account found with that email address.' };
  }

  const attemptedHash = await hashText(password);

  if (attemptedHash !== user.passwordHash) {
    return { success: false, message: 'Incorrect password. Please try again.' };
  }

  return { success: true, role: user.role, name: user.name, userId: user.id, linkedDriverId: user.linkedDriverId || null };
}

function createSession(sessionData, rememberMe) {
  const payload = JSON.stringify({
    ...sessionData,
    loginTime: new Date().toISOString(),
  });

  if (rememberMe) {
    window.localStorage.setItem(SESSION_STORAGE_KEY, payload);
  } else {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, payload);
  }
}

function getActiveSession() {
  const persistentSession = window.localStorage.getItem(SESSION_STORAGE_KEY);
  const tabSession = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  const raw = persistentSession || tabSession;

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error('auth.js: Failed to parse session data', error);
    return null;
  }
}

/**
 * Clears the active session and returns the user to the login page.
 * Also clears the Workshop "inside session" flag so a fresh login
 * always treats the next Workshop visit as a genuine re-entry.
 */
function logout() {
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  window.sessionStorage.removeItem('flms_workshop_session_active');

  const isInSubfolder = window.location.pathname.includes('/driver/') || window.location.pathname.includes('/workshop/');
  window.location.href = isInSubfolder ? '../index.html' : 'index.html';
}

function redirectByRole(role) {
  if (role === 'admin') {
    window.location.href = 'dashboard.html';
    return;
  }

  window.location.href = 'driver/dashboard.html';
}

document.addEventListener('DOMContentLoaded', async () => {
  await seedAdminUser();

  const loginForm = $('#login-form');

  if (!loginForm) {
    return;
  }

  const existingSession = getActiveSession();
  if (existingSession) {
    redirectByRole(existingSession.role);
    return;
  }

  const emailInput = $('#email');
  const passwordInput = $('#password');
  const emailError = $('#email-error');
  const passwordError = $('#password-error');
  const rememberCheckbox = $('#remember-me');
  const loginBanner = $('#login-banner');
  const submitButton = $('#login-submit');
  const submitLabel = $('.btn-label', submitButton);
  const submitSpinner = $('.btn-spinner', submitButton);
  const passwordToggle = $('#password-toggle');

  $('#current-year').textContent = new Date().getFullYear();

  passwordToggle.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    passwordToggle.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
  });

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    clearFieldError(emailInput, emailError);
    clearFieldError(passwordInput, passwordError);
    loginBanner.hidden = true;

    const email = emailInput.value;
    const password = passwordInput.value;
    let hasValidationError = false;

    if (!email.trim()) {
      showFieldError(emailInput, emailError, 'Email address is required.');
      hasValidationError = true;
    } else if (!isValidEmail(email)) {
      showFieldError(emailInput, emailError, 'Please enter a valid email address.');
      hasValidationError = true;
    }

    if (!password) {
      showFieldError(passwordInput, passwordError, 'Password is required.');
      hasValidationError = true;
    }

    if (hasValidationError) {
      return;
    }

    submitButton.disabled = true;
    submitLabel.hidden = true;
    submitSpinner.hidden = false;

    const result = await login(email, password);

    if (!result.success) {
      loginBanner.textContent = result.message;
      loginBanner.hidden = false;

      submitButton.disabled = false;
      submitLabel.hidden = false;
      submitSpinner.hidden = true;
      return;
    }

    createSession(
      { userId: result.userId, name: result.name, role: result.role, linkedDriverId: result.linkedDriverId },
      rememberCheckbox.checked
    );

    redirectByRole(result.role);
  });
});