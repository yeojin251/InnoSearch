document.addEventListener('DOMContentLoaded', () => {
  // === 외부 뉴스로 연결: 리포트 카드 ===
  document.querySelectorAll('.cards article.card').forEach(card => {
    const titleEl = card.querySelector('.card-title');
    const actionLink = card.querySelector('a.text-btn');
    if (!titleEl || !actionLink) return;

    // 리포트 제목으로 Google 뉴스 검색 URL 생성
    const title = titleEl.textContent.trim();
    const url = "https://news.google.com/search?q=" + encodeURIComponent(title);

    // 버튼을 뉴스 검색으로 연결
    actionLink.setAttribute('href', url);
    actionLink.setAttribute('target', '_blank');
    actionLink.setAttribute('rel', 'noopener noreferrer');

    // 카드 아무 곳이나 클릭해도 동일한 URL 새 탭으로 열기
    card.style.cursor = 'pointer';
    card.onclick = (e) => {
      if (e.target.closest('a')) return; // 앵커 자체 클릭 시 중복 방지
      window.open(url, '_blank', 'noopener');
    };
  });

    // === 트렌드 태그도 뉴스 검색으로 연결 ===
  document.querySelectorAll('.tag-list .tag').forEach(tag => {
    const text = tag.textContent.trim();
    const url = "https://news.google.com/search?q=" + encodeURIComponent(text);
    tag.setAttribute('href', url);
    tag.setAttribute('target', '_blank');
    tag.setAttribute('rel', 'noopener noreferrer');
  });
});
