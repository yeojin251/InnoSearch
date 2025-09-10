// public/js/matching.js
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('q');
  const btn = document.getElementById('matchBtn');
  const box = document.getElementById('matchingResults');

  const API_BASE = '/api/matching';

  function htmlEscape(s) {
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function render(data) {
    if (!box) return;
    box.innerHTML = '';

    // 컨테이너 기본 스타일(필요하면 CSS로 옮겨도 됨)
    box.style.marginTop = '12px';
    box.style.borderTop = '1px solid #eee';
    box.style.paddingTop = '12px';

    if (!data || data.success === false) {
      box.innerHTML = `<p class="empty">검색 중 오류가 발생했어요. ${data?.message ? htmlEscape(data.message) : ''}</p>`;
      return;
    }

    const { keyword, totalCount, results } = data;

    const head = document.createElement('div');
    head.className = 'results-head';
    head.style.marginBottom = '8px';
    head.innerHTML = `<strong>"${htmlEscape(keyword)}"</strong> 검색 결과 <b>${totalCount}</b>건`;
    box.appendChild(head);

    if (!totalCount) {
      box.insertAdjacentHTML('beforeend', '<p class="empty">일치하는 결과가 없습니다.</p>');
      return;
    }

    const ul = document.createElement('ul');
    ul.className = 'result-list';
    ul.style.listStyle = 'disc';
    ul.style.paddingLeft = '20px';
    ul.style.lineHeight = '1.7';

    results.forEach((name) => {
      const li = document.createElement('li');
      li.textContent = name; // 기술명 그대로 표시
      ul.appendChild(li);
    });

    box.appendChild(ul);
  }

  async function search() {
    const keyword = (input.value || '').trim();
    if (!keyword) {
      render({ success: true, keyword: '', totalCount: 0, results: [] });
      return;
    }

    box.innerHTML = '<p class="loading">검색 중…</p>';

    try {
      const resp = await fetch(`${API_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ keyword }),
      });
      const data = await resp.json();
      render(data);
    } catch (err) {
      render({ success: false, message: err.message || '네트워크 오류' });
    }
  }

  // 이벤트 바인딩
  btn?.addEventListener('click', search);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') search();
  });
});
