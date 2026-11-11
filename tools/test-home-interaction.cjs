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
  const world = element({ left: 0, top: 0, width: 1200, height: 1600 });
  const worldViewport = element({});
  const heroScroll = element({ left: 100, top: 50, width: 1000, height: 900 });
  for (const el of [hero, aim, rifle, card, world, worldViewport, heroScroll]) {
    el.style.owner = el;
    el.classList.owner = el;
  }
  hero.querySelector = (s) => ({ '.sa-category-card.is-selected': card })[s];
  world.querySelector = (s) => ({ '.sa-aim': aim, '.sa-world-viewport': worldViewport, '.sa-rifle': rifle, '.sa-hero-scroll': heroScroll })[s];
  const desktopMedia = { ...emitter(), matches: desktop };
  const reducedMedia = { ...emitter(), matches: reduce };
  const win = { ...emitter(), innerWidth: 1200, innerHeight: 600, matchMedia: (q) => q.includes('reduced-motion') ? reducedMedia : desktopMedia };
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
  const listenCount = () => [world, hero, win, doc, desktopMedia, reducedMedia].reduce((n, e) => n + Object.values(e.listeners).flat().length, 0);
  load();
  settle();
  return { hero, aim, rifle, world, worldViewport, heroScroll, win, doc, desktopMedia, reducedMedia, queue, load, step, settle, mouse, value, listenCount, counts: () => ({ reads, writes }) };
}

const h = setup();
assert.equal(h.value(h.aim, '--sa-aim-x'), 500, 'Initial aim must center on CTF card in viewport coordinates');
assert.equal(h.value(h.aim, '--sa-aim-y'), 250);
assert(h.world.classes.has('sa-aim-visible'));
const listeners = h.listenCount();
h.load();
assert.equal(h.listenCount(), listeners, 'Repeated initialization must not add listeners');
assert.equal(h.queue.size, 0);

let before = h.counts();
for (let i = 0; i < 50; i++) h.world.emit('pointermove', h.mouse(1200, 0));
assert.deepEqual(h.counts(), before, 'Pointermove must not read geometry or write DOM');
assert.equal(h.queue.size, 1, 'A burst of input must coalesce into one RAF');
h.step();
assert.equal(h.value(h.aim, '--sa-aim-x'), 1200, 'First pointer frame must snap instead of flying from the default');
h.settle();
assert.equal(h.value(h.aim, '--sa-aim-x'), 1200);
assert.equal(h.value(h.aim, '--sa-aim-y'), 0);
assert.equal(h.value(h.rifle, '--sa-rifle-x'), 24);
assert.equal(h.value(h.rifle, '--sa-rifle-y'), -14);
assert.equal(h.value(h.rifle, '--sa-rifle-angle'), 2.5);
h.world.emit('pointermove', h.mouse(600, 300));
h.step();
assert(h.value(h.aim, '--sa-aim-x') > 600 && h.value(h.aim, '--sa-aim-x') < 1200, 'Ordinary in-page movement retains gentle tracking');
h.settle();
h.world.emit('pointermove', h.mouse(0, 600));
h.settle();
assert.equal(h.value(h.rifle, '--sa-rifle-x'), -24);
assert.equal(h.value(h.rifle, '--sa-rifle-y'), 14);
assert.equal(h.value(h.rifle, '--sa-rifle-angle'), -2.5);

let prevented = false;
h.world.emit('pointerdown', h.mouse(600, 350, { preventDefault() { prevented = true; } }));
h.step();
assert.equal(h.value(h.rifle, '--sa-recoil'), 8, 'Recoil amplitude must be 6–10 px');
h.step(60);
assert(h.value(h.rifle, '--sa-recoil') > 0 && h.value(h.rifle, '--sa-recoil') < 8);
h.step(60);
assert.equal(h.value(h.rifle, '--sa-recoil'), 0, 'Recoil must finish after 120 ms');
assert.equal(prevented, false, 'Native links must not be delayed/prevented');
h.settle();
for (let i = 0; i < 8; i++) h.world.emit('pointerdown', h.mouse(600, 350));
h.step();
assert.equal(h.value(h.rifle, '--sa-recoil'), 8, 'Repeated clicks must not accumulate recoil');
h.world.emit('pointerleave');
h.settle();
assert(!h.world.classes.has('sa-aim-visible'));
assert.equal(h.value(h.rifle, '--sa-rifle-x'), 0);
assert.equal(h.value(h.rifle, '--sa-rifle-y'), 0);
assert.equal(h.value(h.rifle, '--sa-recoil'), 0);

