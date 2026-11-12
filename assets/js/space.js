(() => {
  'use strict';
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  const hero = document.querySelector('.sa-hero');
  const meteor = document.querySelector('.sa-shooting-star');
  let meteorTimer;
  let frame = 0;
  let visible = true;

  function scheduleMeteor() {
    window.clearTimeout(meteorTimer);
    if (!meteor || motion.matches || document.hidden || !visible) return;
    meteorTimer = window.setTimeout(() => {
      meteor.classList.remove('sa-shoot');
      // A frame between removals lets the same CSS animation restart.
      window.requestAnimationFrame(() => {
        if (!motion.matches && !document.hidden && visible) meteor.classList.add('sa-shoot');
      });
      scheduleMeteor();
    }, 10000 + Math.random() * 10000);
  }

  function updateParallax() {
    frame = 0;
    if (!hero || motion.matches || !visible) return;
    const offset = Math.max(-12, Math.min(12, -hero.getBoundingClientRect().top * 0.035));
    hero.style.setProperty('--sa-parallax', `${offset}px`);
  }

  function onScroll() {
    if (!motion.matches && visible && !frame) frame = window.requestAnimationFrame(updateParallax);
  }

  function onMotionChange() {
    if (motion.matches) {
      root.classList.remove('sa-intro-active');
      if (hero) hero.style.removeProperty('--sa-parallax');
      if (meteor) meteor.classList.remove('sa-shoot');
    }
    scheduleMeteor();
  }

  // CSS also dismisses the intro, even if this file fails to load.
  const intro = document.querySelector('.sa-intro');
  if (intro) intro.addEventListener('animationend', (event) => {
    if (event.target === intro) root.classList.remove('sa-intro-active');
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) root.classList.remove('sa-intro-active');
  });
  if (motion.addEventListener) motion.addEventListener('change', onMotionChange);
  if (hero) {
    window.addEventListener('scroll', onScroll, { passive: true });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        hero.classList.toggle('sa-offscreen', !visible);
        scheduleMeteor();
      }).observe(hero);
    }
    document.addEventListener('visibilitychange', scheduleMeteor);
    scheduleMeteor();
  }
})();
