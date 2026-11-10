/* Search shortcut, Seoul-time tint, live crosshair, rifle tracking, and recoil. */
(() => {
  'use strict';

  const root = document.documentElement;
  const searchTrigger = document.getElementById('search-trigger');
  const searchCancel = document.getElementById('search-cancel');
  const searchInput = document.getElementById('search-input');

  if (searchTrigger && searchCancel && searchInput) {
    document.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchTrigger.click();
        searchInput.focus();
      }
      if (event.key === 'Escape' && searchCancel.classList.contains('d-block')) {
        searchCancel.click();
        searchTrigger.focus();
      }
    });
    searchCancel.addEventListener('click', () => { searchInput.value = ''; });
  }

  const dayparts = ['dawn', 'day', 'evening', 'night'];
  const getSeoulHour = () => Number.parseInt(new Intl.DateTimeFormat('en-US', {
    hour: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Seoul'
  }).format(new Date()), 10);
  const automaticDaypart = (hour) => {
    if (hour >= 5 && hour < 9) return 'dawn';
    if (hour >= 9 && hour < 17) return 'day';
    if (hour >= 17 && hour < 20) return 'evening';
    return 'night';
  };
  const applyTheme = () => {
    const preview = localStorage.getItem('sa-daypart-preview');
    root.dataset.daypart = preview || automaticDaypart(getSeoulHour());
  };
  const themeButton = document.querySelector('.sa-hotspot-theme');
  if (themeButton) {
    themeButton.addEventListener('click', () => {
      const current = localStorage.getItem('sa-daypart-preview');
      const active = current || automaticDaypart(getSeoulHour());
      const next = dayparts[(dayparts.indexOf(active) + 1) % dayparts.length];
      localStorage.setItem('sa-daypart-preview', next);
      applyTheme();
    });
  }
  applyTheme();
  window.setInterval(() => {
    if (!localStorage.getItem('sa-daypart-preview')) applyTheme();
  }, 60_000);

  const hero = document.getElementById('sa-fps-hero');
  const aim = hero?.querySelector('.sa-live-aim');
  const rifle = hero?.querySelector('.sa-hybrid-rifle');
  const defaultTarget = hero?.querySelector('.sa-hotspot-ctf');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (!hero || !aim || !rifle || !defaultTarget || !finePointer.matches) {
    if (aim) aim.hidden = true;
    return;
  }

  let bounds = hero.getBoundingClientRect();
  let targetX = bounds.width * .56;
  let targetY = bounds.height * .43;
  let currentX = targetX;
  let currentY = targetY;
  let targetNX = 0;
  let targetNY = 0;
  let currentNX = 0;
  let currentNY = 0;
  let frameId = 0;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const setTarget = (clientX, clientY) => {
    bounds = hero.getBoundingClientRect();
    targetX = clamp(clientX - bounds.left, 28, bounds.width - 28);
    targetY = clamp(clientY - bounds.top, 28, bounds.height - 52);
    targetNX = clamp(((clientX - bounds.left) / bounds.width) * 2 - 1, -1, 1);
    targetNY = clamp(((clientY - bounds.top) / bounds.height) * 2 - 1, -1, 1);
  };
  const resetTarget = () => {
    bounds = hero.getBoundingClientRect();
    const card = defaultTarget.getBoundingClientRect();
    targetX = card.left - bounds.left + card.width / 2;
    targetY = card.top - bounds.top + card.height * .86;
    targetNX = 0;
    targetNY = 0;
  };
  const render = () => {
    const easing = reduceMotion.matches ? 1 : .18;
    currentX += (targetX - currentX) * easing;
    currentY += (targetY - currentY) * easing;
    currentNX += (targetNX - currentNX) * easing;
    currentNY += (targetNY - currentNY) * easing;

    hero.style.setProperty('--aim-left', `${currentX}px`);
    hero.style.setProperty('--aim-top', `${currentY}px`);
    hero.style.setProperty('--gun-x', `${currentNX * 13}px`);
    hero.style.setProperty('--gun-y', `${currentNY * 7}px`);
    hero.style.setProperty('--gun-rotate', `${currentNX * 1.15 - currentNY * .35}deg`);
    frameId = requestAnimationFrame(render);
  };

  hero.addEventListener('pointermove', (event) => setTarget(event.clientX, event.clientY));
  hero.addEventListener('pointerleave', resetTarget);
  hero.addEventListener('pointerdown', () => {
    rifle.animate([
      { transform: 'translate3d(var(--gun-x), var(--gun-y), 0) rotate(var(--gun-rotate))' },
      { transform: 'translate3d(calc(var(--gun-x) + 6px), calc(var(--gun-y) + 8px), 0) rotate(var(--gun-rotate))' },
      { transform: 'translate3d(var(--gun-x), var(--gun-y), 0) rotate(var(--gun-rotate))' }
    ], { duration: 115, easing: 'ease-out' });
  });
  window.addEventListener('resize', resetTarget, { passive: true });
  window.addEventListener('pagehide', () => cancelAnimationFrame(frameId), { once: true });

  resetTarget();
  frameId = requestAnimationFrame(render);
})();