const reduced = setup({ reduce: true });
const phone = setup({ desktop: false, touchPoints: 1 });
const shots = [];
phone.rifle.animate = (frames, options) => {
  const shot = { frames, options, cancel() { this.cancelled = true; } };
  shots.push(shot);
  return shot;
};
phone.world.emit('pointerdown', { pointerType: 'touch' });
phone.win.emit('scroll');
phone.world.emit('pointercancel');
assert.equal(shots.length, 0, 'A touch scroll must not fire');
phone.world.emit('click', { detail: 1 });
phone.world.emit('click', { detail: 1 });
assert.equal(shots.length, 2);
assert.equal(shots[0].cancelled, true, 'Repeated taps restart the recoil');
assert.equal(shots[1].options.duration, 135);
assert.equal(shots[1].frames.at(-1).transform, 'none');
phone.reducedMedia.matches = true;
phone.world.emit('click', { detail: 1 });
assert.equal(shots.length, 2, 'Respect reduced motion on touch devices');

reduced.world.emit('pointermove', reduced.mouse(800, 450));
reduced.step();
assert.equal(reduced.value(reduced.aim, '--sa-aim-x'), 800, 'Reduced-motion aim must snap without easing');
assert.equal(reduced.value(reduced.aim, '--sa-aim-y'), 450);
reduced.world.emit('pointerdown', reduced.mouse(800, 450));
reduced.settle();
assert.equal(reduced.value(reduced.rifle, '--sa-rifle-x'), 0);
assert.equal(reduced.value(reduced.rifle, '--sa-rifle-y'), 0);
assert.equal(reduced.value(reduced.rifle, '--sa-recoil'), 0);

for (const options of [{ desktop: false }, { touchPoints: 1 }]) {
  const touch = setup(options);
  before = touch.counts();
  touch.world.emit('pointermove', touch.mouse(800, 450));
  touch.world.emit('pointerdown', touch.mouse(800, 450));
  assert.deepEqual(touch.counts(), before);
  assert.equal(touch.queue.size, 0);
  assert(!touch.world.classes.has('sa-interaction-enabled'));
  assert(!touch.world.classes.has('sa-aim-visible'));
}
h.world.emit('pointermove', h.mouse(800, 450));
h.step();
h.reducedMedia.matches = true;
h.reducedMedia.emit('change');
h.settle();
assert.equal(h.value(h.rifle, '--sa-rifle-x'), 0, 'Live reduced-motion changes must reset gun');
h.desktopMedia.matches = false;
h.desktopMedia.emit('change');
h.settle();
assert(!h.world.classes.has('sa-interaction-enabled'));
h.desktopMedia.matches = true;
h.desktopMedia.emit('change');
h.settle();
h.doc.activeElement = { matches: (selector) => selector === ':focus-visible' };
h.world.emit('focusin');
h.settle();
assert(!h.world.classes.has('sa-aim-visible'), 'Keyboard focus must not have an aim overlay');
h.world.emit('pointermove', h.mouse(800, 450));
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
assert(!scrolling.world.classes.has('sa-aim-visible'), 'An entirely offscreen world must not show aim');
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
assert(!mobileScroll.world.classes.has('sa-interaction-enabled'), 'Touch pointer effects remain off');

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
assert.equal(pinned.value(pinned.world, '--rifle-scroll-y'), 0);
assert.equal(pinned.value(pinned.aim, '--sa-aim-x'), 500);
assert.equal(pinned.value(pinned.aim, '--sa-aim-y'), 250);
scrollTo(300);
assert.equal(pinned.value(pinned.world, '--scroll-progress'), 1);
assert.equal(pinned.value(pinned.world, '--ui-opacity'), 0.25, 'UI never disappears');
assert.equal(pinned.value(pinned.world, '--rifle-scroll-scale'), 1);
assert.equal(pinned.value(pinned.world, '--aim-progress'), 0);
assert.equal(pinned.value(pinned.aim, '--sa-aim-x'), 500);
assert.equal(pinned.value(pinned.aim, '--sa-aim-y'), 250);
const finalDrop = pinned.value(pinned.world, '--rifle-scroll-y');
scrollTo(400);
assert.equal(pinned.value(pinned.aim, '--sa-aim-y'), 250, 'Scrolling must not steer the fixed aim');
scrollTo(3000);
assert.equal(pinned.value(pinned.world, '--scroll-progress'), 1);
assert.equal(pinned.value(pinned.world, '--rifle-scroll-y'), finalDrop, 'Rifle movement stays bounded past the hero');
assert.equal(finalDrop, 0);
scrollTo(0);
assert.equal(pinned.value(pinned.world, '--ui-opacity'), 1, 'Scrolling back restores the first screen');
assert.equal(pinned.value(pinned.world, '--rifle-scroll-y'), 0);
assert.equal(pinned.value(pinned.aim, '--sa-aim-x'), 500);
assert.equal(pinned.value(pinned.aim, '--sa-aim-y'), 250);

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
// The same mouse position must have the same aim and weapon pose in ALL POST.
const wholePage = setup();
wholePage.world.emit('pointerenter', wholePage.mouse(800, 450));
wholePage.settle();
const originalPose = { ...wholePage.rifle.values };
wholePage.hero.rect.top = -1000;
wholePage.heroScroll.rect.top = -1000;
wholePage.world.rect.top = -1000;
wholePage.win.emit('scroll');
wholePage.settle();
assert(wholePage.world.classes.has('sa-aim-visible'), 'ALL POST must retain the aim after hero leaves view');
assert.equal(wholePage.value(wholePage.aim, '--sa-aim-x'), 800);
assert.equal(wholePage.value(wholePage.aim, '--sa-aim-y'), 450);
assert.deepEqual(wholePage.rifle.values, originalPose, 'Scrolling cannot change the rifle pose at a stationary pointer');
assert.equal(wholePage.value(wholePage.world, '--rifle-scroll-y'), 0);
assert.equal(wholePage.value(wholePage.world, '--rifle-scroll-scale'), 1);
assert.equal((wholePage.hero.listeners.pointermove || []).length, 0);
assert.equal(wholePage.world.listeners.pointermove.length, 1);

