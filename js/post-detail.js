// js/post-detail.js
document.addEventListener('DOMContentLoaded', async () => {
    const postId = new URLSearchParams(window.location.search).get('id');
    if (!postId) {
        alert('잘못된 접근입니다.');
        window.location.href = '/board.html';
        return;
    }

    const postContainer = document.getElementById('post-container');
    const commentList = document.getElementById('comment-list');
    const commentForm = document.getElementById('comment-form');

    async function loadPostAndComments() {
        try {
            // 게시글과 댓글을 동시에 요청
            const [postRes, commentsRes] = await Promise.all([
                window.apiClient.get(`/board/posts/${postId}`),
                window.apiClient.get(`/board/posts/${postId}/comments`)
            ]);

            if (postRes.success) {
                renderPost(postRes.post);
            }
            if (commentsRes.success) {
                renderComments(commentsRes.comments);
            }
        } catch (error) {
            postContainer.innerHTML = `<p>게시글을 불러오는 중 오류가 발생했습니다.</p>`;
        }
    }

    function renderPost(post) {
        document.title = `${post.title} – InnoSearch`;
        postContainer.innerHTML = `
            <div id="post-header">
                <h1>${escapeHTML(post.title)}</h1>
                <div id="post-meta">
                    <span>작성자: ${escapeHTML(post.author)}</span> |
                    <span>작성일: ${new Date(post.created_at).toLocaleString()}</span>
                </div>
            </div>
            <div id="post-content">
                ${escapeHTML(post.content).replace(/\n/g, '<br>')}
            </div>
        `;
    }

    function renderComments(comments) {
        commentList.innerHTML = '';
        if (comments.length === 0) {
            commentList.innerHTML = '<p>작성된 댓글이 없습니다.</p>';
            return;
        }
        comments.forEach(comment => {
            const div = document.createElement('div');
            div.className = 'comment-item';
            div.innerHTML = `
                <div class="comment-meta">
                    <span class="comment-author">${escapeHTML(comment.author)}</span>
                    <span class="comment-date">${new Date(comment.created_at).toLocaleString()}</span>
                </div>
                <p class="comment-content">${escapeHTML(comment.content)}</p>
            `;
            commentList.appendChild(div);
        });
    }

    commentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!window.sessionManager || !window.sessionManager.isLoggedIn()) {
            alert('댓글을 작성하려면 로그인이 필요합니다.');
            return;
        }

        const contentInput = document.getElementById('comment-content');
        const content = contentInput.value.trim();
        if (!content) {
            alert('댓글 내용을 입력해주세요.');
            return;
        }

        try {
            const response = await window.apiClient.post(`/board/posts/${postId}/comments`, { content });
            if (response.success) {
                contentInput.value = '';
                loadPostAndComments(); // 댓글 목록 새로고침
            }
        } catch (error) {
            alert(error.message || '댓글 등록에 실패했습니다.');
        }
    });
    
    function escapeHTML(str) {
      return str.replace(/[&<>"']/g, match => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[match]);
    }

    loadPostAndComments();
});