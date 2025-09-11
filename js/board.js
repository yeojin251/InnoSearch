// js/board.js

document.addEventListener('DOMContentLoaded', async () => {
    // 세션 초기화가 완료될 때까지 기다림
    await window.sessionManager.initPromise;

    const postListBody = document.getElementById('post-list');
    const newPostBtn = document.getElementById('newPostBtn');
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    let allPosts = [];

    // 게시글 목록 로드 및 렌더링
    async function loadPosts() {
        try {
            const data = await window.apiClient.get('/board/posts');
            if (data.success) {
                allPosts = data.posts; // 전체 데이터 저장
                renderPosts(allPosts); // 전체 렌더링
            } else {
                showError('게시글을 불러오는데 실패했습니다.');
            }
        } catch (error) {
            console.error('Error fetching posts:', error);
        }
    }

    // 게시글 목록을 테이블에 렌더링
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
                <td class="col-author">${escapeHTML(post.author)}</td>
                <td class="col-date">${new Date(post.created_at).toLocaleDateString()}</td>
            `;
            tr.addEventListener('click', () => {
                window.location.href = `/post-detail.html?id=${post.id}`;
            });
            postListBody.appendChild(tr);
        });
    }
    
    // 검색 기능
    function handleSearch() {
        const searchTerm = searchInput.value.toLowerCase();
        if (!searchTerm) {
            renderPosts(allPosts);
            return;
        }
        const filteredPosts = allPosts.filter(post => 
            post.title.toLowerCase().includes(searchTerm)
        );
        renderPosts(filteredPosts);
    }

    // 오류 메시지 표시
    function showError(message) {
        postListBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 24px;">${message}</td></tr>`;
    }

    // '새 글 작성' 버튼 이벤트
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
    
    // 검색 이벤트 리스너
    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });

    // HTML 태그를 안전하게 처리하는 헬퍼 함수
    function escapeHTML(str) {
      if(typeof str !== 'string') return '';
      return str.replace(/[&<>"']/g, (match) => {
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[match];
      });
    }

    // 초기 데이터 로드
    await loadPosts();
});