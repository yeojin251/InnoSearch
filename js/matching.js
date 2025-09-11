// public/js/matching.js
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('q');
  const btn = document.getElementById('matchBtn');
  const box = document.getElementById('matchingResults');
  const API_BASE = '/api/matching';
  const isDetailedSearchPage = !!document.getElementById('techSubCategory');

  const esc = (s)=> String(s)
    .replaceAll('&','&amp;').replaceAll('<','&lt;')
    .replaceAll('>','&gt;').replaceAll('"','&quot;')
    .replaceAll("'","&#39;");

  // ========== 홈: 빠른 매칭 ==========
  function initQuick() {
    function render(data) {
      if (!box) return;
      box.innerHTML = '';
      box.style.marginTop='12px'; box.style.borderTop='1px solid #eee'; box.style.paddingTop='12px';

      if (!data?.success) { box.innerHTML = `<p class="empty">검색 오류: ${esc(data?.message||'')}</p>`; return; }
      const { keyword, totalCount, results } = data;

      box.insertAdjacentHTML('beforeend',
        `<div class="results-head"><strong>"${esc(keyword)}"</strong> 검색 결과 <b>${totalCount}</b>건</div>`);

      if (!totalCount) { box.insertAdjacentHTML('beforeend','<p class="empty">일치하는 결과가 없습니다.</p>'); return; }

      const ul = document.createElement('ul');
      ul.className = 'result-list';
      ul.style.cssText = 'list-style: disc; padding-left: 20px; line-height: 1.7;';
      results.forEach(name => {
        const li = document.createElement('li');
        li.textContent = name;
        ul.appendChild(li);
      });
      box.appendChild(ul);
    }

    async function search() {
      const keyword = (input.value||'').trim();
      if (!keyword) { box.innerHTML=''; return; }
      box.innerHTML = '<p class="loading">검색 중…</p>';
      try{
        const resp = await fetch(`${API_BASE}/quick-search`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ keyword })
        });
        render(await resp.json());
      }catch{ render({success:false, message:'네트워크 오류'})}
    }

    btn?.addEventListener('click', search);
    input?.addEventListener('keydown', e => { if (e.key==='Enter') search(); });
  }

  // ========== 기술/분야: 상세 검색 ==========
  function initDetailed() {
    const select = document.getElementById('techSubCategory');

    async function search() {
      const keyword = (input.value||'').trim();
      const techSubCategory = select.value;

      if (!keyword && !techSubCategory) { window.location.href = './tech.html'; return; }

      if (box) box.innerHTML = '<p class="loading">검색 중…</p>';
      try{
        const resp = await fetch(`${API_BASE}/search`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ keyword, techSubCategory })
        });
        const data = await resp.json();
        if (!data.success) { alert('검색 실패: '+data.message); if (box) box.innerHTML=''; return; }
        localStorage.setItem('allTechData', JSON.stringify(data.results));
        localStorage.setItem('searchKeyword', keyword);
        localStorage.setItem('searchSubCategory', techSubCategory);
        window.location.href = './tech.html';
      }catch{
        alert('네트워크 오류');
        if (box) box.innerHTML='';
      }
    }

    btn?.addEventListener('click', search);
    input?.addEventListener('keydown', e => { if (e.key==='Enter'){ e.preventDefault(); search(); }});
  }

  if (isDetailedSearchPage) initDetailed(); else initQuick();
});
