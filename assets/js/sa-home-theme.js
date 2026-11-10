(() => {
  'use strict';

  const root = document.documentElement;
  if (root.dataset.saThemeInitialized) return;
  root.dataset.saThemeInitialized = 'true';
  const storageKey = 'sa-home-scene-mode';
  const modes = ['auto', 'dawn', 'day', 'evening', 'night'];
  const labels = { auto: '자동', dawn: '새벽', day: '낮', evening: '저녁', night: '밤' };
  const validMode = (value) => modes.includes(value) ? value : 'auto';
  const seoulHour = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul', hour: '2-digit', hourCycle: 'h23'
  });
  const automaticPart = () => {
    const hour = Number(seoulHour.format(new Date()));
    if (hour >= 5 && hour < 9) return 'dawn';
    if (hour >= 9 && hour < 17) return 'day';
    if (hour >= 17 && hour < 20) return 'evening';
    return 'night';
  };
  let mode = 'auto';
  try { mode = validMode(localStorage.getItem(storageKey)); } catch { /* Private/storage-disabled browsing still works. */ }

  // Runs in the head before CSS paints: no evening flash on a saved night theme.
  root.dataset.themeMode = mode;
  root.dataset.daypart = mode === 'auto' ? automaticPart() : mode;
  for (const link of document.querySelectorAll('[data-scene-preload]')) {
    link.fetchPriority = link.dataset.scenePreload === root.dataset.daypart ? 'high' : 'low';
  }

  const initialize = () => {
    const button = document.querySelector('.sa-settings');
    const status = document.querySelector('#sa-theme-status');
    const tooltip = button?.querySelector('.sa-theme-tooltip');
    const scenes = new Map([...document.querySelectorAll('[data-scene]')].map((scene) => [scene.dataset.scene, scene]));
    if (!button || !status || scenes.size !== 4) return;
    let revision = 0;
    let displayed = null;
    let timer = null;
    const loading = new Map();

    const preload = (part) => {
      if (loading.has(part)) return loading.get(part);
      const promise = Promise.all([...scenes.get(part).querySelectorAll('img')].map((img) => {
        const loaded = new Promise((resolve, reject) => {
          if (img.complete) {
            if (img.naturalWidth) resolve();
            else reject(new Error('Scene image unavailable'));
            return;
          }
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', reject, { once: true });
        });
        return loaded.then(() => typeof img.decode === 'function' ? img.decode() : undefined);
      }));
      loading.set(part, promise);
      promise.catch(() => loading.delete(part));
      return promise;
    };

    const describe = (suffix = '') => {
      const next = modes[(modes.indexOf(mode) + 1) % modes.length];
      const selected = mode === 'auto' ? `자동 · 서울 ${labels[root.dataset.daypart]}` : `${labels[mode]} 미리보기`;
      const text = `${selected}${suffix}`;
      button.setAttribute('aria-label', `시간대 설정: ${text}. 다음: ${labels[next]}`);
      button.title = `${text} — 클릭하면 ${labels[next]}`;
      if (tooltip) tooltip.textContent = text;
      status.textContent = text;
    };

    const apply = async () => {
      const request = ++revision;
      const part = mode === 'auto' ? automaticPart() : mode;
      root.dataset.themeMode = mode;
      describe();
      try {
        await preload(part);
        if (request !== revision) return;
        root.dataset.daypart = part;
        displayed = part;
        describe();
        // Initial selection is painted directly, subsequent changes crossfade.
        if (!root.hasAttribute('data-scene-ready')) {
          requestAnimationFrame(() => requestAnimationFrame(() => { root.dataset.sceneReady = 'true'; }));
        }
      } catch {
        if (request !== revision) return;
        // Keep the last decoded scene on a network failure, never blank it out.
        if (!displayed) {
          try {
            await preload('evening');
            if (request !== revision) return;
            root.dataset.daypart = 'evening';
            displayed = 'evening';
          } catch { /* The selected solid sky color remains as the last fallback. */ }
        }
        describe(' · 이미지 로드 실패');
      }
    };

    const scheduleClock = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      if (document.hidden) return;
      // Check at minute boundaries, including a tab left open across a daypart.
      timer = setTimeout(() => {
        timer = null;
        if (mode === 'auto') void apply();
        scheduleClock();
      }, 60000 - (Date.now() % 60000));
    };

    button.disabled = false;
    button.addEventListener('click', () => {
      mode = modes[(modes.indexOf(mode) + 1) % modes.length];
      try { localStorage.setItem(storageKey, mode); } catch { /* Keep the current preview in memory. */ }
      void apply();
    });
    window.addEventListener('storage', (event) => {
      if (event.key !== storageKey && event.key !== null) return;
      mode = validMode(event.newValue);
      void apply();
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && mode === 'auto') void apply();
      scheduleClock();
    });
    window.addEventListener('pagehide', () => { clearTimeout(timer); timer = null; });
    window.addEventListener('pageshow', () => { if (mode === 'auto') void apply(); scheduleClock(); });
    // All four sources are requested by preload links and decoded before switching.
    for (const part of scenes.keys()) void preload(part).catch(() => {});
    void apply();
    scheduleClock();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
