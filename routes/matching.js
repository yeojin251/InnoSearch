// routes/matching.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

const router = express.Router();

let techData1 = [];
let techData2 = [];
let csvLoaded = false;

function parseCSV(csvContent) {
  const text = csvContent.trim();
  if (!text) return [];
  const lines = text.split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    const row = {};
    headers.forEach((h, idx) => {
      let v = (values[idx] ?? '').trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      row[h] = v;
    });
    out.push(row);
  }
  return out;
}

function decodeFile(filepath) {
  const buf = fs.readFileSync(filepath);
  try {
    return iconv.decode(buf, 'euc-kr').replace(/\r/g, '');
  } catch {
    return buf.toString('utf8').replace(/\r/g, '');
  }
}

async function loadCSVData() {
  if (csvLoaded) return;
  const csv1 = decodeFile(path.join(__dirname, '../data/tech_data1.csv'));
  const csv2 = decodeFile(path.join(__dirname, '../data/tech_data2.csv'));
  techData1 = parseCSV(csv1);
  techData2 = parseCSV(csv2);
  csvLoaded = true;
  console.log('✅ CSV 로드 완료',
    `tech_data1=${techData1.length}`, `tech_data2=${techData2.length}`);
}
loadCSVData().catch(() => {});

const SUBCATEGORY_KEYS = [
  '12대국가전략기술(소분류)',
  '12대 국가전략기술(소분류)',
  '소분류', // 혹시 있을지도 모르는 변형
];

// 해당 row에서 소분류 값을 찾아 반환
function getSubcategory(row) {
  for (const k of SUBCATEGORY_KEYS) {
    if (k in row && String(row[k]).trim()) return String(row[k]).trim();
  }
  return '';
}

// ------------------ 홈 빠른 검색 (기술명만) ------------------
router.post('/quick-search', async (req, res) => {
  try {
    const { keyword } = req.body || {};
    if (!keyword || !keyword.trim()) {
      return res.status(400).json({ success: false, message: '검색 키워드를 입력해주세요.' });
    }
    await loadCSVData();

    const K = keyword.trim().toLowerCase();
    const names = new Set();
    const pick = (r) => {
      const nm = (r['기술명'] || '').trim();
      if (nm && nm.toLowerCase().includes(K)) names.add(nm);
    };
    techData1.forEach(pick);
    techData2.forEach(pick);

    res.json({ success: true, keyword: keyword.trim(), totalCount: names.size, results: [...names].slice(0, 100) });
  } catch (e) {
    console.error('quick-search 오류:', e);
    res.status(500).json({ success: false, message: '검색 중 오류가 발생했습니다.' });
  }
});

// ------------- 기술/분류 페이지 검색 (두 CSV 합산) -------------
router.post('/search', async (req, res) => {
  try {
    const { keyword = '', techSubCategory = '' } = req.body || {};
    if (!keyword && !techSubCategory) {
      return res.status(400).json({ success: false, message: '검색 키워드 또는 소분류를 입력해주세요.' });
    }
    await loadCSVData();

    const merged = [
      ...techData1.map(r => ({ source: 'tech_data1', row: r })),
      ...techData2.map(r => ({ source: 'tech_data2', row: r })),
    ];

    const K = keyword.trim().toLowerCase();
    const S = techSubCategory.trim();

    const hit = merged.filter(({ row }) => {
      const name = (row['기술명'] || '').toLowerCase();
      const sub = getSubcategory(row);
      const matchK = K ? name.includes(K) : true;
      const matchS = S ? sub === S : true;
      return matchK && matchS;
    });

    const results = hit.map(({ source, row }, i) => ({
      id: `${source}-${i}`,
      name: row['기술명'] || '(기술명 없음)',
      source,
      fields: row, // 상세에 그대로 사용
    })).sort((a, b) => a.name.localeCompare(b.name, 'ko'));

    res.json({ success: true, totalCount: results.length, results });
  } catch (e) {
    console.error('search 오류:', e);
    res.status(500).json({ success: false, message: '검색 중 오류가 발생했습니다.' });
  }
});

// ------------- 상세 페이지 (기술명으로 모두 모아보기) -------------
router.get('/detail', async (req, res) => {
  try {
    const name = (req.query.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: 'name 쿼리가 필요합니다.' });
    }
    await loadCSVData();

    const K = name.toLowerCase();
    const exactFirst = (a, b) =>
      (((b['기술명'] || '').toLowerCase() === K) - ((a['기술명'] || '').toLowerCase() === K));

    const from1 = techData1.filter(r => (r['기술명'] || '').toLowerCase().includes(K))
      .sort(exactFirst)
      .map(row => ({ source: 'tech_data1', row }));

    const from2 = techData2.filter(r => (r['기술명'] || '').toLowerCase().includes(K))
      .sort(exactFirst)
      .map(row => ({ source: 'tech_data2', row }));

    const hits = [...from1, ...from2];
    res.json({ success: true, name, total: hits.length, hits });
  } catch (e) {
    console.error('detail 오류:', e);
    res.status(500).json({ success: false, message: '상세 조회 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
