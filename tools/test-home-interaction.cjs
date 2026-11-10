// Run with: node tools/test-home-interaction.cjs (no dependencies required).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../assets/js/sa-home.js'), 'utf8');

function setup({ desktop = true, reduce = false, touchPoints = 0 } = {}) {
  let writes = 0;
  let reads = 0;
  let clock = 0;
  let nextFrame = 1;
  const queue = new Map();
  const emitter = () => ({
    listeners: {},
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
    emit(type, event = {}) { for (const fn of this.listeners[type] || []) fn(event); }
  });
  const element = (rect) => ({
    ...emitter(), dataset: {}, values: {}, classes: new Set(),
    getBoundingClientRect() { reads++; return rect; },
    style: { setProperty(name, value) { writes++; this.owner.values[name] = value; } },
    classList: { toggle(name, on) { writes++; this.owner.classes[on ? 'add' : 'delete'](name); } }
  });
  const hero = element({ left: 100, top: 50, width: 1000, height: 600 });
  const aim = element({});
  const rifle = element({});
  const card = element({ left: 400, top: 200, width: 200, height: 100 });
  for (const el of [hero, aim, rifle, card]) {
    el.style.owner = el;
    el.classList.owner = el;
  }
  hero.querySelector = (s) => ({ '.sa-aim': aim, '.sa-rifle': rifle, '.sa-category-card.is-selected': card })[s];
  const desktopMedia = { ...emitter(), matches: desktop };
  const reducedMedia = { ...emitter(), matches: reduce };
  const win = { ...emitter(), matchMedia: (q) => q.includes('reduced-motion') ? reducedMedia : desktopMedia };
  const doc = { ...emitter(), hidden: false, activeElement: null, querySelector: () => hero };
  const context = vm.createContext({
    window: win, document: doc, navigator: { maxTouchPoints: touchPoints },
    requestAnimationFrame(fn) { const id = nextFrame++; queue.set(id, fn); return id; },
    cancelAnimationFrame(id) { queue.delete(id); }
  });
  const load = () => vm.runInContext(source, context);
  const step = (ms = 1000 / 60) => {
    clock += ms;
    const callbacks = [...queue.values()];
    queue.clear();
    for (const fn of callbacks) fn(clock);
  };
  const settle = () => {
    let frames = 0;
    while (queue.size && frames++ < 300) step();
    assert.equal(queue.size, 0, 'RAF must stop once settled');
  };
  const mouse = (x, y, extra = {}) => ({ pointerType: 'mouse', clientX: x, clientY: y, button: 0, ...extra });
  const value = (el, key) => parseFloat(el.values[key]);
  const listenCount = () => [hero, win, doc, desktopMedia, reducedMedia].reduce((n, e) => n + Object.values(e.listeners).flat().length, 0);
  load();
  settle();
  return { hero, aim, rifle, win, doc, desktopMedia, reducedMedia, queue, load, step, settle, mouse, value, listenCount, counts: () => ({ reads, writes }) };
}

const h = setup();
assert.equal(h.value(h.aim, '--sa-aim-x'), 400, 'Initial aim must center on CTF card');
assert.equal(h.value(h.aim, '--sa-aim-y'), 200);
assert(h.hero.classes.has('sa-aim-visible'));
const listeners = h.listenCount();
h.load();
assert.equal(h.listenCount(), listeners, 'Repeated initialization must not add listeners');
assert.equal(h.queue.size, 0);

let before = h.counts();
for (let i = 0; i < 50; i++) h.hero.emit('pointermove', h.mouse(9999, -9999));
assert.deepEqual(h.counts(), before, 'Pointermove must not read geometry or write DOM');
assert.equal(h.queue.size, 1, 'A burst of input must coalesce into one RAF');
h.step();
assert(h.value(h.aim, '--sa-aim-x') > 400 && h.value(h.aim, '--sa-aim-x') < 1000, 'Aim must ease toward pointer');
h.settle();
assert.equal(h.value(h.aim, '--sa-aim-x'), 1000);
assert.equal(h.value(h.aim, '--sa-aim-y'), 0);
assert.equal(h.value(h.rifle, '--sa-rifle-x'), 24);
assert.equal(h.value(h.rifle, '--sa-rifle-y'), -14);
assert.equal(h.value(h.rifle, '--sa-rifle-angle'), 2.5);
h.hero.emit('pointermove', h.mouse(-9999, 9999));
h.settle();
assert.equal(h.value(h.rifle, '--sa-rifle-x'), -24);
assert.equal(h.value(h.rifle, '--sa-rifle-y'), 14);
assert.equal(h.value(h.rifle, '--sa-rifle-angle'), -2.5);

