// 빠른 매칭 기능

class MatchingSystem {
  constructor() {
    this.init();
  }

  init() {
    this.setupEventListeners();
  }

  // 이벤트 리스너 설정
  setupEventListeners() {
    const matchBtn = document.getElementById('matchBtn');
    if (matchBtn) {
      matchBtn.addEventListener('click', () => this.handleSearch());
    }

    // Enter 키로 검색
    const keywordInput = document.getElementById('q');
    if (keywordInput) {
      keywordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.handleSearch();
        }
      });
    }
  }


  // 검색 실행
  async handleSearch() {
    const keywordInput = document.getElementById('q');
    const resultBox = document.getElementById('resultBox');

    if (!keywordInput || !resultBox) {
      console.error('필수 요소를 찾을 수 없습니다.');
      return;
    }

    const keyword = keywordInput.value.trim();

    if (!keyword) {
      resultBox.innerHTML = '<div class="error">검색 키워드를 입력해주세요.</div>';
      return;
    }

    // 로딩 표시
    resultBox.innerHTML = '<div class="loading">검색 중...</div>';

    try {
      const response = await window.apiClient.post('/matching/search', {
        keyword: keyword
      });

      if (response.success) {
        this.displayResults(response);
      } else {
        resultBox.innerHTML = `<div class="error">${response.message}</div>`;
      }
    } catch (error) {
      console.error('검색 오류:', error);
      resultBox.innerHTML = '<div class="error">검색 중 오류가 발생했습니다.</div>';
    }
  }

  // 검색 결과 표시
  displayResults(response) {
    const resultBox = document.getElementById('resultBox');
    
    if (!resultBox) return;

    const { keyword, totalCount, results } = response;

    if (totalCount === 0) {
      resultBox.innerHTML = `
        <div class="no-results">
          <h3>'${keyword}'에 대한 검색 결과가 없습니다.</h3>
          <p>다른 키워드로 검색해보세요.</p>
        </div>
      `;
      return;
    }

    let html = `
      <div class="search-results">
        <div class="results-header">
          <h3>'${keyword}' 검색 결과</h3>
          <p class="results-count">총 ${totalCount}개의 기술을 찾았습니다.</p>
        </div>
        <div class="results-list">
    `;

    results.forEach((result, index) => {
      html += `
        <div class="result-item">
          <div class="result-header">
            <h4 class="tech-name">${result.techName}</h4>
            <span class="source-badge ${result.source}">${result.source === 'tech_data1' ? '특구기술' : '일반기술'}</span>
          </div>
          <div class="result-details">
            ${result.inventionName && result.inventionName !== result.techName ? `<p class="invention-name"><strong>발명명:</strong> ${result.inventionName}</p>` : ''}
            ${result.organization ? `<p class="organization"><strong>기관:</strong> ${result.organization}</p>` : ''}
            ${result.applicationNumber ? `<p class="application"><strong>출원번호:</strong> ${result.applicationNumber}</p>` : ''}
          </div>
        </div>
      `;
    });

    html += `
        </div>
        ${totalCount > 50 ? `<p class="more-results">더 많은 결과가 있습니다. 검색 키워드를 더 구체적으로 입력해보세요.</p>` : ''}
      </div>
    `;

    resultBox.innerHTML = html;
  }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  new MatchingSystem();
});
