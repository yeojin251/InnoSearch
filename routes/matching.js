// routes/matching.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

const router = express.Router();

// ====== 메모리 캐시 ======
let techData1 = [];
let techData2 = [];
let csvLoaded = false;

// ====== CSV 파서 ======
function parseCSV(csvContent) {
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const results = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;

    // 따옴표 안의 콤마는 분리하지 않도록 정규식 사용
    const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    const row = {};
    headers.forEach((header, index) => {
      let value = (values[index] ?? '').trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      row[header] = value;
    });
    results.push(row);
  }
  return results;
}

// ====== CSV 로더 (EUC-KR) ======
async function loadCSVData() {
  if (csvLoaded) return; // 이미 로드됨
  try {
    const decodeFile = (filePath) => {
      const buffer = fs.readFileSync(filePath);
      // 파일 인코딩이 EUC-KR 이라 가정
      return iconv.decode(buffer, 'euc-kr').replace(/\r/g, '');
    };

    const csv1Path = path.join(__dirname, '../data/tech_data1.csv');
    const csv2Path = path.join(__dirname, '../data/tech_data2.csv');

    const csv1 = decodeFile(csv1Path);
    const csv2 = decodeFile(csv2Path);

    techData1 = parseCSV(csv1);
    techData2 = parseCSV(csv2);

    csvLoaded = true;
    console.log(`✅ tech_data1.csv: ${techData1.length}개 | tech_data2.csv: ${techData2.length}개 로드`);
  } catch (err) {
    console.error('❌ CSV 파일 로드 실패:', err);
    throw err;
  }
}

// 서버 구동 시점에 미리 로드 (실패해도 서버는 뜨게 하고, 첫 요청 시 재시도)
loadCSVData().catch(() => {
  console.warn('⚠️ 서버는 실행되지만 CSV 로드는 실패. 첫 요청에서 다시 시도합니다.');
});

// ====== 검색 로직 ======
function searchTechnologies(keyword) {
  const K = keyword.toLowerCase();
  const out = new Set();

  const pushIfMatch = (item) => {
    const name = (item['기술명'] || '').trim();
    if (!name) return;
    if (name.toLowerCase().includes(K)) out.add(name);
  };

  techData1.forEach(pushIfMatch);
  techData2.forEach(pushIfMatch);

  return Array.from(out);
}

// ====== API ======
router.post('/search', async (req, res) => {
  try {
    const { keyword } = req.body || {};
    if (!keyword || !keyword.trim()) {
      return res.status(400).json({ success: false, message: '검색 키워드를 입력해주세요.' });
    }

    if (!csvLoaded) {
      await loadCSVData(); // 첫 요청에서 재시도
    }

    const results = searchTechnologies(keyword.trim());
    return res.json({
      success: true,
      keyword: keyword.trim(),
      totalCount: results.length,
      results: results.slice(0, 50) // 필요 시 늘리기 가능
    });
  } catch (error) {
    console.error('기술 검색 오류:', error);
    return res.status(500).json({ success: false, message: '검색 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
