/* Seoul-time themes, manual preview cycle, search shortcut, and category aim cursor. */
(() => {
  'use strict';
  const root = document.documentElement;
  const start = document.getElementById('search-trigger');
  const cancel = document.getElementById('search-cancel');
  const input = document.getElementById('search-input');
  if (start && cancel && input) {
    document.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); start.click(); input.focus();
      }
      if (event.key === 'Escape' && cancel.classList.contains('d-block')) { cancel.click(); start.focus(); }
    });
    cancel.addEventListener('click', () => { input.value = ''; });
  }
  const dayparts = ['dawn','day','evening','night'];
  const labels = { auto:'자동', dawn:'새벽', day:'낮', evening:'저녁', night:'밤' };
  const getSeoulHour = () => Number.parseInt(new Intl.DateTimeFormat('en-US',{hour:'2-digit',hourCycle:'h23',timeZone:'Asia/Seoul'}).format(new Date()),10);
  const getAutomaticDaypart = (hour) => { if (hour>=5&&hour<9) return 'dawn'; if (hour>=9&&hour<17) return 'day'; if (hour>=17&&hour<20) return 'evening'; return 'night'; };
  const applyTheme = () => {
    const preview = window.localStorage.getItem('sa-daypart-preview') || 'auto';
    const daypart = preview === 'auto' ? getAutomaticDaypart(getSeoulHour()) : preview;
    root.dataset.daypart = daypart;
    const button = document.querySelector('.sa-theme-cycle');
    if (button) { button.dataset.preview = preview; button.setAttribute('aria-label',`시간대 테마 변경 · 현재 ${labels[preview]}`); button.title = `테마: ${labels[preview]} · 클릭하여 변경`; }
  };
  const themeButton = document.querySelector('.sa-theme-cycle');
  if (themeButton) {
    const cycle = ['auto',...dayparts];
    themeButton.addEventListener('click',() => {
      const current = window.localStorage.getItem('sa-daypart-preview') || 'auto';
      const next = cycle[(cycle.indexOf(current)+1)%cycle.length];
      if (next==='auto') window.localStorage.removeItem('sa-daypart-preview'); else window.localStorage.setItem('sa-daypart-preview',next);
      applyTheme();
    });
  }
  applyTheme();
  window.setInterval(() => { if (!window.localStorage.getItem('sa-daypart-preview')) applyTheme(); },60*1000);
  const hero = document.getElementById('sa-fps-hero');
  const aim = hero?.querySelector('.sa-live-aim');
  const grid = hero?.querySelector('.sa-category-grid');
  const defaultTarget = grid?.querySelector('.sa-category-card:nth-child(2)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (hero&&aim&&grid&&defaultTarget&&finePointer.matches) {
    const moveAim = (clientX,clientY) => { const bounds=hero.getBoundingClientRect(); aim.style.left=`${clientX-bounds.left}px`; aim.style.top=`${clientY-bounds.top}px`; };
    const aimAtDefault = () => { const target=defaultTarget.getBoundingClientRect(); moveAim(target.left+target.width/2,target.top+target.height/2); };
    grid.addEventListener('pointermove',(event)=>moveAim(event.clientX,event.clientY));
    grid.addEventListener('pointerleave',aimAtDefault);
    window.addEventListener('resize',aimAtDefault,{passive:true});
    window.requestAnimationFrame(aimAtDefault);
  } else if (aim) aim.hidden = true;
})();
