(() => {
  'use strict';
  const root = document.documentElement;
  if (root.dataset.saThemeInitialized) return;
  root.dataset.saThemeInitialized = 'true';
  const storageKey = 'sa-home-scene-mode';
  const versionKey = 'sa-home-design-version';
  const modes = ['auto', 'dawn', 'day', 'evening', 'night'];
  const versions = ['ver1', 'ver2'];
  const labels = { auto: '자동', dawn: '새벽', day: '낮', evening: '저녁', night: '밤' };
  const validMode = (value) => modes.includes(value) ? value : 'auto';
  const validVersion = (value) => versions.includes(value) ? value : 'ver1';
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
  let mode = validMode(root.dataset.scenePreview);
  let version = 'ver1';
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved !== null) mode = validMode(saved);
    version = validVersion(localStorage.getItem(versionKey));
  } catch { /* Private/storage-disabled browsing still works. */ }

  // Restore both choices before CSS paints, including the saved design's typography.
  root.dataset.homeVersion = version;
  root.dataset.themeMode = mode;
  root.dataset.daypart = mode === 'auto' ? automaticPart() : mode;
  for (const link of document.querySelectorAll('[data-scene-preload]')) {
    link.fetchPriority = link.dataset.version === version && link.dataset.scenePreload === root.dataset.daypart ? 'high' : 'low';
  }

  const initialize = () => {
    const button = document.querySelector('.sa-version-toggle');
    const timeButton = document.querySelector('.sa-time-toggle');
    const status = document.querySelector('#sa-theme-status');
    const scenes = new Map([...document.querySelectorAll('[data-scene]')].map((scene) => [`${scene.dataset.version}:${scene.dataset.scene}`, scene]));
    const rifles = new Map([...document.querySelectorAll('[data-rifle-version]')].map((img) => [img.dataset.rifleVersion, img]));
    if (!button || !timeButton || !status || scenes.size !== 8 || rifles.size !== 2) return;
    let revision = 0;
    let displayed = false;
    let timer = null;
    const loading = new Map();
    const images = new WeakMap();

    const decode = (img) => {
      if (images.has(img)) return images.get(img);
      const promise = new Promise((resolve, reject) => {
        if (img.complete) {
          if (img.naturalWidth) resolve();
          else reject(new Error('Scene image unavailable'));
          return;
        }
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', reject, { once: true });
      }).then(() => typeof img.decode === 'function' ? img.decode() : undefined);
      images.set(img, promise);
      promise.catch(() => images.delete(img));
      return promise;
    };
    const preload = (design, part) => {
      const key = `${design}:${part}`;
      if (loading.has(key)) return loading.get(key);
      const promise = Promise.all([...scenes.get(key).querySelectorAll('img'), rifles.get(design)].map(decode));
      loading.set(key, promise);
      promise.catch(() => loading.delete(key));
      return promise;
    };
    const describe = (suffix = '') => {
      const selected = mode === 'auto' ? `자동 · 서울 ${labels[root.dataset.daypart]}` : `${labels[mode]} 미리보기`;
      const nextVersion = versions[(versions.indexOf(version) + 1) % versions.length];
      const nextMode = modes[(modes.indexOf(mode) + 1) % modes.length];
      button.title = `디자인: ${root.dataset.homeVersion} · 클릭하면 ${nextVersion}`;
      button.setAttribute('aria-label', button.title);
      timeButton.title = `시간대: ${selected} · 클릭하면 ${labels[nextMode]}`;
      timeButton.setAttribute('aria-label', timeButton.title);
      status.textContent = `${root.dataset.homeVersion} · ${selected}${suffix}`;
    };
    const apply = async () => {
      const request = ++revision;
      const design = version;
      const part = mode === 'auto' ? automaticPart() : mode;
      root.dataset.themeMode = mode;
      describe();
      try {
        await preload(design, part);
        if (request !== revision) return;
        // Switch art and CSS together only after the scene and rifle have decoded.
        root.dataset.homeVersion = design;
        root.dataset.daypart = part;
        displayed = true;
        describe();
        if (!root.hasAttribute('data-scene-ready')) {
          requestAnimationFrame(() => requestAnimationFrame(() => { root.dataset.sceneReady = 'true'; }));
        }
      } catch {
        if (request !== revision) return;
        if (!displayed) {
          try {
            await preload(design, 'evening');
            if (request !== revision) return;
            root.dataset.homeVersion = design;
            root.dataset.daypart = 'evening';
            displayed = true;
          } catch { /* The selected solid sky color remains as the last fallback. */ }
        }
        describe(' · 이미지 로드 실패');
      }
    };
    const save = (key, value) => {
      try { localStorage.setItem(key, value); } catch { /* Keep choices in memory. */ }
    };
    const scheduleClock = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      if (document.hidden) return;
      timer = setTimeout(() => {
        timer = null;
        if (mode === 'auto') void apply();
        scheduleClock();
      }, 60000 - (Date.now() % 60000));
    };

    button.disabled = false;
    timeButton.disabled = false;
    button.addEventListener('click', () => {
      version = versions[(versions.indexOf(version) + 1) % versions.length];
      save(versionKey, version);
      void apply();
    });
    timeButton.addEventListener('click', () => {
      mode = modes[(modes.indexOf(mode) + 1) % modes.length];
      save(storageKey, mode);
      void apply();
    });
    window.addEventListener('storage', (event) => {
      if (event.key !== storageKey && event.key !== versionKey && event.key !== null) return;
      if (event.key === storageKey || event.key === null) mode = validMode(event.newValue);
      if (event.key === versionKey || event.key === null) version = validVersion(event.newValue);
      void apply();
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && mode === 'auto') void apply();
      scheduleClock();
    });
    window.addEventListener('pagehide', () => { clearTimeout(timer); timer = null; });
    window.addEventListener('pageshow', () => { if (mode === 'auto') void apply(); scheduleClock(); });
    // Preload every daypart of both designs without changing the interaction loop.
    for (const design of versions) for (const part of modes.slice(1)) void preload(design, part).catch(() => {});
    void apply();
    scheduleClock();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
