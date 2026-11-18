(() => {
  const content = document.querySelector('article > .content');
  if (!content?.querySelector('.glossary-table') ||
      !('showPopover' in HTMLElement.prototype)) return;

  const popover = document.createElement('div');
  popover.id = 'glossary-popover';
  popover.className = 'glossary-popover';
  popover.setAttribute('popover', 'auto');
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-labelledby', 'glossary-popover-title');
  popover.setAttribute('aria-describedby', 'glossary-popover-description');

  const title = document.createElement('p');
  title.id = 'glossary-popover-title';
  title.className = 'glossary-popover-title';
  const description = document.createElement('p');
  description.id = 'glossary-popover-description';
  description.className = 'glossary-popover-description';
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'glossary-popover-close';
  closeButton.setAttribute('aria-label', '용어 설명 닫기');
  closeButton.textContent = '×';
  popover.append(title, description, closeButton);
  document.body.append(popover);

  let source = null;
  const isOpen = () => popover.matches(':popover-open');
  const dismiss = (restoreFocus = false) => {
    if (!isOpen()) return;
    popover.hidePopover();
    source?.setAttribute('aria-expanded', 'false');
    if (restoreFocus) source?.focus({ preventScroll: true });
  };

  const position = () => {
    if (!source || !isOpen()) return;
    const anchor = source.getBoundingClientRect();
    const box = popover.getBoundingClientRect();
    const margin = 12;
    const width = document.documentElement.clientWidth;
    const height = window.innerHeight;
    const left = Math.max(margin, Math.min(
      anchor.left + anchor.width / 2 - box.width / 2,
      width - box.width - margin
    ));
    let top = anchor.bottom + 8;
    if (top + box.height > height - margin) top = anchor.top - box.height - 8;
    top = Math.max(margin, Math.min(top, height - box.height - margin));
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  };

  const isPlainClick = (event) =>
    !event.defaultPrevented && event.button === 0 &&
    !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

  content.querySelectorAll('a[href^="#term-"]').forEach((link) => {
    const term = document.getElementById(link.hash.slice(1));
    const table = term?.closest('.glossary-table');
    const cell = term?.closest('tr')?.querySelector('td:last-child');
    if (!table || !content.contains(table) || !cell) return;
    link.setAttribute('aria-haspopup', 'dialog');
    link.setAttribute('aria-controls', popover.id);
    link.setAttribute('aria-expanded', 'false');

    link.addEventListener('click', (event) => {
      if (!isPlainClick(event)) return;
      event.preventDefault();
      if (source === link && isOpen()) {
        dismiss(true);
        return;
      }
      source?.setAttribute('aria-expanded', 'false');
      source = link;
      title.textContent = link.textContent.trim();
      description.textContent = cell.textContent.trim();
      link.setAttribute('aria-expanded', 'true');
      if (!isOpen()) popover.showPopover();
      position();
      closeButton.focus({ preventScroll: true });
    });
  });

  closeButton.addEventListener('click', () => dismiss(true));
  popover.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    dismiss(true);
  });
  popover.addEventListener('toggle', (event) => {
    if (event.newState === 'closed') source?.setAttribute('aria-expanded', 'false');
  });
  window.addEventListener('scroll', () => dismiss(), { passive: true });
  window.addEventListener('resize', position);
})();