let prevented = false;
h.hero.emit('pointerdown', h.mouse(600, 350, { preventDefault() { prevented = true; } }));
h.step();
assert.equal(h.value(h.rifle, '--sa-recoil'), 8, 'Recoil amplitude must be 6–10 px');
h.step(60);
assert(h.value(h.rifle, '--sa-recoil') > 0 && h.value(h.rifle, '--sa-recoil') < 8);
h.step(60);
assert.equal(h.value(h.rifle, '--sa-recoil'), 0, 'Recoil must finish after 120 ms');
assert.equal(prevented, false, 'Native links must not be delayed/prevented');
h.settle();
for (let i = 0; i < 8; i++) h.hero.emit('pointerdown', h.mouse(600, 350));
h.step();
assert.equal(h.value(h.rifle, '--sa-recoil'), 8, 'Repeated clicks must not accumulate recoil');
h.hero.emit('pointerleave');
h.settle();
assert(!h.hero.classes.has('sa-aim-visible'));
assert.equal(h.value(h.rifle, '--sa-rifle-x'), 0);
assert.equal(h.value(h.rifle, '--sa-rifle-y'), 0);
assert.equal(h.value(h.rifle, '--sa-recoil'), 0);

const reduced = setup({ reduce: true });
reduced.hero.emit('pointermove', reduced.mouse(800, 450));
reduced.step();
assert.equal(reduced.value(reduced.aim, '--sa-aim-x'), 700, 'Reduced-motion aim must snap without easing');
assert.equal(reduced.value(reduced.aim, '--sa-aim-y'), 400);
reduced.hero.emit('pointerdown', reduced.mouse(800, 450));
reduced.settle();
assert.equal(reduced.value(reduced.rifle, '--sa-rifle-x'), 0);
assert.equal(reduced.value(reduced.rifle, '--sa-rifle-y'), 0);
assert.equal(reduced.value(reduced.rifle, '--sa-recoil'), 0);

for (const options of [{ desktop: false }, { touchPoints: 1 }]) {
  const touch = setup(options);
  before = touch.counts();
  touch.hero.emit('pointermove', touch.mouse(800, 450));
  touch.hero.emit('pointerdown', touch.mouse(800, 450));
  assert.deepEqual(touch.counts(), before);
  assert.equal(touch.queue.size, 0);
  assert(!touch.hero.classes.has('sa-interaction-enabled'));
  assert(!touch.hero.classes.has('sa-aim-visible'));
}
h.hero.emit('pointermove', h.mouse(800, 450));
h.step();
h.reducedMedia.matches = true;
h.reducedMedia.emit('change');
h.settle();
assert.equal(h.value(h.rifle, '--sa-rifle-x'), 0, 'Live reduced-motion changes must reset gun');
h.desktopMedia.matches = false;
h.desktopMedia.emit('change');
h.settle();
assert(!h.hero.classes.has('sa-interaction-enabled'));
h.desktopMedia.matches = true;
h.desktopMedia.emit('change');
h.settle();
h.doc.activeElement = { matches: (selector) => selector === ':focus-visible' };
h.hero.emit('focusin');
h.settle();
assert(!h.hero.classes.has('sa-aim-visible'), 'Keyboard focus must not have an aim overlay');
h.hero.emit('pointermove', h.mouse(800, 450));
h.win.emit('pagehide');
assert.equal(h.queue.size, 0, 'Pagehide must cancel pending RAF');
h.win.emit('pageshow');
h.settle();
assert.equal(h.listenCount(), listeners, 'BFCache restore must not duplicate listeners');
assert(!('scroll' in h.win.listeners) && !('wheel' in h.win.listeners));
console.log('PASS: initial aim, RAF coalescing/idle, movement bounds, easing, recoil, links, touch/mobile, reduced motion, focus, duplicate init, and page lifecycle.');
