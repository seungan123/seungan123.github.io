// Run with: node tools/test-home-theme.cjs (no dependencies required).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../assets/js/sa-home-theme.js'), 'utf8');
const parts = ['dawn', 'day', 'evening', 'night'];
const tick = () => new Promise((resolve) => setImmediate(resolve));

function setup({ at = '2026-11-11T12:00:00+09:00', saved = null, storageBlocked = false, deferred = null, failed = null } = {}) {
  let now = Date.parse(at);
  let decodeCount = 0;
  const events = () => ({ listeners: {}, addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }, emit(name, value) { for (const fn of this.listeners[name] || []) fn(value); } });
  const root = { dataset: {}, hasAttribute: (name) => name === 'data-scene-ready' && 'sceneReady' in root.dataset };
  const tooltip = { textContent: '' };
  const status = { textContent: '' };
  const button = { ...events(), disabled: true, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; }, querySelector: () => tooltip };
  let resolveDecode;
  const delayed = new Promise((resolve) => { resolveDecode = resolve; });
  const scenes = parts.map((part) => ({
    dataset: { scene: part },
    querySelectorAll: () => [0, 1].map(() => ({
      complete: true, naturalWidth: failed === part ? 0 : 1672,
      decode() { decodeCount++; return part === deferred ? delayed : Promise.resolve(); }
    }))
  }));
  const preloads = parts.map((part) => ({ dataset: { scenePreload: part } }));
  const doc = { ...events(), documentElement: root, hidden: false, readyState: 'loading',
    querySelectorAll: (s) => s === '[data-scene]' ? scenes : preloads,
    querySelector: (s) => s === '.sa-settings' ? button : status };
  const win = events();
  const timers = new Map();
  const rafs = [];
  let nextTimer = 0;
  const storage = { value: saved, getItem() { if (storageBlocked) throw Error('blocked'); return this.value; }, setItem(key, value) { if (storageBlocked) throw Error('blocked'); assert.equal(key, 'sa-home-scene-mode'); this.value = value; } };
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const context = vm.createContext({ document: doc, window: win, localStorage: storage, Intl, Date: Clock,
    requestAnimationFrame: (fn) => rafs.push(fn),
    setTimeout(fn, delay) { const id = ++nextTimer; timers.set(id, { fn, delay }); return id; },
    clearTimeout: (id) => timers.delete(id) });
  const load = () => vm.runInContext(source, context);
  const flush = async () => { await tick(); while (rafs.length) rafs.shift()(); await tick(); };
  const boot = async () => { doc.emit('DOMContentLoaded'); await flush(); };
  load();
  return { root, button, doc, win, storage, status, timers, preloads, load, flush, boot, resolveDecode,
    setTime: (time) => { now = Date.parse(time); }, decodes: () => decodeCount,
    runTimer() { const [id, task] = timers.entries().next().value; timers.delete(id); task.fn(); } };
}

