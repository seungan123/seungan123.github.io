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
    listeners: {}, listenerOptions: {},
    addEventListener(type, fn, options) { (this.listeners[type] ||= []).push(fn); (this.listenerOptions[type] ||= []).push(options); },
    emit(type, event = {}) { for (const fn of this.listeners[type] || []) fn(event); }
  });
  const element = (rect) => ({
    ...emitter(), dataset: {}, values: {}, classes: new Set(), rect,
    getBoundingClientRect() { reads++; return this.rect; },
    style: { setProperty(name, value) { writes++; this.owner.values[name] = value; } },
    classList: { toggle(name, on) { writes++; this.owner.classes[on ? 'add' : 'delete'](name); } }
  });
  const hero = element({ left: 100, top: 50, width: 1000, height: 600 });
  const aim = element({});
  const rifle = element({});
  const card = element({ left: 400, top: 200, width: 200, height: 100 });
  const world = element({ left: 100, top: 0, width: 1000, height: 1600 });
  const worldViewport = element({});
  const heroScroll = element({ left: 100, top: 50, width: 1000, height: 900 });
  for (const el of [hero, aim, rifle, card, world, worldViewport, heroScroll]) {
    el.style.owner = el;
    el.classList.owner = el;
  }
  hero.querySelector = (s) => ({ '.sa-aim': aim, '.sa-category-card.is-selected': card })[s];
  world.querySelector = (s) => ({ '.sa-world-viewport': worldViewport, '.sa-rifle': rifle, '.sa-hero-scroll': heroScroll })[s];
  const desktopMedia = { ...emitter(), matches: desktop };
  const reducedMedia = { ...emitter(), matches: reduce };
  const win = { ...emitter(), innerHeight: 600, matchMedia: (q) => q.includes('reduced-motion') ? reducedMedia : desktopMedia };
  const doc = { ...emitter(), hidden: false, activeElement: null, querySelector: (s) => ({ '.sa-hero': hero, '.sa-world': world })[s] };
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
  return { hero, aim, rifle, world, worldViewport, heroScroll, win, doc, desktopMedia, reducedMedia, queue, load, step, settle, mouse, value, listenCount, counts: () => ({ reads, writes }) };
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
for (let i = 0; i < 50; i++) h.hero.emit('pointermove', h.mouse(1100, 50));
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
h.hero.emit('pointermove', h.mouse(100, 650));
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
assert(!('wheel' in h.win.listeners), 'Native scrolling must not be intercepted');
assert(h.win.listenerOptions.scroll.every((options) => options.passive));

const scrolling = setup();
const stationaryRifle = { ...scrolling.rifle.values };
before = scrolling.counts();
scrolling.hero.rect.top = -120;
scrolling.world.rect.top = -120;
for (let i = 0; i < 50; i++) scrolling.win.emit('scroll');
assert.deepEqual(scrolling.counts(), before, 'Scroll handlers must not read/write DOM');
assert.equal(scrolling.queue.size, 1, 'Scroll bursts must coalesce');
scrolling.settle();
const far = scrolling.value(scrolling.worldViewport, '--sa-far-y');
const near = scrolling.value(scrolling.worldViewport, '--sa-field-y');
assert(far < 0 && near < far, 'Near field must move faster than distant scenery');
assert.deepEqual(scrolling.rifle.values, stationaryRifle, 'Scrolling must preserve the rifle resting pose');
scrolling.hero.rect.top = -300;
scrolling.world.rect.top = -300;
scrolling.win.emit('scroll');
scrolling.settle();
assert.deepEqual(scrolling.rifle.values, stationaryRifle, 'Rifle must remain available while entering posts');
scrolling.hero.rect.top = -1600;
scrolling.world.rect.top = -1600;
scrolling.win.emit('scroll');
scrolling.settle();
assert(Math.abs(scrolling.value(scrolling.worldViewport, '--sa-field-y')) <= scrolling.win.innerHeight * 0.045);
assert.deepEqual(scrolling.rifle.values, stationaryRifle, 'Scroll must not overwrite pointer/recoil transforms');
assert(!scrolling.hero.classes.has('sa-aim-visible'), 'Offscreen hero must not show aim');
scrolling.reducedMedia.matches = true;
scrolling.reducedMedia.emit('change');
scrolling.settle();
assert.equal(scrolling.value(scrolling.worldViewport, '--sa-far-y'), 0);
assert.equal(scrolling.value(scrolling.worldViewport, '--sa-field-y'), 0);
const mobileScroll = setup({ desktop: false, touchPoints: 1 });
mobileScroll.hero.rect.top = -120;
mobileScroll.world.rect.top = -120;
mobileScroll.win.emit('scroll');
mobileScroll.settle();
assert(mobileScroll.value(mobileScroll.worldViewport, '--sa-field-y') < 0, 'Native mobile scroll also moves scenery');
assert(!mobileScroll.hero.classes.has('sa-interaction-enabled'), 'Touch pointer effects remain off');

