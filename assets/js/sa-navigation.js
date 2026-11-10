/* Search shortcut, Seoul-time themes, live aim, gun tracking, and scene parallax. */
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

    cancel.addEventListener('click', () => {
      input.value = '';
    });
  }

  const dayparts = ['dawn', 'day', 'evening', 'night'];
  const labels = {
    auto: '자동',
    dawn: '새벽',
    day: '낮',
    evening: '저녁',
    night: '밤'
  };

  const getSeoulHour = () => {
    const formattedHour = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      hourCycle: 'h23',
      timeZone: 'Asia/Seoul'
    }).format(new Date());

    return Number.parseInt(formattedHour, 10);
  };

  const getAutomaticDaypart = (hour) => {
    if (hour >= 5 && hour < 9) return 'dawn';
    if (hour >= 9 && hour < 17) return 'day';
    if (hour >= 17 && hour < 20) return 'evening';
    return 'night';
  };

  const applyTheme = () => {
    const preview = window.localStorage.getItem('sa-daypart-preview') || 'auto';
    const daypart = preview === 'auto' ? getAutomaticDaypart(getSeoulHour()) : preview;
    root.dataset.daypart = daypart;

    const button = document.querySelector('.sa-theme-cycle');
    if (button) {
      button.dataset.preview = preview;
      button.setAttribute('aria-label', `시간대 테마 변경 · 현재 ${labels[preview]}`);
      button.title = `테마: ${labels[preview]} · 클릭하여 변경`;
    }
  };

  const themeButton = document.querySelector('.sa-theme-cycle');
  if (themeButton) {
    const cycle = ['auto', ...dayparts];

    themeButton.addEventListener('click', () => {
      const current = window.localStorage.getItem('sa-daypart-preview') || 'auto';
      const currentIndex = cycle.indexOf(current);
      const next = cycle[(currentIndex + 1) % cycle.length];

      if (next === 'auto') {
        window.localStorage.removeItem('sa-daypart-preview');
      } else {
        window.localStorage.setItem('sa-daypart-preview', next);
      }

      applyTheme();
    });
  }

  applyTheme();
  window.setInterval(() => {
    if (!window.localStorage.getItem('sa-daypart-preview')) applyTheme();
  }, 60 * 1000);

  const hero = document.getElementById('sa-fps-hero');
  const aim = hero?.querySelector('.sa-live-aim');
  const rifle = hero?.querySelector('.sa-rifle');
  const grid = hero?.querySelector('.sa-category-grid');
  const defaultTarget = grid?.querySelector('.sa-category-card:nth-child(2)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (!hero || !aim || !rifle || !grid || !defaultTarget || !finePointer.matches) {
    if (aim) aim.hidden = true;
    return;
  }

  let bounds = hero.getBoundingClientRect();
  let targetAimX = bounds.width * 0.56;
  let targetAimY = bounds.height * 0.43;
  let currentAimX = targetAimX;
  let currentAimY = targetAimY;
  let targetNX = 0;
  let targetNY = 0;
  let currentNX = 0;
  let currentNY = 0;
  let frameId = 0;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const setTargetFromClient = (clientX, clientY) => {
    bounds = hero.getBoundingClientRect();
    targetAimX = clamp(clientX - bounds.left, 22, bounds.width - 22);
    targetAimY = clamp(clientY - bounds.top, 22, bounds.height - 84);
    targetNX = clamp(((clientX - bounds.left) / bounds.width) * 2 - 1, -1, 1);
    targetNY = clamp(((clientY - bounds.top) / bounds.height) * 2 - 1, -1, 1);
  };

  const aimAtDefault = () => {
    bounds = hero.getBoundingClientRect();
    const targetBounds = defaultTarget.getBoundingClientRect();
    targetAimX = targetBounds.left - bounds.left + targetBounds.width / 2;
    targetAimY = targetBounds.top - bounds.top + targetBounds.height / 2;
    targetNX = 0;
    targetNY = 0;
  };

  const render = () => {
    const easing = reduceMotion.matches ? 1 : 0.2;
    currentAimX += (targetAimX - currentAimX) * easing;
    currentAimY += (targetAimY - currentAimY) * easing;
    currentNX += (targetNX - currentNX) * easing;
    currentNY += (targetNY - currentNY) * easing;

    hero.style.setProperty('--aim-left', `${currentAimX}px`);
    hero.style.setProperty('--aim-top', `${currentAimY}px`);
    hero.style.setProperty('--gun-x', `${currentNX * 30}px`);
    hero.style.setProperty('--gun-y', `${currentNY * 18}px`);
    hero.style.setProperty('--gun-rotate', `${currentNX * 3.2 - currentNY * 0.8}deg`);
    hero.style.setProperty('--scene-x', `${currentNX * -8}px`);
    hero.style.setProperty('--scene-y', `${currentNY * -5}px`);

    frameId = window.requestAnimationFrame(render);
  };

  hero.addEventListener('pointermove', (event) => {
    setTargetFromClient(event.clientX, event.clientY);
  });

  hero.addEventListener('pointerleave', aimAtDefault);

  hero.addEventListener('pointerdown', () => {
    rifle.animate(
      [
        { transform: 'translate3d(var(--gun-x), var(--gun-y), 0) rotate(var(--gun-rotate))' },
        { transform: 'translate3d(calc(var(--gun-x) + 8px), calc(var(--gun-y) + 10px), 0) rotate(var(--gun-rotate))' },
        { transform: 'translate3d(var(--gun-x), var(--gun-y), 0) rotate(var(--gun-rotate))' }
      ],
      { duration: 120, easing: 'ease-out' }
    );
  });

  window.addEventListener('resize', aimAtDefault, { passive: true });
  window.addEventListener('pagehide', () => window.cancelAnimationFrame(frameId), { once: true });

  aimAtDefault();
  frameId = window.requestAnimationFrame(render);
})();
