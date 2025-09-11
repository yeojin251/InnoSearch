document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('q');
  const select = document.getElementById('techSubCategory');
  const btn = document.getElementById('matchBtn');
  const box = document.getElementById('matchingResults');

  const API = '/api/matching';

  const esc = s => String(s ?? '')
    .replaceAll('&','&amp;').replaceAll('<','&lt;')
    .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#39;");

  function render(results) {
    if (!results.length) {
      box.innerHTML = `<div class="empty">결과가 없습니다.</div>`;
      return;
    }
    const html = results.map(r => `
      <div class="result-item">
        <span class="name">${esc(r.name)}</span>
        <a class="go" href="./tech-detail.html?name=${encodeURIComponent(r.name)}">자세히 →</a>
      </div>
    `).join('');
    box.innerHTML = `<div class="result-list">${html}</div>`;
  }

  async function search() {
    const keyword = (input.value || '').trim();
    const techSubCategory = select.value || '';
    box.innerHTML = `<div class="loading">검색 중…</div>`;
    try {
      const resp = await fetch(`${API}/search`, {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ keyword, techSubCategory })
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.message || '검색 실패');
      render(data.results || []);
    } catch (e) {
      box.innerHTML = `<div class="empty">오류: ${esc(e.message)}</div>`;
    }
  }

  btn.addEventListener('click', search);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') search(); });
});
