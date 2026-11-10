/* Search shortcuts, Seoul-time themes, theme preview, and category aim cursor. */
(() => {
  'use strict';
  const root = document.documentElement;
  const start = document.getElementById('search-trigger');
  const cancel = document.getElementById('search-cancel');
  const input = document.getElementById('search-input');
  const themePreview = document.getElementById('sa-theme-preview');
  const dayparts = ['dawn', 'day', 'evening', 'night'];
  let previewTimer;

  if (start && cancel && input) {
    document.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); start.click(); input.focus();
      }
      if (event.key === 'Escape' && cancel.classList.contains('d-block')) cancel.click();
    });
    cancel.addEventListener('click', () => { input.value = ''; });
  }

  const getSeoulHour = () => Number.parseInt(new Intl.DateTimeFormat('en-US', {
    hour: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Seoul'
  }).format(new Date()), 10);
  const getDaypart = (hour) => hour >= 5 && hour < 9 ? 'dawn' : hour >= 9 && hour < 17 ? 'day' : hour >= 17 && hour < 20 ? 'evening' : 'night';
  const setDaypart = (daypart) => {
    root.dataset.daypart = daypart;
    const hero = document.getElementById('sa-fps-hero');
    if (hero) hero.dataset.daypart = daypart;
    if (themePreview) themePreview.dataset.theme = daypart;
  };
  const applyTimeTheme = () => setDaypart(getDaypart(getSeoulHour()));
  applyTimeTheme();
  window.setInterval(applyTimeTheme, 60 * 1000);

  if (themePreview) {
    themePreview.addEventListener('click', () => {
      const current = dayparts.indexOf(root.dataset.daypart);
      setDaypart(dayparts[(current + 1) % dayparts.length]);
      window.clearTimeout(previewTimer);
      previewTimer = window.setTimeout(applyTimeTheme, 15000);
    });
  }

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
      const box = defaultTarget.getBoundingClientRect();
      moveAim(box.left + box.width / 2, box.top + box.height / 2);
    };
    grid.addEventListener('pointermove', (event) => moveAim(event.clientX, event.clientY));
    grid.addEventListener('pointerleave', aimAtDefault);
    window.addEventListener('resize', aimAtDefault, { passive: true });
    window.requestAnimationFrame(aimAtDefault);
  } else if (aim) aim.hidden = true;
})();
