// routes/events.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

const router = express.Router();

// ✅ 네 CSV 실제 파일명으로 맞추세요
const CSV_PATH = path.join(__dirname, '../data/event_data.csv');

// 간단 CSV 파서(따옴표/콤마 안전)
function parseCSV(csv) {
  const lines = csv.replace(/\r/g, '').split('\n').filter(Boolean);
  if (!lines.length) return { headers: [], rows: [] };

  const split = (line) => {
    const out = [];
    let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { q = !q; continue; }
      if (c === ',' && !q) { out.push(cur); cur = ''; continue; }
      cur += c;
    }
    out.push(cur);
    return out.map(s => s.trim().replace(/^"(.*)"$/, '$1'));
  };

  const headers = split(lines[0]);
  const rows = lines.slice(1).map(l => {
    const cells = split(l);
    const obj = {};
    headers.forEach((h, i) => (obj[h] = (cells[i] ?? '').trim()));
    return obj;
  });
  return { headers, rows };
}

// 컬럼 자동 매핑
const CAND = {
  dateStart: ['행사기간-시작일', '시작일', '일자', 'Date', 'date'],
  title:     ['행사명', '제목', 'Title', 'title'],
  venue:     ['행사장소', '장소', 'Venue', 'venue'],
  org:       ['주관기관명', '주최', '주관', 'Organizer', 'organizer'],
  region:    ['행사지역', '특구', '지역', 'Region', 'region'],
};
const pick = (headers, arr) => arr.find(k => headers.includes(k));

function toDate(s) {
  if (!s) return null;
  const t = String(s).replace(/[.\s]/g, '-').replace(/[^0-9-]/g, '');
  const m = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return isNaN(d) ? null : d;
}

// 메모리 캐시
let cache = null;
function loadData() {
  if (cache) return cache;
  // ⚠️ CSV가 CP949인 경우가 많음. iconv-lite로 안전하게 디코딩.
  const buf = fs.readFileSync(CSV_PATH);
  const text = iconv.decode(buf, 'cp949'); // 'euc-kr'로도 시도 가능
  const { headers, rows } = parseCSV(text);

  const cols = {
    dateStart: pick(headers, CAND.dateStart),
    title:     pick(headers, CAND.title)     || headers[0],
    venue:     pick(headers, CAND.venue),
    org:       pick(headers, CAND.org),
    region:    pick(headers, CAND.region)    || headers[1],
  };

  const regions = Array.from(new Set(
    rows.map(r => (r[cols.region] || '').trim()).filter(Boolean)
  )).sort((a, b) => a.localeCompare(b, 'ko'));

  cache = { headers, rows, cols, regions };
  return cache;
}

// GET /api/events?region=대전&page=1&pageSize=20&sort=dateAsc&q=키워드
router.get('/', (req, res) => {
  try {
    const { headers, rows, cols, regions } = loadData();

    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const pageSize = Math.min(200, Math.max(5, parseInt(req.query.pageSize || '20', 10)));
    const region = (req.query.region || '전체').trim();
    const sort = (req.query.sort || 'dateAsc').trim();
    const q = (req.query.q || '').trim().toLowerCase();

    // 필터링
    let filtered = rows.filter(r => {
      const okRegion = region === '전체' ? true : ((r[cols.region] || '').trim() === region);
      const okSearch = !q ? true : Object.values(r).some(v => String(v || '').toLowerCase().includes(q));
      return okRegion && okSearch;
    });

    // 정렬
    if (sort === 'dateAsc' && cols.dateStart) filtered.sort((a,b)=> (toDate(a[cols.dateStart])||0) - (toDate(b[cols.dateStart])||0));
    if (sort === 'dateDesc' && cols.dateStart) filtered.sort((a,b)=> (toDate(b[cols.dateStart])||0) - (toDate(a[cols.dateStart])||0));
    if (sort === 'titleAsc' && cols.title)     filtered.sort((a,b)=> (a[cols.title]||'').localeCompare(b[cols.title]||''));
    if (sort === 'titleDesc' && cols.title)    filtered.sort((a,b)=> (b[cols.title]||'').localeCompare(a[cols.title]||''));

    // 페이지네이션
    const totalCount = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const start = (page - 1) * pageSize;
    const pageRows = filtered.slice(start, start + pageSize);

    // 보여줄 컬럼(보기 좋게 정렬)
    const viewHeaders = [cols.dateStart, cols.title, cols.venue, cols.org, cols.region].filter(Boolean);

    // 페이지 결과만 축약해서 전달
    const rowsSlim = pageRows.map(r => {
      const obj = {};
      viewHeaders.forEach(h => (obj[h] = r[h] || ''));
      return obj;
    });

    res.json({
      success: true,
      headers: viewHeaders,
      cols,
      regions,
      region,
      sort,
      page,
      pageSize,
      totalCount,
      totalPages,
      rows: rowsSlim,
    });
  } catch (e) {
    console.error('events route error:', e);
    res.status(500).json({ success: false, message: '이벤트 데이터를 불러오지 못했습니다.' });
  }
});

module.exports = router;
