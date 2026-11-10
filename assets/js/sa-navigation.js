/* Search shortcuts, Seoul-time theme switching, and category aim cursor. */
(() => {
  'use strict';

  const root = document.documentElement;
  const start = document.getElementById('search-trigger');
  const cancel = document.getElementById('search-cancel');
  const input = document.getElementById('search-input');

  if (start && cancel && input) {
    document.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        start.click();
        input.focus();
      }
      if (event.key === 'Escape' && cancel.classList.contains('d-block')) {
        cancel.click();
        start.focus();
      }
    });
    cancel.addEventListener('click', () => { input.value = ''; });
  }

  const getSeoulHour = () => {
    const hour = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      hourCycle: 'h23',
      timeZone: 'Asia/Seoul'
    }).format(new Date());
    return Number.parseInt(hour, 10);
  };

  const getDaypart = (hour) => {
    if (hour >= 5 && hour < 9) return 'dawn';
    if (hour >= 9 && hour < 17) return 'day';
    if (hour >= 17 && hour < 20) return 'evening';
    return 'night';
  };

  const applyTimeTheme = () => {
    const daypart = getDaypart(getSeoulHour());
    root.dataset.daypart = daypart;
    const hero = document.getElementById('sa-fps-hero');
    if (hero) hero.dataset.daypart = daypart;
  };

  applyTimeTheme();
  window.setInterval(applyTimeTheme, 60 * 1000);

  const hero = document.getElementById('sa-fps-hero');
  const aim = hero?.querySelector('.sa-aim-cursor');
  const grid = hero?.querySelector('.sa-category-grid');
  const defaultTarget = grid?.querySelector('.sa-category-card:nth-child(2)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  if (hero && aim && grid && defaultTarget && finePointer.matches) {
    const moveAim = (clientX, clientY) => {
      const bounds = hero.getBoundingClientRect();
      aim.style.left = `${clientX - bounds.left}px`;
      aim.style.top = `${clientY - bounds.top}px`;
    };

    const aimAtDefault = () => {
      const targetBounds = defaultTarget.getBoundingClientRect();
      moveAim(
        targetBounds.left + targetBounds.width / 2,
        targetBounds.top + targetBounds.height / 2
      );
    };

    grid.addEventListener('pointermove', (event) => {
      moveAim(event.clientX, event.clientY);
    });
    grid.addEventListener('pointerleave', aimAtDefault);
    window.addEventListener('resize', aimAtDefault, { passive: true });
    window.requestAnimationFrame(aimAtDefault);
  } else if (aim) {
    aim.hidden = true;
  }
})();
