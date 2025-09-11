document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('q');
  const select = document.getElementById('techSubCategory');
  const btn = document.getElementById('matchBtn');
  const box = document.getElementById('matchingResults');

  const API = '/api/matching';

  // API로부터 받은 전체 검색 결과를 저장할 변수
  let currentResults = [];

  const esc = s => String(s ?? '')
    .replaceAll('&','&amp;').replaceAll('<','&lt;')
    .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#39;");

  function render(results) {
    // 전체 검색 결과를 currentResults에 저장
    currentResults = results;

    if (!results.length) {
      box.innerHTML = `<div class="empty">결과가 없습니다.</div>`;
      return;
    }
    // 각 결과 항목에 data-index 속성을 추가하여 식별 가능하게 함
    const html = results.map((r, index) => `
      <div class="result-item" data-index="${index}">
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
      // API로부터 받은 전체 결과를 render 함수로 전달
      render(data.results || []);
    } catch (e) {
      box.innerHTML = `<div class="empty">오류: ${esc(e.message)}</div>`;
    }
  }

  btn.addEventListener('click', search);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') search(); });

  // 결과 목록의 클릭 이벤트를 처리
  box.addEventListener('click', (e) => {
    // '자세히' 버튼을 클릭했을 때만 동작
    if (e.target.classList.contains('go')) {
      e.preventDefault(); // 기본 링크 이동 동작 방지
      const resultItem = e.target.closest('.result-item');
      if (resultItem) {
        const index = resultItem.dataset.index;
        const selectedTech = currentResults[index];
        if (selectedTech) {
          // 클릭한 기술의 모든 필드 정보를 localStorage에 저장
          localStorage.setItem('selectedTechFull', JSON.stringify(selectedTech));
          // 상세 페이지로 이동
          window.location.href = e.target.href;
        }
      }
    }
  });
});