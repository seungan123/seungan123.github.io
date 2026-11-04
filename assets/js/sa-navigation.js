/* Keyboard shortcuts for the existing Chirpy search. No extra dependencies. */
(() => {
  'use strict';
  const start = document.getElementById('search-trigger');
  const cancel = document.getElementById('search-cancel');
  const input = document.getElementById('search-input');
  if (!start || !cancel || !input) return;
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (!start.classList.contains('d-none')) start.click();
      input.focus();
    }
    if (event.key === 'Escape' && cancel.classList.contains('d-block')) {
      cancel.click();
      start.focus();
    }
  });
  cancel.addEventListener('click', () => { input.value = ''; });
})();
