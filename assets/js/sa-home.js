(() => {
  'use strict';

  const hero = document.querySelector('.sa-hero');
  const aim = hero?.querySelector('.sa-aim');
  const rifle = hero?.querySelector('.sa-rifle');
  if (!hero || !aim || !rifle || hero.dataset.saInteractionInitialized) return;
  hero.dataset.saInteractionInitialized = 'true';

  const world = document.querySelector('.sa-world');
  const worldViewport = world?.querySelector('.sa-world-viewport');
  const rifleLayer = hero.querySelector('.sa-rifle-layer');
  const selectedCard = hero.querySelector('.sa-category-card.is-selected');
  const desktopMouse = window.matchMedia('(min-width: 801px) and (hover: hover) and (pointer: fine)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const recoilDuration = 120;
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const current = { aimX: 0, aimY: 0, gunX: 0, gunY: 0, angle: 0 };
  let enabled = false;
  let inside = false;
  let showDefault = false;
  let pointer = null;
  let positioned = false;
  let frame = null;
  let lastTime = null;
  let pendingRecoil = false;
  let recoilStart = null;

  const schedule = () => {
    if (frame === null && !document.hidden) frame = requestAnimationFrame(render);
  };

  // Event handlers record input only; layout reads and visual writes share one RAF.
  const recordPointer = (event) => {
    if (!enabled) return;
    if (event.pointerType !== 'mouse') {
      leave();
      return;
    }
    pointer = { x: event.clientX, y: event.clientY };
    inside = true;
    showDefault = false;
    schedule();
  };

  function leave() {
    inside = false;
    showDefault = false;
    pointer = null;
    positioned = false;
    pendingRecoil = false;
    recoilStart = null;
    schedule();
  }

  function render(time) {
    frame = null;
    const dt = lastTime === null ? 1000 / 60 : clamp(time - lastTime, 0, 48);
    lastTime = time;
    const reduce = reducedMotion.matches;

    // Native document scrolling drives decorative transforms only. All geometry
    // is read before writes, using current content/viewport sizes rather than a fixed canvas.
    const bounds = hero.getBoundingClientRect();
    const worldBounds = world?.getBoundingClientRect();
    const viewportHeight = Math.max(window.innerHeight || bounds.height, 1);
    const travel = worldBounds ? clamp(-worldBounds.top, 0, Math.max(worldBounds.height - viewportHeight, 0)) : 0;
    const heroProgress = clamp(-bounds.top / Math.max(bounds.height, 1), 0, 1);
    const farY = reduce ? 0 : -Math.min(travel * 0.06, viewportHeight * 0.035);
    const fieldY = reduce ? 0 : -Math.min(travel * 0.16, viewportHeight * 0.065);
    const fadeProgress = clamp(heroProgress / 0.32, 0, 1);
    const rifleOpacity = reduce ? 1 : 1 - fadeProgress * fadeProgress * (3 - 2 * fadeProgress);
    const rifleExitY = reduce ? 0 : heroProgress * bounds.height * 0.5;
    if (inside && pointer && (pointer.x < bounds.left || pointer.x > bounds.left + bounds.width ||
      pointer.y < bounds.top || pointer.y > bounds.top + bounds.height)) {
      inside = false;
      showDefault = false;
      pendingRecoil = false;
      recoilStart = null;
    }
    let targetAimX = current.aimX;
    let targetAimY = current.aimY;
    if (!positioned) {
      const card = selectedCard?.getBoundingClientRect();
      current.aimX = card ? card.left + card.width / 2 - bounds.left : bounds.width / 2;
      current.aimY = card ? card.top + card.height / 2 - bounds.top : bounds.height / 2;
      targetAimX = current.aimX;
      targetAimY = current.aimY;
      positioned = true;
    }
    if (inside && pointer) {
      targetAimX = clamp(pointer.x - bounds.left, 0, bounds.width);
      targetAimY = clamp(pointer.y - bounds.top, 0, bounds.height);
    }
    const aimVisible = enabled && (inside || showDefault) &&
      bounds.top + bounds.height > 0 && bounds.top < viewportHeight;
    const moveGun = enabled && inside && !reduce;
    const nx = moveGun ? clamp(targetAimX / Math.max(bounds.width, 1) * 2 - 1, -1, 1) : 0;
    const ny = moveGun ? clamp(targetAimY / Math.max(bounds.height, 1) * 2 - 1, -1, 1) : 0;
    const target = { aimX: targetAimX, aimY: targetAimY, gunX: nx * 24, gunY: ny * 14, angle: nx * 2.5 };
    let unsettled = false;
    for (const key of Object.keys(current)) {
      const isAim = key.startsWith('aim');
      const alpha = reduce || !enabled || (isAim && !aimVisible) ? 1 : 1 - Math.exp(-dt / (isAim ? 45 : 100));
      current[key] += (target[key] - current[key]) * alpha;
      if (Math.abs(target[key] - current[key]) < 0.01) current[key] = target[key];
      else unsettled = true;
    }

    if (pendingRecoil && moveGun) recoilStart = time;
    pendingRecoil = false;
    let recoil = 0;
    if (recoilStart !== null && moveGun) {
      const progress = clamp((time - recoilStart) / recoilDuration, 0, 1);
      recoil = 8 * (1 - progress) ** 2;
      if (progress === 1) recoilStart = null;
    } else recoilStart = null;

    hero.classList.toggle('sa-interaction-enabled', enabled);
    hero.classList.toggle('sa-aim-visible', aimVisible);
    aim.style.setProperty('--sa-aim-x', `${current.aimX.toFixed(3)}px`);
    aim.style.setProperty('--sa-aim-y', `${current.aimY.toFixed(3)}px`);
    rifle.style.setProperty('--sa-rifle-x', `${current.gunX.toFixed(3)}px`);
    rifle.style.setProperty('--sa-rifle-y', `${current.gunY.toFixed(3)}px`);
    rifle.style.setProperty('--sa-rifle-angle', `${current.angle.toFixed(3)}deg`);
    rifle.style.setProperty('--sa-recoil', `${recoil.toFixed(3)}px`);
    if (worldViewport) {
      worldViewport.style.setProperty('--sa-far-y', `${farY.toFixed(3)}px`);
      worldViewport.style.setProperty('--sa-field-y', `${fieldY.toFixed(3)}px`);
    }
    if (rifleLayer) {
      rifleLayer.style.setProperty('--sa-rifle-exit-y', `${rifleExitY.toFixed(3)}px`);
      rifleLayer.style.setProperty('--sa-rifle-opacity', rifleOpacity.toFixed(3));
    }

    if (unsettled || recoilStart !== null) schedule();
    else lastTime = null;
  }

  const configure = () => {
    enabled = desktopMouse.matches && (navigator.maxTouchPoints || 0) === 0;
    inside = false;
    showDefault = enabled;
    pointer = null;
    positioned = false;
    pendingRecoil = false;
    recoilStart = null;
    lastTime = null;
    schedule();
  };

  hero.addEventListener('pointerenter', recordPointer, { passive: true });
  hero.addEventListener('pointermove', recordPointer, { passive: true });
  hero.addEventListener('pointerleave', leave, { passive: true });
  hero.addEventListener('pointercancel', leave, { passive: true });
  hero.addEventListener('pointerdown', (event) => {
    recordPointer(event);
    if (enabled && event.pointerType === 'mouse' && event.button === 0 && !reducedMotion.matches) {
      pendingRecoil = true;
      schedule();
    }
    // Native anchor navigation is never prevented or delayed.
  }, { passive: true });
  hero.addEventListener('focusin', () => {
    if (document.activeElement?.matches(':focus-visible')) leave();
  });
  desktopMouse.addEventListener('change', configure);
  reducedMotion.addEventListener('change', configure);
  window.addEventListener('resize', () => { positioned = false; schedule(); }, { passive: true });
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('blur', leave);
  window.addEventListener('pagehide', () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    lastTime = null;
    recoilStart = null;
    pendingRecoil = false;
  });
  window.addEventListener('pageshow', configure);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      lastTime = null;
    } else configure();
  });
  configure();
})();