(async () => {
  // Explicit Seoul timestamps exercise the actual Intl conversion, not a mocked hour.
  for (const [time, expected] of [
    ['00:00:00', 'night'], ['04:59:59', 'night'], ['05:00:00', 'dawn'],
    ['08:59:59', 'dawn'], ['09:00:00', 'day'], ['16:59:59', 'day'],
    ['17:00:00', 'evening'], ['19:59:59', 'evening'], ['20:00:00', 'night'], ['23:59:59', 'night']
  ]) {
    const h = setup({ at: `2026-11-11T${time}+09:00` });
    assert.equal(h.root.dataset.daypart, expected, `${time} Seoul must select ${expected} before DOM paint`);
    assert.equal(h.preloads.find((link) => link.dataset.scenePreload === expected).fetchPriority, 'high');
  }
  const utc = setup({ at: '2026-11-10T20:00:00Z' });
  assert.equal(utc.root.dataset.daypart, 'dawn', 'UTC previous date must still use Seoul 05:00');
  for (const saved of parts) assert.equal(setup({ saved }).root.dataset.daypart, saved, 'Saved preview overrides time before paint');
  assert.equal(setup({ saved: 'invalid' }).root.dataset.themeMode, 'auto');

  const h = setup();
  await h.boot();
  assert.equal(h.decodes(), 8, 'Both parallax images of all four scenes must be decoded in advance');
  assert.equal(h.root.dataset.sceneReady, 'true');
  assert.equal(h.button.disabled, false);
  for (const expected of ['dawn', 'day', 'evening', 'night', 'auto']) {
    h.button.emit('click');
    await h.flush();
    assert.equal(h.root.dataset.themeMode, expected);
    assert.equal(h.storage.value, expected);
    assert.equal(h.root.dataset.daypart, expected === 'auto' ? 'day' : expected);
  }
  h.load();
  assert.equal(h.button.listeners.click.length, 1, 'Repeated script execution must not duplicate handlers');
  assert.equal(h.timers.size, 1);

  const rapid = setup({ deferred: 'dawn' });
  await rapid.boot();
  rapid.button.emit('click');
  await rapid.flush();
  assert.equal(rapid.root.dataset.daypart, 'day', 'Keep decoded background while next image is pending');
  rapid.button.emit('click'); rapid.button.emit('click'); rapid.button.emit('click');
  await rapid.flush();
  assert.equal(rapid.root.dataset.daypart, 'night');
  rapid.resolveDecode(); await rapid.flush();
  assert.equal(rapid.root.dataset.daypart, 'night', 'Late preload must not replace a newer preview');

  const failure = setup({ failed: 'dawn' });
  await failure.boot();
  failure.button.emit('click'); await failure.flush();
  assert.equal(failure.root.dataset.daypart, 'day', 'Failed load keeps the previous image visible');
  assert.match(failure.status.textContent, /로드 실패/);
  const initialFailure = setup({ saved: 'night', failed: 'night' });
  await initialFailure.boot();
  assert.equal(initialFailure.root.dataset.daypart, 'evening', 'A missing initial scene falls back to the existing evening');

  const blocked = setup({ storageBlocked: true });
  await blocked.boot(); blocked.button.emit('click'); await blocked.flush();
  assert.equal(blocked.root.dataset.daypart, 'dawn', 'Blocked localStorage must not break previews');

  const clock = setup({ at: '2026-11-11T08:59:59.500+09:00' });
  await clock.boot();
  assert.equal([...clock.timers.values()][0].delay, 500);
  clock.setTime('2026-11-11T09:00:00+09:00'); clock.runTimer(); await clock.flush();
  assert.equal(clock.root.dataset.daypart, 'day');
  clock.doc.hidden = true; clock.doc.emit('visibilitychange');
  assert.equal(clock.timers.size, 0, 'Hidden tabs must not poll');
  clock.setTime('2026-11-11T20:00:00+09:00'); clock.doc.hidden = false; clock.doc.emit('visibilitychange'); await clock.flush();
  assert.equal(clock.root.dataset.daypart, 'night', 'Returning to a tab must refresh Seoul time');
  clock.button.emit('click'); await clock.flush();
  clock.setTime('2026-11-12T12:00:00+09:00'); clock.runTimer(); await clock.flush();
  assert.equal(clock.root.dataset.daypart, 'dawn', 'Timer cannot override a manual preview');
  clock.win.emit('storage', { key: 'sa-home-scene-mode', newValue: 'evening' }); await clock.flush();
  assert.equal(clock.root.dataset.daypart, 'evening');
  clock.win.emit('storage', { key: null, newValue: null }); await clock.flush();
  assert.equal(clock.root.dataset.themeMode, 'auto');
  assert.equal(clock.root.dataset.daypart, 'day');
  clock.win.emit('pagehide'); assert.equal(clock.timers.size, 0);
  clock.win.emit('pageshow'); await clock.flush(); assert.equal(clock.timers.size, 1);
  console.log('PASS: Seoul boundaries, initial paint, persisted cycle, preloading, rapid switches, image/storage failures, automatic updates and lifecycle.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
