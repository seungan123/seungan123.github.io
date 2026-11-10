// Run with: node tools/test-home-theme.cjs (no dependencies required).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../assets/js/sa-home-theme.js'), 'utf8');
const parts = ['dawn', 'day', 'evening', 'night'];
const versions = ['ver1', 'ver2'];
const tick = () => new Promise((resolve) => setImmediate(resolve));

function setup({ at = '2026-11-11T12:00:00+09:00', saved = null, savedVersion = null, preview, storageBlocked = false, deferred, failed, failedRifle } = {}) {
  let now = Date.parse(at), decodeCount = 0;
  const events = () => ({ listeners: {}, addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }, emit(name, value) { for (const fn of this.listeners[name] || []) fn(value); } });
  const element = (dataset = {}) => ({ ...events(), dataset, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; }, focus() { this.focused = true; } });
  const root = { dataset: { homeVersion: 'ver1', ...(preview ? { scenePreview: preview } : {}) }, hasAttribute: (name) => name === 'data-scene-ready' && 'sceneReady' in root.dataset };
  const status = { textContent: '' }, button = element(), panel = { ...element(), hidden: true };
  const versionButtons = versions.map((v) => element({ homeChoice: v }));
  const timeButtons = ['auto', ...parts].map((v) => element({ timeChoice: v }));
  const wrap = { ...element(), contains: (target) => [button, panel, ...versionButtons, ...timeButtons].includes(target) };
  let resolveDecode;
  const delayed = new Promise((resolve) => { resolveDecode = resolve; });
  const image = (key, broken) => ({ complete: true, naturalWidth: broken ? 0 : 1672,
    decode() { decodeCount++; return key === deferred ? delayed : Promise.resolve(); } });
  const scenes = versions.flatMap((version) => parts.map((part) => {
    const key = `${version}:${part}`;
    const imgs = [image(key, failed === key), image(key, failed === key)];
    return { dataset: { version, scene: part }, querySelectorAll: () => imgs };
  }));
  const rifles = versions.map((version) => ({ ...image(`${version}:rifle`, failedRifle === version), dataset: { rifleVersion: version } }));
  const preloads = versions.flatMap((version) => parts.map((part) => ({ dataset: { version, scenePreload: part } })));
  const doc = { ...events(), documentElement: root, hidden: false, readyState: 'loading',
    querySelectorAll: (s) => ({ '[data-scene]': scenes, '[data-rifle-version]': rifles, '[data-scene-preload]': preloads, '[data-home-choice]': versionButtons, '[data-time-choice]': timeButtons })[s],
    querySelector: (s) => ({ '.sa-settings': button, '.sa-settings-wrap': wrap, '#sa-settings-panel': panel, '#sa-theme-status': status })[s] };
  const win = events(), timers = new Map(), rafs = [];
  let nextTimer = 0;
  const storage = { values: { 'sa-home-scene-mode': saved, 'sa-home-design-version': savedVersion },
    getItem(key) { if (storageBlocked) throw Error('blocked'); return this.values[key] ?? null; },
    setItem(key, value) { if (storageBlocked) throw Error('blocked'); this.values[key] = value; } };
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const context = vm.createContext({ document: doc, window: win, localStorage: storage, Intl, Date: Clock,
    requestAnimationFrame: (fn) => rafs.push(fn),
    setTimeout(fn, delay) { const id = ++nextTimer; timers.set(id, { fn, delay }); return id; }, clearTimeout: (id) => timers.delete(id) });
  const load = () => vm.runInContext(source, context);
  const flush = async () => { await tick(); while (rafs.length) rafs.shift()(); await tick(); };
  const boot = async () => { doc.emit('DOMContentLoaded'); await flush(); };
  load();
  return { root, button, panel, wrap, doc, win, storage, status, timers, preloads, load, flush, boot, resolveDecode, versionButtons, timeButtons,
    chooseTime: (part) => timeButtons.find((b) => b.dataset.timeChoice === part).emit('click'),
    chooseVersion: (version) => versionButtons.find((b) => b.dataset.homeChoice === version).emit('click'),
    setTime: (time) => { now = Date.parse(time); }, decodes: () => decodeCount,
    runTimer() { const [id, task] = timers.entries().next().value; timers.delete(id); task.fn(); } };
}

