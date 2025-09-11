document.addEventListener('DOMContentLoaded', () => {
  
  // === 최신 리포트 데이터 (수정본) ===
  const reportData = [
    {
      imgSrc: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1200&auto=format&fit=crop",
      altText: "컨퍼런스 및 행사 일정",
      labels: [
        { text: "행사일정", class: "hot" },
        { text: "교육일정", class: "green" }
      ],
      title: "연구개발특구 행사일정",
      description: "연구개발특구 행사일정을 기간/키워드로 필터링해서 볼 수 있어요.",
      date: "2025-09-11",
      linkUrl: "./events.html",  // ✅ CSV 테이블 뷰 페이지로 연결
      linkText: "전체 일정 보기"
    },
    {
      imgSrc: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1200&auto=format&fit=crop",
      altText: "리플렛 이미지",
      labels: [
        { text: "아카이브", class: "blue" }
      ],
      title: "대덕연구개발특구 50주년 리플렛",
      description: "대덕특구 성과와 대표 성공사례를 담은 기념 리플렛입니다.",
      date: "2023-10-25",
      linkUrl: "./data/leaflet.pdf",
      linkText: "리플렛 보기"
    },
    {
      imgSrc: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=1200&auto=format&fit=crop",
      altText: "기업 협업 이미지",
      labels: [
        { text: "연구소기업", class: "purple" }
      ],
      title: "연구소 기업 소개",
      description: "공공연구성과를 사업화하는 연구소기업들을 공식 사이트에서 확인하세요.",
      date: "2025-09-11",
      linkUrl: "https://www.innopolis.or.kr/board?menuId=MENU00312&siteId=null",
      linkText: "더 알아보기"
    }
  ];

  // === 리포트 카드를 동적으로 생성하고 페이지에 추가하는 함수 ===
  function renderReportCards() {
    const container = document.getElementById('report-cards-container');
    if (!container) return;

    reportData.forEach(item => {
      const labelsHtml = item.labels.map(label => 
        `<span class="label ${label.class}">${label.text}</span>`
      ).join('');

      const cardHtml = `
        <article class="card" style="cursor: pointer;" onclick="window.open('${item.linkUrl}', '_blank', 'noopener')">
          <img class="thumb" src="${item.imgSrc}" alt="${item.altText}">
          <div class="card-body">
            <div class="label-wrap">
              ${labelsHtml}
            </div>
            <h3 class="card-title">${item.title}</h3>
            <p class="card-desc">${item.description}</p>
            <div class="meta">
              <time datetime="${item.date}">${item.date}</time>
              <a href="${item.linkUrl}" class="text-btn" target="_blank" rel="noopener noreferrer">${item.linkText}</a>
            </div>
          </div>
        </article>
      `;
      container.insertAdjacentHTML('beforeend', cardHtml);
    });
  }

  // === 트렌드 태그를 뉴스 검색으로 연결 ===
  function setupTrendTags() {
    document.querySelectorAll('.tag-list .tag').forEach(tag => {
      const text = tag.textContent.trim();
      const url = "https://news.google.com/search?q=" + encodeURIComponent(text);
      tag.setAttribute('href', url);
      tag.setAttribute('target', '_blank');
      tag.setAttribute('rel', 'noopener noreferrer');
    });
  }

  // --- 페이지 로드 시 함수 실행 ---
  renderReportCards();
  setupTrendTags();
});