for (const trigger of [() => wholePage.world.emit('pointerleave'), () => wholePage.win.emit('blur'), () => wholePage.world.emit('pointercancel')]) {
  trigger();
  wholePage.settle();
  assert(!wholePage.world.classes.has('sa-aim-visible'));
  before = wholePage.counts();
  wholePage.world.emit('pointermove', wholePage.mouse(110, 70));
  assert.deepEqual(wholePage.counts(), before, 'Re-entry also waits for RAF before touching DOM');
  wholePage.step();
  assert.equal(wholePage.value(wholePage.aim, '--sa-aim-x'), 110, 'Re-entry must snap in the first frame');
  assert.equal(wholePage.value(wholePage.aim, '--sa-aim-y'), 70);
  assert(wholePage.world.classes.has('sa-aim-visible'));
}
wholePage.doc.hidden = true;
wholePage.doc.emit('visibilitychange');
wholePage.doc.hidden = false;
wholePage.doc.emit('visibilitychange');
wholePage.settle();
assert(!wholePage.world.classes.has('sa-aim-visible'), 'Returning to a tab must not flash a default center aim');
wholePage.world.emit('pointerenter', wholePage.mouse(950, 500));
wholePage.step();
assert.equal(wholePage.value(wholePage.aim, '--sa-aim-x'), 950);
assert.equal(wholePage.value(wholePage.aim, '--sa-aim-y'), 500);
wholePage.world.emit('pointermove', wholePage.mouse(400, 200));
wholePage.step();
wholePage.world.emit('pointerdown', wholePage.mouse(400, 200));
wholePage.step();
assert.equal(wholePage.value(wholePage.aim, '--sa-aim-x'), 400, 'Click feedback must align with the native click target');
assert.equal(wholePage.value(wholePage.aim, '--sa-aim-y'), 200);
console.log('PASS: instant re-entry, full-page aim, stationary rifle through scroll, pointer/recoil, sticky UI, lifecycle, mobile/touch and reduced motion.');
