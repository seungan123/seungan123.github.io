// Old shared home links still lead to the corresponding category.
(() => {
  function openCategory() {
    const fragment = location.hash.slice(1);
    if (!fragment.startsWith('log-')) return;
    const link = Array.from(document.querySelectorAll('[data-old-log]')).find(item => item.dataset.oldLog === fragment);
    if (link) location.replace(link.href);
  }
  openCategory();
  window.addEventListener('hashchange', openCategory);
})();