(async () => {
  for (const [time, expected] of [
    ['00:00:00', 'night'], ['04:59:59', 'night'], ['05:00:00', 'dawn'], ['08:59:59', 'dawn'],
    ['09:00:00', 'day'], ['16:59:59', 'day'], ['17:00:00', 'evening'], ['19:59:59', 'evening'], ['20:00:00', 'night'], ['23:59:59', 'night']
  ]) {
    const h = setup({ at: `2026-11-11T${time}+09:00` });
    assert.equal(h.root.dataset.daypart, expected, `${time} Seoul before paint`);
    assert.equal(h.preloads.filter((l) => l.fetchPriority === 'high').length, 1);
    assert.equal(h.preloads.find((l) => l.fetchPriority === 'high').dataset.scenePreload, expected);
  }
  assert.equal(setup({ at: '2026-11-10T20:00:00Z' }).root.dataset.daypart, 'dawn');
  for (const saved of parts) assert.equal(setup({ saved }).root.dataset.daypart, saved);
  assert.equal(setup({ saved: 'invalid', savedVersion: 'invalid' }).root.dataset.themeMode, 'auto');
  assert.equal(setup({ savedVersion: 'invalid' }).root.dataset.homeVersion, 'ver1');
  assert.equal(setup({ savedVersion: 'ver2', saved: 'night' }).root.dataset.homeVersion, 'ver2', 'Stored design is restored before paint');
  assert.equal(setup({ preview: 'evening' }).root.dataset.daypart, 'evening');
  assert.equal(setup({ preview: 'evening', saved: 'day' }).root.dataset.daypart, 'day');

  const h = setup(); await h.boot();
  assert.equal(h.decodes(), 18, 'Eight scenes and both independent rifles decode in advance');
  assert.equal(h.root.dataset.sceneReady, 'true'); assert.equal(h.button.disabled, false);
  h.button.emit('click'); assert.equal(h.panel.hidden, false); assert.equal(h.root.dataset.themeMode, 'auto', 'Opening settings never changes theme');
  for (const expected of ['dawn', 'day', 'evening', 'night', 'auto']) {
    h.chooseTime(expected); await h.flush();
    assert.equal(h.root.dataset.themeMode, expected); assert.equal(h.storage.values['sa-home-scene-mode'], expected);
    assert.equal(h.root.dataset.daypart, expected === 'auto' ? 'day' : expected);
  }
  h.chooseTime('night'); h.chooseVersion('ver2'); await h.flush();
  assert.equal(h.root.dataset.homeVersion, 'ver2'); assert.equal(h.root.dataset.daypart, 'night', 'Version switch preserves selected time');
  assert.equal(h.storage.values['sa-home-design-version'], 'ver2');
  assert.equal(h.versionButtons[1].attributes['aria-pressed'], 'true');
  h.load(); assert.equal(h.button.listeners.click.length, 1); assert.equal(h.timers.size, 1);
  let prevented = false;
  h.wrap.emit('keydown', { key: 'Escape', preventDefault() { prevented = true; } });
  assert.ok(h.panel.hidden && h.button.focused && prevented, 'Escape closes disclosure and returns focus');
  h.button.emit('click'); h.doc.emit('pointerdown', { target: h.timeButtons[0] }); assert.equal(h.panel.hidden, false);
  h.doc.emit('pointerdown', { target: {} }); assert.equal(h.panel.hidden, true);
  h.button.emit('click'); h.wrap.emit('focusout', { relatedTarget: {} }); assert.equal(h.panel.hidden, true);

  const rapid = setup({ deferred: 'ver2:day' }); await rapid.boot();
  rapid.chooseVersion('ver2'); await rapid.flush(); assert.equal(rapid.root.dataset.homeVersion, 'ver1', 'Keep previous art and CSS while decoding');
  rapid.chooseVersion('ver1'); rapid.chooseTime('night'); await rapid.flush();
  rapid.resolveDecode(); await rapid.flush();
  assert.equal(rapid.root.dataset.homeVersion, 'ver1'); assert.equal(rapid.root.dataset.daypart, 'night', 'Late image cannot override a newer choice');
  for (const options of [{ failed: 'ver2:day' }, { failedRifle: 'ver2' }]) {
    const broken = setup(options); await broken.boot(); broken.chooseVersion('ver2'); await broken.flush();
    assert.equal(broken.root.dataset.homeVersion, 'ver1', 'Scene or rifle failure retains complete previous design');
    assert.match(broken.status.textContent, /로드 실패/); assert.equal(broken.panel.attributes['aria-busy'], 'false');
  }
  const initialFailure = setup({ saved: 'night', failed: 'ver1:night' }); await initialFailure.boot();
  assert.equal(initialFailure.root.dataset.daypart, 'evening');
  const blocked = setup({ storageBlocked: true }); await blocked.boot(); blocked.chooseTime('dawn'); blocked.chooseVersion('ver2'); await blocked.flush();
  assert.equal(blocked.root.dataset.daypart, 'dawn'); assert.equal(blocked.root.dataset.homeVersion, 'ver2');

  const clock = setup({ at: '2026-11-11T08:59:59.500+09:00' }); await clock.boot();
  assert.equal([...clock.timers.values()][0].delay, 500);
  clock.setTime('2026-11-11T09:00:00+09:00'); clock.runTimer(); await clock.flush(); assert.equal(clock.root.dataset.daypart, 'day');
  clock.doc.hidden = true; clock.doc.emit('visibilitychange'); assert.equal(clock.timers.size, 0);
  clock.setTime('2026-11-11T20:00:00+09:00'); clock.doc.hidden = false; clock.doc.emit('visibilitychange'); await clock.flush(); assert.equal(clock.root.dataset.daypart, 'night');
  clock.chooseTime('dawn'); await clock.flush(); clock.setTime('2026-11-12T12:00:00+09:00'); clock.runTimer(); await clock.flush(); assert.equal(clock.root.dataset.daypart, 'dawn');
  clock.win.emit('storage', { key: 'sa-home-design-version', newValue: 'ver2' }); await clock.flush();
  assert.equal(clock.root.dataset.homeVersion, 'ver2'); assert.equal(clock.root.dataset.themeMode, 'dawn');
  clock.win.emit('storage', { key: 'sa-home-scene-mode', newValue: 'evening' }); await clock.flush(); assert.equal(clock.root.dataset.daypart, 'evening');
  clock.win.emit('storage', { key: null, newValue: null }); await clock.flush();
  assert.equal(clock.root.dataset.themeMode, 'auto'); assert.equal(clock.root.dataset.daypart, 'day'); assert.equal(clock.root.dataset.homeVersion, 'ver1');
  clock.win.emit('pagehide'); assert.equal(clock.timers.size, 0);
  clock.win.emit('pageshow'); await clock.flush(); assert.equal(clock.timers.size, 1);
  console.log('PASS: both designs, persisted settings, keyboard/outside dismissal, Seoul boundaries, preload races/failures, storage failures and clock lifecycle.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
