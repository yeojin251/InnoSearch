// js/new-post.js

// DOM 로드 후 바로 비동기 함수 실행
document.addEventListener('DOMContentLoaded', async () => {
    // 세션 초기화가 완료될 때까지 기다림
    await window.sessionManager.initPromise;

    // 로그인 안 했으면 튕겨내기
    if (!window.sessionManager || !window.sessionManager.isLoggedIn()) {
        alert('로그인이 필요합니다.');
        window.location.href = '/login.html';
        return;
    }

    const form = document.getElementById('newPostForm');
    const cancelBtn = document.getElementById('cancelBtn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('postTitle').value;
        const content = document.getElementById('postContent').value;

        if (!title.trim() || !content.trim()) {
            alert('제목과 내용을 모두 입력해주세요.');
            return;
        }

        try {
            const response = await window.apiClient.post('/board/posts', { title, content });
            if (response.success) {
                alert('게시글이 등록되었습니다.');
                window.location.href = `/post-detail.html?id=${response.postId}`;
            }
        } catch (error) {
            alert(error.message || '게시글 등록에 실패했습니다.');
        }
    });

    cancelBtn.addEventListener('click', () => {
        if (confirm('작성을 취소하시겠습니까?')) {
            window.location.href = '/board.html';
        }
    });
});