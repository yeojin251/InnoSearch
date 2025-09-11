// public/js/tech-detail.js
document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(location.search);
  const name = params.get('name');

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '')
    .replaceAll('&','&amp;').replaceAll('<','&lt;')
    .replaceAll('>','&gt;').replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');

  if(!name){
    $('tech-name').textContent = '기술명을 찾을 수 없습니다.';
    $('tech-category').textContent = '';
    return;
  }

  try{
    const resp = await fetch(`/api/matching/tech-by-name?name=${encodeURIComponent(name)}`, { cache:'no-store' });
    const data = await resp.json();
    if(!data.success) throw new Error(data.message || '상세 로드 실패');

    const row = data.tech || {};
    const events = data.events || [];

    $('tech-name').textContent = row['기술명'] || name;
    $('tech-category').textContent =
      `${row['12대국가전략기술(대분류)'] || ''} > ${row['12대국가전략기술(소분류)'] || ''}`.replace(/^ > /,'').replace(/ > $/,'');
    $('invention').textContent = row['발명의 명칭'] || '-';
    $('org').textContent = row['기술보유기관'] || '-';

    const ul = $('events');
    const no = $('no-events');
    ul.innerHTML = '';
    if(events.length){
      events.forEach(ev => {
        const li = document.createElement('li');
        const title = [ev['행사명'], ev['주관기관'] ? `(${ev['주관기관']})` : ''].join(' ');
        li.textContent = title;
        ul.appendChild(li);
      });
      no.style.display = 'none';
    }else{
      no.style.display = 'block';
    }

    // CSV 전체 필드 렌더
    const grid = $('kv-grid');
    grid.innerHTML = '';
    Object.keys(row).forEach(k => {
      const keyEl = document.createElement('div');
      keyEl.className = 'key';
      keyEl.innerHTML = esc(k);

      const valEl = document.createElement('div');
      valEl.className = 'val';
      valEl.innerHTML = esc(row[k]);

      grid.appendChild(keyEl);
      grid.appendChild(valEl);
    });

  }catch(err){
    $('tech-name').textContent = name;
    $('tech-category').textContent = '상세 정보를 불러오는 중 오류가 발생했습니다.';
  }
});
