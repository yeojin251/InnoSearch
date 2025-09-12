document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(location.search);
  const name = params.get('name');

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  if (!name) {
    $('tech-name').textContent = '기술명을 찾을 수 없습니다.';
    $('tech-category').textContent = '';
    return;
  }

  try {
    const resp = await fetch(`/api/matching/tech-by-name?name=${encodeURIComponent(name)}`, { cache: 'no-store' });
    const data = await resp.json();
    if (!data.success) throw new Error(data.message || '상세 로드 실패');

    const row = data.tech || {};
    const events = data.events || [];

    const techName = row['기술명'] || name;
    $('tech-name').textContent = techName;
    $('tech-category').textContent =
      `${row['12대국가전략기술(대분류)'] || ''} > ${row['12대국가전략기술(소분류)'] || ''}`.replace(/^ > /, '').replace(/ > $/, '');
    $('invention').textContent = row['발명의 명칭'] || '-';
    $('org').textContent = row['기술보유기관'] || '-';

    const ul = $('events');
    const no = $('no-events');
    ul.innerHTML = '';
    if (events.length) {
      events.forEach(ev => {
        const li = document.createElement('li');
        const title = [ev['행사명'], ev['주관기관'] ? `(${ev['주관기관']})` : ''].join(' ');
        li.textContent = title;
        ul.appendChild(li);
      });
      no.style.display = 'none';
    } else {
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

    // --- 논문 검색 버튼 생성 로직 (추가) ---
    const paperSearchActions = $('paper-search-actions');
    const encodedTechName = encodeURIComponent(techName);

    // 검색할 논문 사이트 목록
    const searchEngines = {
      'Google Scholar': `https://scholar.google.com/scholar?q=${encodedTechName}`,
      'RISS': `http://www.riss.kr/search/Search.do?isDetailSearch=N&searchGubun=true&viewYn=OP&query=${encodedTechName}`,
      'DBpia': `https://www.dbpia.co.kr/search/topSearch?startCount=0&collection=ALL&searchField=ALL&sort=RANK&query=${encodedTechName}&prevQuery=${encodedTechName}`
    };

    // 각 사이트에 대한 버튼 생성
    for (const [engineName, url] of Object.entries(searchEngines)) {
      const button = document.createElement('a');
      button.href = url;
      button.textContent = `${engineName}에서 검색`;
      button.target = '_blank'; // 새 탭에서 열기
      button.className = 'btn'; // 버튼 스타일 적용
      paperSearchActions.appendChild(button);
    }
    // --- 로직 추가 끝 ---

  } catch (err) {
    console.error(err);
    $('tech-name').textContent = name;
    $('tech-category').textContent = '상세 정보를 불러오는 중 오류가 발생했습니다.';
  }
});