// A real sticky interval: 900px wrapper - 600px hero = 300px of native travel.
const pinned = setup();
assert(pinned.world.classes.has('sa-scroll-enabled'));
assert.equal(pinned.value(pinned.world, '--scroll-progress'), 0);
const scrollTo = (y) => {
  pinned.heroScroll.rect.top = -y;
  pinned.world.rect.top = -y;
  pinned.hero.rect.top = -Math.max(y - 300, 0);
  pinned.win.emit('scroll');
  pinned.settle();
};
scrollTo(30);
assert.equal(pinned.value(pinned.world, '--scroll-progress'), 0.1);
assert.equal(pinned.value(pinned.world, '--ui-opacity'), 1, 'Opening pose holds briefly');
assert.equal(pinned.value(pinned.world, '--rifle-scroll-y'), 0);
scrollTo(150);
assert.equal(pinned.value(pinned.world, '--scroll-progress'), 0.5);
assert(pinned.value(pinned.world, '--ui-opacity') > 0.25 && pinned.value(pinned.world, '--ui-opacity') < 1);
assert(pinned.value(pinned.world, '--rifle-scroll-y') > 0 && pinned.value(pinned.world, '--rifle-scroll-y') < 120);
assert(pinned.value(pinned.aim, '--sa-aim-x') > 400 && pinned.value(pinned.aim, '--sa-aim-x') < 500);
assert(pinned.value(pinned.aim, '--sa-aim-y') > 200 && pinned.value(pinned.aim, '--sa-aim-y') < 360);
scrollTo(300);
assert.equal(pinned.value(pinned.world, '--scroll-progress'), 1);
assert.equal(pinned.value(pinned.world, '--ui-opacity'), 0.25, 'UI never disappears');
assert.equal(pinned.value(pinned.world, '--rifle-scroll-scale'), 0.96);
assert.equal(pinned.value(pinned.world, '--aim-progress'), 1);
assert.equal(pinned.value(pinned.aim, '--sa-aim-x'), 500);
assert.equal(pinned.value(pinned.aim, '--sa-aim-y'), 360);
const finalDrop = pinned.value(pinned.world, '--rifle-scroll-y');
scrollTo(400);
assert.equal(pinned.value(pinned.aim, '--sa-aim-y') + pinned.hero.rect.top, 360, 'Aim stays toward the screen center as posts enter');
scrollTo(3000);
assert.equal(pinned.value(pinned.world, '--scroll-progress'), 1);
assert.equal(pinned.value(pinned.world, '--rifle-scroll-y'), finalDrop, 'Rifle movement stays bounded past the hero');
assert(finalDrop <= 120);
scrollTo(0);
assert.equal(pinned.value(pinned.world, '--ui-opacity'), 1, 'Scrolling back restores the first screen');
assert.equal(pinned.value(pinned.world, '--rifle-scroll-y'), 0);
assert.equal(pinned.value(pinned.aim, '--sa-aim-x'), 400);
assert.equal(pinned.value(pinned.aim, '--sa-aim-y'), 200);

scrollTo(150);
pinned.hero.rect.height = 800;
pinned.win.emit('resize');
pinned.settle();
assert(!pinned.world.classes.has('sa-scroll-enabled'), 'Tall content must not be trapped in a short viewport');
assert.equal(pinned.value(pinned.world, '--scroll-progress'), 0);
assert.equal(pinned.value(pinned.world, '--ui-opacity'), 1);
pinned.hero.rect.height = 600;
pinned.win.emit('resize');
pinned.settle();
assert(pinned.world.classes.has('sa-scroll-enabled'));
assert.equal(pinned.value(pinned.world, '--scroll-progress'), 0.5, 'Resize recomputes the real scroll interval');
pinned.reducedMedia.matches = true;
pinned.reducedMedia.emit('change');
pinned.settle();
assert(!pinned.world.classes.has('sa-scroll-enabled'));
assert.equal(pinned.value(pinned.world, '--rifle-scroll-y'), 0);
assert.equal(pinned.value(pinned.world, '--aim-progress'), 0);

for (const options of [{ desktop: false }, { touchPoints: 1 }, { reduce: true }]) {
  const plain = setup(options);
  plain.heroScroll.rect.top = -300;
  plain.win.emit('scroll');
  plain.settle();
  assert(!plain.world.classes.has('sa-scroll-enabled'));
  assert.equal(plain.value(plain.world, '--scroll-progress'), 0);
  assert.equal(plain.value(plain.world, '--rifle-scroll-y'), 0);
  assert.equal(plain.value(plain.world, '--ui-opacity'), 1);
  assert.equal(plain.value(plain.world, '--aim-progress'), 0);
}
console.log('PASS: pointer/recoil regressions, native RAF scrolling, sticky progress/reversal, bounded rifle/UI/aim, resize fallback, mobile/touch and reduced motion.');
