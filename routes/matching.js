const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// CSV 데이터를 메모리에 캐시
let techData1 = [];
let techData2 = [];

// CSV 파싱 함수
function parseCSV(csvContent) {
  const lines = csvContent.split('\n');
  const headers = lines[0].split(',');
  const results = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim()) {
      const values = lines[i].split(',');
      const row = {};
      headers.forEach((header, index) => {
        row[header.trim()] = values[index] ? values[index].trim() : '';
      });
      results.push(row);
    }
  }
  
  return results;
}

// CSV 파일 로드 함수
function loadCSVData() {
  try {
    // tech_data1.csv 로드
    const csv1Content = fs.readFileSync(path.join(__dirname, '../tech_data1.csv'), 'utf8');
    techData1 = parseCSV(csv1Content);
    console.log(`✅ tech_data1.csv 로드 완료: ${techData1.length}개 항목`);
    
    // tech_data2.csv 로드
    const csv2Content = fs.readFileSync(path.join(__dirname, '../tech_data2.csv'), 'utf8');
    techData2 = parseCSV(csv2Content);
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
  
  // tech_data1에서 검색
  techData1.forEach((item, index) => {
    const techName = item['기술명'] || '';
    
    // 키워드가 기술명에 포함되어 있는지 검색
    if (techName.includes(keyword)) {
      results.push({
        id: `tech1_${index}`,
        source: 'tech_data1',
        techName: techName,
        inventionName: item['발명의 명칭'] || '',
        category: item['12대국가전략기술(대분류)'] || '',
        subCategory: item['12대국가전략기술(소분류)'] || '',
        region: item['특구 구분'] || '',
        organization: item['기술보유기관'] || '',
        applicationNumber: item['출원번호'] || '',
        registrationNumber: item['등록번호'] || '',
        maturity: item['기술성숙도'] || ''
      });
    }
  });
  
  // tech_data2에서 검색
  techData2.forEach((item, index) => {
    const techName = item['기술명'] || '';
    
    // 키워드가 기술명에 포함되어 있는지 검색
    if (techName.includes(keyword)) {
      results.push({
        id: `tech2_${index}`,
        source: 'tech_data2',
        techName: techName,
        inventionName: techName, // tech_data2에는 발명의 명칭이 없으므로 기술명 사용
        category: '',
        subCategory: '',
        region: '',
        organization: '',
        applicationNumber: item['특허 출원번호'] || '',
        registrationNumber: '',
        maturity: ''
      });
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
      results: results.slice(0, 50) // 최대 50개 결과 반환
    });
    
  } catch (error) {
    console.error('기술 검색 오류:', error);
    res.status(500).json({
      success: false,
      message: '검색 중 오류가 발생했습니다.'
    });
  }
});


// CSV 데이터 초기화 (에러 처리 개선)
loadCSVData().catch(error => {
  console.error('CSV 데이터 로드 실패:', error);
  // CSV 로드 실패해도 서버는 계속 실행
  techData1 = [];
  techData2 = [];
});

module.exports = router;
