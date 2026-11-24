(() => {
  const content = document.querySelector('article > .content');
  if (!content?.querySelector('.glossary-table')) return;

  const popover = document.createElement('div');
  popover.id = 'glossary-popover';
  popover.className = 'glossary-popover';
  popover.hidden = true;
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
  const dismiss = (restoreFocus = false) => {
    if (popover.hidden) return;
    popover.hidden = true;
    source?.setAttribute('aria-expanded', 'false');
    if (restoreFocus) source?.focus({ preventScroll: true });
  };

  const position = () => {
    if (!source || popover.hidden) return;
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

  const bind = (trigger, term, cell) => {
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', popover.id);
    trigger.setAttribute('aria-expanded', 'false');

    trigger.addEventListener('click', (event) => {
      if (!isPlainClick(event)) return;
      event.preventDefault();
      if (source === trigger && !popover.hidden) {
        dismiss(true);
        return;
      }
      source?.setAttribute('aria-expanded', 'false');
      source = trigger;
      title.textContent = term.textContent.trim();
      description.textContent = cell.textContent.trim();
      trigger.setAttribute('aria-expanded', 'true');
      popover.hidden = false;
      position();
      closeButton.focus({ preventScroll: true });
    });
  };

  content.querySelectorAll('.glossary-table .glossary-term[id]').forEach((term) => {
    const cell = term.closest('tr')?.querySelector('td:last-child');
    if (!cell) return;
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'glossary-trigger';
    trigger.textContent = term.textContent;
    term.replaceChildren(trigger);
    bind(trigger, term, cell);
  });

  content.querySelectorAll('a[href^="#term-"]').forEach((link) => {
    const term = document.getElementById(link.hash.slice(1));
    const table = term?.closest('.glossary-table');
    const cell = term?.closest('tr')?.querySelector('td:last-child');
    if (table && content.contains(table) && cell) bind(link, term, cell);
  });

  closeButton.addEventListener('click', () => dismiss(true));
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || popover.hidden) return;
    event.preventDefault();
    event.stopPropagation();
    dismiss(true);
  });
  document.addEventListener('click', (event) => {
    if (!popover.hidden && !popover.contains(event.target) && !source?.contains(event.target)) {
      dismiss();
    }
  });
  window.addEventListener('scroll', position, { passive: true });
  window.addEventListener('resize', position);
})();
