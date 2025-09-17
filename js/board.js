document.addEventListener('DOMContentLoaded', async () => {
  await window.sessionManager.initPromise;

  const postListBody = document.getElementById('post-list');
  const newPostBtn = document.getElementById('newPostBtn');
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  let allPosts = [];

  async function loadPosts() {
    try {
      const data = await window.apiClient.get('/board/posts');
      if (data.success) {
        allPosts = data.posts;
        renderPosts(allPosts);
      } else {
        showError('게시글을 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    }
  }

  function renderPosts(posts) {
    postListBody.innerHTML = '';
    if (!posts || posts.length === 0) {
      postListBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 24px;">결과가 없습니다.</td></tr>`;
      return;
    }

    posts.forEach(post => {
      const tr = document.createElement('tr');
      tr.dataset.postId = post.id;
      tr.innerHTML = `
        <td class="col-no">${post.id}</td>
        <td class="col-title">${escapeHTML(post.title)}</td>
        <td class="col-author">
          <a href="#" class="profile-link" data-user-id="${post.author_id}" onclick="event.stopPropagation()">
            ${escapeHTML(post.author || '')}
          </a>
        </td>
        <td class="col-date">${new Date(post.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</td>
      `;
      tr.addEventListener('click', () => {
        window.location.href = `/post-detail.html?id=${post.id}`;
      });
      postListBody.appendChild(tr);
    });
  }

  function handleSearch() {
    const searchTerm = (searchInput.value || '').toLowerCase();
    if (!searchTerm) return renderPosts(allPosts);
    const filteredPosts = allPosts.filter(post =>
      (post.title || '').toLowerCase().includes(searchTerm)
    );
    renderPosts(filteredPosts);
  }

  function showError(message) {
    postListBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 24px;">${message}</td></tr>`;
  }

  if (newPostBtn) {
    newPostBtn.addEventListener('click', () => {
      if (window.sessionManager && window.sessionManager.isLoggedIn()) {
        window.location.href = '/new-post.html';
      } else {
        alert('로그인이 필요합니다.');
        window.location.href = '/login.html';
      }
    });
  }

  searchBtn.addEventListener('click', handleSearch);
  searchInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') handleSearch();
  });

  function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"']/g, (match) => {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[match];
    });
  }

  // 작성자 이름 클릭 → 프로필 팝업
  postListBody.addEventListener('click', (e) => {
    const a = e.target.closest('.profile-link');
    if (!a) return;
    e.preventDefault();
    const uid = a.getAttribute('data-user-id');
    if (uid) window.openProfileModal(Number(uid));
  });

  await loadPosts();
});
