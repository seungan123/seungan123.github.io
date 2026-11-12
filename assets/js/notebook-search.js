(() => {
  const section = document.getElementById('search-page');
  const form = section.querySelector('form');
  const field = form.elements.q;
  const status = section.querySelector('[role=status]');
  const normalize = text => text.normalize('NFKC').toLowerCase();
  const rows = Array.from(section.querySelectorAll('.records li'), row => ({
    row, href: row.querySelector('a').getAttribute('href'), text: normalize(row.textContent)
  }));

  function filter() {
    const words = normalize(field.value).trim().split(/\s+/).filter(Boolean);
    let matches = 0;
    for (const item of rows) {
      item.row.hidden = !words.every(word => item.text.includes(word));
      if (!item.row.hidden) matches++;
    }
    status.textContent = words.length && rows.length ? (matches ? `검색 결과 ${matches}개` : '검색 결과가 없습니다.') : '';
  }

  field.value = new URL(location.href).searchParams.get('q') || '';
  field.addEventListener('input', filter);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const url = new URL(form.action);
    if (field.value.trim()) url.searchParams.set('q', field.value.trim());
    history.replaceState(null, '', url);
    filter();
  });
  filter();
  if (!rows.length) return;
  fetch(section.dataset.index).then(response => {
    if (!response.ok) throw Error('검색 색인을 불러올 수 없습니다.');
    return response.json();
  }).then(posts => {
    const byUrl = new Map(posts.map(post => [post.url, post.content]));
    for (const item of rows) item.text += ' ' + normalize(byUrl.get(item.href) || '');
    filter();
  }).catch(() => { /* Titles and excerpts remain searchable offline. */ });
})();
