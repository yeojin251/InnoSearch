// routes/board.js
const express = require('express');
const router = express.Router();
const { requireAuthAPI } = require('../middleware/requireAuth');
const { boardQueries } = require('../db/db');

// 게시글 목록
router.get('/posts', (req, res) => {
  try {
    const posts = boardQueries.getAllPosts();
    res.json({ success: true, posts });
  } catch (error) {
    console.error('게시글 목록 조회 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// 새 게시글 작성
router.post('/posts', requireAuthAPI, (req, res) => {
  const { title, content } = req.body;
  const userId = req.session.userId;

  if (!title || !content) {
    return res.status(400).json({ success: false, message: '제목과 내용을 모두 입력해주세요.' });
  }

  try {
    const result = boardQueries.createPost(title, content, userId);
    res.status(201).json({
      success: true,
      message: '게시글이 성공적으로 작성되었습니다.',
      postId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('게시글 작성 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// 게시글 상세
router.get('/posts/:id', (req, res) => {
  try {
    const post = boardQueries.findPostById(req.params.id);
    if (post) {
      res.json({ success: true, post });
    } else {
      res.status(404).json({ success: false, message: '게시글을 찾을 수 없습니다.' });
    }
  } catch (error) {
    console.error('게시글 상세 조회 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// 댓글 목록 (표시 이름 포함)
router.get('/posts/:id/comments', (req, res) => {
  try {
    const comments = boardQueries.getCommentsByPostId(req.params.id).map(c => ({
      id: c.id,
      post_id: c.post_id,
      user_id: c.user_id,
      content: c.content,
      created_at: c.created_at,
      display_name: c.display_name
    }));
    res.json({ success: true, comments });
  } catch (error) {
    console.error('댓글 목록 조회 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// 새 댓글 작성 (익명제 폐지)
router.post('/posts/:id/comments', requireAuthAPI, (req, res) => {
  const { content } = req.body;
  const postId = req.params.id;
  const userId = req.session.userId;

  if (!content || !content.trim()) {
    return res.status(400).json({ success: false, message: '댓글 내용을 입력해주세요.' });
  }

  try {
    const r = boardQueries.createComment(postId, userId, content.trim());
    res.status(201).json({
      success: true,
      message: '댓글이 성공적으로 작성되었습니다.',
      comment_id: r.lastInsertRowid
    });
  } catch (error) {
    console.error('댓글 작성 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
