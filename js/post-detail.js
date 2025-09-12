// public/js/post-detail.js
document.addEventListener('DOMContentLoaded', async () => {
  // 세션은 실패해도 진행 (initPromise는 reject되지 않도록 구성되어 있어야 함)
  await window.sessionManager.initPromise;

  const postContainer = document.getElementById('post-container');
  const commentsWrap  = document.getElementById('comment-list');   // 리스트 영역 (DIV)
  const commentForm   = document.getElementById('comment-form');
  const commentInput  = document.getElementById('comment-content'); // <textarea id="comment-content">

  const url = new URL(window.location.href);
  const id = Number(url.searchParams.get('id'));
  if (!id) {
    renderPostError('잘못된 접근입니다. (id 없음)');
    return;
  }

  // 안전한 HTML 이스케이프
  function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function renderPost(post) {
  postContainer.innerHTML = `
    <article class="post-card">
      <div id="post-header">
        <h1></h1>
        <div id="post-meta"></div>
      </div>
      <pre id="post-content" style="white-space:pre-wrap;"></pre>
    </article>
  `;
  const titleEl   = postContainer.querySelector('#post-header h1');
  const metaEl    = postContainer.querySelector('#post-meta');
  const contentEl = postContainer.querySelector('#post-content');

  titleEl.textContent   = post.title ?? '(제목 없음)';
  metaEl.textContent    = `${post.author || '익명'} · ${new Date(post.created_at).toLocaleString()}`;
  contentEl.textContent = post.content || '';
}

  function renderPostError(msg) {
    postContainer.innerHTML = `
      <article class="post-card">
        <h1 class="post-title">오류</h1>
        <div class="post-content" style="color:#b00;">${escapeHTML(msg)}</div>
      </article>
    `;
  }

  async function loadPost() {
    const detail = await window.apiClient.get(`/board/posts/${id}`);
    if (!detail?.success || !detail?.post) {
      renderPostError('게시글을 찾을 수 없습니다.');
      return null;
    }
    renderPost(detail.post);
    return detail.post;
  }

  async function loadComments() {
    try {
      const r = await window.apiClient.get(`/board/posts/${id}/comments`);
      const list = r?.comments || [];
      if (list.length === 0) {
        commentsWrap.innerHTML = `<div class="comment-empty">댓글이 없습니다.</div>`;
        return;
      }
      commentsWrap.innerHTML = list.map(c => `
        <div class="comment-item">
          <div class="comment-head">
            <span class="comment-author">${escapeHTML(c.anonLabel || '익명')}</span>
            <span class="comment-date">${new Date(c.created_at).toLocaleString()}</span>
          </div>
          <div class="comment-body">${escapeHTML(c.content)}</div>
        </div>
      `).join('');
    } catch (e) {
      console.error('댓글 로드 오류:', e);
      commentsWrap.innerHTML = `<div class="comment-error">댓글을 불러올 수 없습니다.</div>`;
    }
  }

  // 초기 로드
  try {
    const post = await loadPost();
    if (post) await loadComments();
  } catch (err) {
    console.error('상세 로드 오류:', err);
    renderPostError('상세 정보를 불러오는 중 오류가 발생했습니다.');
  }

  // 댓글 작성
  if (commentForm) {
    commentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!window.sessionManager.isLoggedIn()) {
        alert('로그인이 필요합니다.');
        location.href = '/login.html';
        return;
      }
      const content = (commentInput?.value || '').trim();
      if (!content) return;

      try {
        const r = await window.apiClient.post(`/board/posts/${id}/comments`, { content });
        if (r?.success) {
          commentInput.value = '';
          await loadComments();
        } else {
          alert(r?.message || '댓글 작성 실패');
        }
      } catch (err) {
        console.error('댓글 작성 오류:', err);
        alert('댓글 작성 중 오류가 발생했습니다.');
      }
    });
  }
});
