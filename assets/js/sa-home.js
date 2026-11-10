(() => {
  'use strict';

  const hero = document.querySelector('.sa-hero');
  const world = document.querySelector('.sa-world');
  const aim = world?.querySelector('.sa-aim');
  const rifle = world?.querySelector('.sa-rifle');
  if (!hero || !world || !aim || !rifle || world.dataset.saInteractionInitialized) return;
  world.dataset.saInteractionInitialized = 'true';

  const worldViewport = world.querySelector('.sa-world-viewport');
  const heroScroll = world.querySelector('.sa-hero-scroll');
  const selectedCard = hero.querySelector('.sa-category-card.is-selected');
  const desktopMouse = window.matchMedia('(min-width: 801px) and (hover: hover) and (pointer: fine)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const recoilDuration = 120;
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const current = { aimX: 0, aimY: 0, gunX: 0, gunY: 0, angle: 0 };
  let enabled = false;
  let scrollEnabled = false;
  let inside = false;
  let showDefault = false;
  let hasPointer = false;
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
    // Re-entry starts at the new position, never at the default/previous aim.
    if (!inside) positioned = false;
    pointer = { x: event.clientX, y: event.clientY };
    hasPointer = true;
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
    const scrollBounds = heroScroll?.getBoundingClientRect();
    const viewportHeight = Math.max(window.innerHeight || bounds.height, 1);
    const viewportWidth = Math.max(window.innerWidth || bounds.width, 1);
    // Content must fit before pinning; short windows and zoomed text keep native flow.
    const canScroll = Boolean(enabled && !reduce && scrollBounds && bounds.height <= viewportHeight + 1);
    const scrollModeChanged = scrollEnabled !== canScroll;
    const heroScrollDistance = scrollBounds ? Math.max(scrollBounds.height - bounds.height, 0) : 0;
    const progress = canScroll && heroScrollDistance > 0 ? clamp(-scrollBounds.top / heroScrollDistance, 0, 1) : 0;
    // Hold the opening pose briefly, then ease both ends of the transition.
    const transition = clamp((progress - 0.1) / 0.9, 0, 1);
    const uiTransition = transition * transition * (3 - 2 * transition);
    const travel = worldBounds ? clamp(-worldBounds.top, 0, Math.max(worldBounds.height - viewportHeight, 0)) : 0;
    const farY = reduce ? 0 : -Math.min(travel * 0.06, viewportHeight * 0.02);
    const fieldY = reduce ? 0 : -Math.min(travel * 0.16, viewportHeight * 0.045);
    if (inside && pointer && (pointer.x < 0 || pointer.x > viewportWidth ||
      pointer.y < 0 || pointer.y > viewportHeight)) {
      inside = false;
      showDefault = false;
      pointer = null;
      positioned = false;
      pendingRecoil = false;
      recoilStart = null;
    }
    let targetAimX = current.aimX;
    let targetAimY = current.aimY;
    if (!positioned && (inside || showDefault)) {
      const card = !inside ? selectedCard?.getBoundingClientRect() : null;
      current.aimX = pointer ? pointer.x : card ? card.left + card.width / 2 : viewportWidth / 2;
      current.aimY = pointer ? pointer.y : card ? card.top + card.height / 2 : viewportHeight / 2;
      if (!inside && (current.aimY < 0 || current.aimY > viewportHeight)) showDefault = false;
      targetAimX = current.aimX;
      targetAimY = current.aimY;
      positioned = true;
    }
    if (inside && pointer) {
      targetAimX = clamp(pointer.x, 0, viewportWidth);
      targetAimY = clamp(pointer.y, 0, viewportHeight);
    }
    const aimVisible = enabled && (inside || showDefault) &&
      worldBounds.top + worldBounds.height > 0 && worldBounds.top < viewportHeight;
    const moveGun = enabled && inside && !reduce;
    // Viewport coordinates keep the same gun pose as hero and posts scroll past.
    const nx = moveGun ? clamp(targetAimX / viewportWidth * 2 - 1, -1, 1) : 0;
    const ny = moveGun ? clamp(targetAimY / viewportHeight * 2 - 1, -1, 1) : 0;
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

    world.classList.toggle('sa-interaction-enabled', enabled);
    scrollEnabled = canScroll;
    world.classList.toggle('sa-scroll-enabled', scrollEnabled);
    world.style.setProperty('--scroll-progress', progress.toFixed(4));
    world.style.setProperty('--rifle-scroll-y', '0px');
    world.style.setProperty('--rifle-scroll-scale', '1');
    world.style.setProperty('--ui-opacity', (1 - 0.75 * uiTransition).toFixed(4));
    world.style.setProperty('--aim-progress', '0');
    world.classList.toggle('sa-aim-visible', aimVisible);
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

    // Changing the sticky mode changes its wrapper height; measure it next frame.
    if (unsettled || recoilStart !== null || scrollModeChanged) schedule();
    else lastTime = null;
  }

  const configure = () => {
    enabled = desktopMouse.matches && (navigator.maxTouchPoints || 0) === 0;
    inside = false;
    showDefault = enabled && !hasPointer;
    pointer = null;
    positioned = false;
    pendingRecoil = false;
    recoilStart = null;
    lastTime = null;
    schedule();
  };

  world.addEventListener('pointerenter', recordPointer, { passive: true });
  world.addEventListener('pointermove', recordPointer, { passive: true });
  world.addEventListener('pointerleave', leave, { passive: true });
  world.addEventListener('pointercancel', leave, { passive: true });
  world.addEventListener('pointerdown', (event) => {
    recordPointer(event);
    positioned = false;
    if (enabled && event.pointerType === 'mouse' && event.button === 0 && !reducedMotion.matches) {
      pendingRecoil = true;
      schedule();
    }
    // Native anchor navigation is never prevented or delayed.
  }, { passive: true });
  world.addEventListener('focusin', () => {
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
