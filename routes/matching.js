const express = require('express');
const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

const router = express.Router();

// CSV 데이터를 메모리에 캐시
let techData1 = [];
let techData2 = [];

// CSV 파싱 함수
function parseCSV(csvContent) {
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const results = [];

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim()) {
      const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      const row = {};
      headers.forEach((header, index) => {
        if (values[index]) {
          let value = values[index].trim();
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1);
          }
          row[header] = value;
        } else {
          row[header] = '';
        }
      });
      results.push(row);
    }
  }
  return results;
}

// CSV 파일 로드 함수 (iconv-lite 적용)
function loadCSVData() {
  try {
    // cleanContent 함수 오타 수정
    const cleanContent = (content) => {
      return content.replace(/\r/g, '');
    };

    const decodeFile = (filePath) => {
      const buffer = fs.readFileSync(filePath);
      return iconv.decode(buffer, 'euc-kr');
    };

    let csv1Content = decodeFile(path.join(__dirname, '../data/tech_data1.csv'));
    techData1 = parseCSV(cleanContent(csv1Content));
    console.log(`✅ tech_data1.csv 로드 완료: ${techData1.length}개 항목`);

    let csv2Content = decodeFile(path.join(__dirname, '../data/tech_data2.csv'));
    techData2 = parseCSV(cleanContent(csv2Content));
    console.log(`✅ tech_data2.csv 로드 완료: ${techData2.length}개 항목`);

    return Promise.resolve();
  } catch (error) {
    console.error('CSV 파일 로드 실패:', error);
    return Promise.reject(error);
  }
}


// 기술 검색 함수
function searchTechnologies(keyword) {
  const results = [];

  techData1.forEach((item) => {
    const techName = item['기술명'] || '';
    if (techName.includes(keyword)) {
      results.push(techName);
    }
  });

  techData2.forEach((item) => {
    const techName = item['기술명'] || '';
    if (techName.includes(keyword)) {
      results.push(techName);
    }
  });

  return results;
}

// 빠른 매칭 API
router.post('/search', (req, res) => {
  try {
    const { keyword } = req.body;
    if (!keyword || keyword.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: '검색 키워드를 입력해주세요.'
      });
    }
    const results = searchTechnologies(keyword.trim());
    res.json({
      success: true,
      keyword: keyword.trim(),
      totalCount: results.length,
      results: results.slice(0, 50) // 필요시 더 늘릴 수 있음
    });
  } catch (error) {
    console.error('기술 검색 오류:', error);
    res.status(500).json({
      success: false,
      message: '검색 중 오류가 발생했습니다.'
    });
  }
});

module.exports = router;