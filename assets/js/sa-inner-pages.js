(() => {
  'use strict';

  const menu = document.querySelector('.sa-inner-menu');
  const navigation = document.querySelector('.sa-inner-navigation');
  menu.hidden = false;
  const closeMenu = () => menu.setAttribute('aria-expanded', 'false');
  menu.addEventListener('click', () => {
    menu.setAttribute('aria-expanded', String(menu.getAttribute('aria-expanded') !== 'true'));
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      menu.focus();
    }
  });
  document.addEventListener('click', event => {
    if (!menu.contains(event.target) && !navigation.contains(event.target)) closeMenu();
  });

  const search = document.querySelector('.sa-inner-search');
  if (!search) return;

  const form = search.querySelector('form');
  const input = form.elements.q;
  const results = search.querySelector('.sa-inner-results');
  const empty = search.querySelector('.sa-inner-no-results');
  const status = search.querySelector('output');
  const normalize = text => text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  const records = Array.from(results.querySelectorAll('li'), row => ({
    row,
    url: row.querySelector('a').getAttribute('href'),
    text: normalize(row.textContent),
  }));

  function filter() {
    const terms = normalize(input.value).split(' ').filter(Boolean);
    let matches = 0;
    for (const record of records) {
      const match = terms.length > 0 && terms.every(term => record.text.includes(term));
      record.row.hidden = !match;
      if (match) matches++;
    }
    results.hidden = matches === 0;
    empty.hidden = matches > 0 || (terms.length === 0 && records.length > 0);
    status.textContent = matches > 0 ? `검색 결과 ${matches}개` : '';
  }

  input.value = new URL(location.href).searchParams.get('q') || '';
  input.addEventListener('input', filter);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const url = new URL(form.action);
    if (input.value.trim()) url.searchParams.set('q', input.value.trim());
    history.replaceState(null, '', url);
    filter();
  });
  filter();

  // The same server-rendered rows also work on title/summary if the full-text index is offline.
  if (records.length) {
    fetch(search.dataset.searchIndex)
      .then(response => {
        if (!response.ok) throw new Error('Search index unavailable');
        return response.json();
      })
      .then(posts => {
        const byUrl = new Map(posts.map(post => [post.url, post.content]));
        for (const record of records) record.text += ' ' + normalize(byUrl.get(record.url) || '');
        filter();
      })
      .catch(() => {});
  }
})();
