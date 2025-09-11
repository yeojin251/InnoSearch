// public/js/tech.js
document.addEventListener('DOMContentLoaded', () => {
  const techDetailsContainer = document.getElementById('tech-details-container');
  const techListContainer = document.getElementById('tech-list-container');

  const esc = (s)=> String(s)
    .replaceAll('&','&amp;').replaceAll('<','&lt;')
    .replaceAll('>','&gt;').replaceAll('"','&quot;')
    .replaceAll("'","&#39;");

  function renderTechDetails(item) {
    if (!item) { techDetailsContainer.innerHTML = '<p>기술 정보를 찾을 수 없습니다.</p>'; return; }

    const eventsHtml = (item.events?.length)
      ? `<h4>📝 연관 행사 및 지원사업</h4>
         <ul>${item.events.map(ev=>`<li>${esc(ev['행사명']||'')}${ev['주관기관']?` (${esc(ev['주관기관'])})`:''}</li>`).join('')}</ul>`
      : '<p>연관된 행사가 없습니다.</p>';

    techDetailsContainer.innerHTML = `
      <div class="tech-detail-card">
        <h2>${esc(item.name)}</h2>
        <p><strong>소속 기관:</strong> ${esc(item.organization||'')}</p>
        <p><strong>발명의 명칭:</strong> ${esc(item.inventionName||'')}</p>
        <p><strong>기술 분류:</strong> ${esc(item.category||'')}</p>
        <hr/>
        ${eventsHtml}
      </div>`;
  }

  function renderTechList(allTech, current) {
    techListContainer.innerHTML = '';
    allTech.forEach(it=>{
      const li = document.createElement('li');
      li.textContent = it.name;
      if (current && it.name === current.name) li.classList.add('active');
      li.addEventListener('click', ()=>{
        renderTechDetails(it);
        renderTechList(allTech, it);
      });
      techListContainer.appendChild(li);
    });
  }

  try{
    const allTechData = JSON.parse(localStorage.getItem('allTechData') || '[]');
    const selectedTech = JSON.parse(localStorage.getItem('selectedTech') || 'null');

    if (!allTechData.length) {
      techDetailsContainer.innerHTML = '<p>기술 정보를 찾을 수 없습니다. 검색 페이지에서 다시 시도해주세요.</p>';
      return;
    }
    const initial = selectedTech || allTechData[0];
    renderTechDetails(initial);
    renderTechList(allTechData, initial);
  }catch(e){
    console.error('데이터 오류', e);
    techDetailsContainer.innerHTML = '<p>데이터를 불러오는 중 오류가 발생했습니다.</p>';
  }
});
