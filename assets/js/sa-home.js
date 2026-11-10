(() => {
  'use strict';

  const root = document.documentElement;
  const world = document.getElementById('sa-home-world');
  const hero = document.getElementById('sa-fps-hero');
  if (!world || !hero) return;

  const aim = hero.querySelector('.sa-live-aim');
  const gun = hero.querySelector('.sa-gun-rig');
  const cards = [...hero.querySelectorAll('[data-target-card]')];
  const selectedCard = cards.find((card) => card.classList.contains('is-selected')) || cards[0];
  const timeButton = hero.querySelector('.sa-time-button');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const dayparts = ['dawn', 'day', 'evening', 'night'];
  const labels = { auto: '자동', dawn: '새벽', day: '낮', evening: '저녁', night: '밤' };
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const getSeoulHour = () => Number.parseInt(
    new Intl.DateTimeFormat('en-US', {
      hour: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Seoul'
    }).format(new Date()), 10
  );

  const automaticDaypart = (hour) => {
    if (hour >= 5 && hour < 9) return 'dawn';
    if (hour >= 9 && hour < 17) return 'day';
    if (hour >= 17 && hour < 20) return 'evening';
    return 'night';
  };

  const applyTime = () => {
    const preview = localStorage.getItem('sa-time-preview') || 'auto';
    const daypart = preview === 'auto' ? automaticDaypart(getSeoulHour()) : preview;
    root.dataset.saTime = daypart;
    if (timeButton) {
      timeButton.dataset.mode = preview;
      timeButton.title = `시간대: ${labels[preview]} · 클릭하여 변경`;
      timeButton.setAttribute('aria-label', `시간대 테마 변경 · 현재 ${labels[preview]}`);
    }
  };

  if (timeButton) {
    const cycle = ['auto', ...dayparts];
    timeButton.addEventListener('click', () => {
      const current = localStorage.getItem('sa-time-preview') || 'auto';
      const next = cycle[(cycle.indexOf(current) + 1) % cycle.length];
      if (next === 'auto') localStorage.removeItem('sa-time-preview');
      else localStorage.setItem('sa-time-preview', next);
      applyTime();
    });
  }
  applyTime();
  setInterval(() => {
    if (!localStorage.getItem('sa-time-preview')) applyTime();
  }, 60000);

  let heroBounds = hero.getBoundingClientRect();
  let targetX = heroBounds.width * 0.56;
  let targetY = heroBounds.height * 0.43;
  let currentX = targetX;
  let currentY = targetY;
  let targetNX = 0;
  let targetNY = 0;
  let currentNX = 0;
  let currentNY = 0;
  let scrollProgress = 0;
  let raf = 0;

  const aimAtCard = (card = selectedCard) => {
    if (!card) return;
    heroBounds = hero.getBoundingClientRect();
    const box = card.getBoundingClientRect();
    targetX = box.left - heroBounds.left + box.width / 2;
    targetY = box.top - heroBounds.top + box.height / 2;
    targetNX = 0;
    targetNY = 0;
  };

  const setPointerTarget = (event) => {
    heroBounds = hero.getBoundingClientRect();
    targetX = clamp(event.clientX - heroBounds.left, 24, heroBounds.width - 24);
    targetY = clamp(event.clientY - heroBounds.top, 24, heroBounds.height - 78);
    targetNX = clamp((targetX / heroBounds.width) * 2 - 1, -1, 1);
    targetNY = clamp((targetY / heroBounds.height) * 2 - 1, -1, 1);
  };

  const updateScroll = () => {
    const rect = world.getBoundingClientRect();
    const distance = Math.max(1, world.offsetHeight - window.innerHeight);
    scrollProgress = clamp(-rect.top / distance, 0, 1);
  };

  const render = () => {
    const ease = reduceMotion.matches ? 1 : 0.18;
    currentX += (targetX - currentX) * ease;
    currentY += (targetY - currentY) * ease;
    currentNX += (targetNX - currentNX) * ease;
    currentNY += (targetNY - currentNY) * ease;

    const gunX = currentNX * 34;
    const gunY = currentNY * 18 + scrollProgress * 235;
    const gunRotate = currentNX * 3.5 - currentNY * 1.3 + scrollProgress * 7;
    const sceneX = currentNX * -9;
    const sceneY = currentNY * -5 - scrollProgress * 16;
    const copyOpacity = clamp(1 - scrollProgress * 1.65, 0, 1);
    const cardsOpacity = clamp(1 - scrollProgress * 1.15, 0.18, 1);
    const traceHeight = scrollProgress * Math.max(0, heroBounds.height - currentY - 84);

    hero.style.setProperty('--aim-left', `${currentX}px`);
    hero.style.setProperty('--aim-top', `${currentY}px`);
    hero.style.setProperty('--gun-x', `${gunX}px`);
    hero.style.setProperty('--gun-y', `${gunY}px`);
    hero.style.setProperty('--gun-rotate', `${gunRotate}deg`);
    hero.style.setProperty('--scene-x', `${sceneX}px`);
    hero.style.setProperty('--scene-y', `${sceneY}px`);
    hero.style.setProperty('--scroll-progress', scrollProgress.toFixed(4));
    hero.style.setProperty('--copy-opacity', copyOpacity.toFixed(4));
    hero.style.setProperty('--cards-opacity', cardsOpacity.toFixed(4));
    hero.style.setProperty('--trace-height', `${traceHeight}px`);

    raf = requestAnimationFrame(render);
  };

  if (finePointer.matches && aim && gun) {
    hero.addEventListener('pointermove', setPointerTarget);
    hero.addEventListener('pointerleave', () => aimAtCard());

    cards.forEach((card) => {
      card.addEventListener('pointerenter', () => {
        cards.forEach((item) => item.classList.remove('is-selected'));
        card.classList.add('is-selected');
      });
      card.addEventListener('pointerleave', () => {
        card.classList.remove('is-selected');
        selectedCard?.classList.add('is-selected');
      });
    });

    hero.addEventListener('pointerdown', () => {
      gun.classList.remove('is-firing');
      void gun.offsetWidth;
      gun.classList.add('is-firing');
      window.setTimeout(() => gun.classList.remove('is-firing'), 150);
    });
  } else if (aim) {
    aim.hidden = true;
  }

  window.addEventListener('scroll', updateScroll, { passive: true });
  window.addEventListener('resize', () => {
    heroBounds = hero.getBoundingClientRect();
    aimAtCard();
    updateScroll();
  }, { passive: true });
  window.addEventListener('pagehide', () => cancelAnimationFrame(raf), { once: true });

  updateScroll();
  requestAnimationFrame(() => {
    aimAtCard();
    raf = requestAnimationFrame(render);
  });
})();
