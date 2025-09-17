(() => {
  // 1) DOM 생성
  const root = document.getElementById('ai-fab-root');
  if (!root) return;

  root.innerHTML = `
    <div id="ai-fab" aria-live="polite">
      <div id="ai-tip">궁금한 점을 AI에게 물어보세요.</div>
      <button id="ai-button" aria-label="AI에게 질문하기">
        <!-- 로컬 이미지: ./assets/ai-bot.png (원하는 아이콘으로 교체) -->
        <img src="./assets/ai-bot.png" alt="AI 도우미" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><circle cx=%2212%22 cy=%2212%22 r=%2210%22 fill=%22%230ea5e9%22/></svg>'">
      </button>
    </div>

    <div id="ai-overlay" role="dialog" aria-modal="true" aria-labelledby="ai-title">
      <section id="ai-panel">
        <header id="ai-header">
          <div id="ai-title">AI 분석 · 추천</div>
          <button id="ai-close">닫기</button>
        </header>
        <div id="ai-history"></div>
        <form id="ai-form">
          <textarea id="ai-input" placeholder="예) 이 기술의 산업 적용 시나리오를 3줄로 요약해줘"></textarea>
          <button id="ai-send" type="submit">보내기</button>
        </form>
      </section>
    </div>
  `;

  // 2) 상태
  const $overlay = document.getElementById('ai-overlay');
  const $open = document.getElementById('ai-button');
  const $close = document.getElementById('ai-close');
  const $history = document.getElementById('ai-history');
  const $form = document.getElementById('ai-form');
  const $input = document.getElementById('ai-input');

  const ctx = window.__innosearch_context || { page: 'home' };
  const messages = [
    {
      role: 'system',
      content:
        '너는 InnoSearch 웹의 기술 검색/상세 보조자다. 한국어로 간결하고 정확하게 답변한다. 모호하면 가정과 한계를 명시한다.'
    },
    {
      role: 'user',
      content:
        `[페이지 컨텍스트]\n` +
        Object.entries(ctx).map(([k,v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n')
    }
  ];

  // 3) 유틸
  function openModal() { $overlay.style.display = 'flex'; $input.focus(); }
  function closeModal() { $overlay.style.display = 'none'; }
  function appendMsg(role, text, cls='') {
    const div = document.createElement('div');
    div.className = `ai-msg ${role} ${cls}`;
    div.textContent = text;
    $history.appendChild(div);
    $history.scrollTop = $history.scrollHeight;
    return div;
  }

  // 4) 이벤트
  $open.addEventListener('click', openModal);
  $close.addEventListener('click', closeModal);
  $overlay.addEventListener('click', (e) => {
    if (e.target === $overlay) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if ($overlay.style.display === 'flex' && e.key === 'Escape') closeModal();
  });

  $form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userText = $input.value.trim();
    if (!userText) return;

    appendMsg('user', userText);
    $input.value = '';
    messages.push({ role: 'user', content: userText });

    const botDiv = appendMsg('bot', '생각을 정리하는 중...', 'loading');

    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ messages })
      });

      if (!resp.ok || !resp.body) {
        botDiv.textContent = '서버 응답에 문제가 있어요. 잠시 후 다시 시도해주세요.';
        botDiv.classList.remove('loading');
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let full = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream:true });
        full += chunk;
        botDiv.textContent = full;
      }
      botDiv.classList.remove('loading');
      messages.push({ role: 'assistant', content: full });
    } catch (err) {
      console.error(err);
      botDiv.textContent = '네트워크 오류가 발생했어요.';
      botDiv.classList.remove('loading');
    }
  });

  // 5) 페이지별 자동 프롬프트(선택)
  // 상세 페이지에 들어오면 요약 버튼 자동 제안 같은 것도 가능
  // 예: 상세 첫 오픈 시 자동으로 "이 기술 3줄 요약" 전송은 UX 선호에 따라 비활성
})();
