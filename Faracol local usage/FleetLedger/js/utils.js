function $(selector, scope = document) {
  return scope.querySelector(selector);
}

function isValidEmail(email) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email.trim());
}

function generateId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

async function hashText(plainText) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plainText);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function showFieldError(inputEl, errorEl, message) {
  inputEl.classList.add('input-invalid');
  errorEl.textContent = message;
}

function clearFieldError(inputEl, errorEl) {
  inputEl.classList.remove('input-invalid');
  errorEl.textContent = '';
}

document.addEventListener('wheel', (event) => {
  const wrapper = event.target.closest('.table-wrapper');
  if (wrapper && wrapper.scrollWidth > wrapper.clientWidth) {
    wrapper.scrollLeft += event.deltaY;
    event.preventDefault();
  }
}, { passive: false });

function setButtonLoading(button, isLoading, style = 'spinner', loadingText = 'Saving...') {
  if (isLoading) {
    if (!button.dataset.originalHtml) {
      button.dataset.originalHtml = button.innerHTML;
    }
    button.disabled = true;

    const icons = {
      spinner: '<span class="btn-loading-ring"></span>',
      upload: '<span class="btn-loading-icon btn-loading-upload"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg></span>',
      download: '<span class="btn-loading-icon btn-loading-download"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg></span>',
    };

    button.innerHTML = `${icons[style] || icons.spinner}<span>${loadingText}</span>`;
  } else {
    button.disabled = false;
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
    }
  }
}