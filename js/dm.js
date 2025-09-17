// routes/dm.js
const express = require('express');
const router = express.Router();
const { chatQueries, getDatabase } = require('../db/db');
const { requireAuthAPI } = require('../middleware/requireAuth');

/**
 * 채팅방 열기(없으면 생성, 있으면 재사용)
 * POST /api/dm/open  body: { otherUserId }
 */
router.post('/open', requireAuthAPI, (req, res) => {
  try {
    const me = req.session.userId;
    const other = Number(req.body.otherUserId);
    if (!other || other === me) {
      return res.status(400).json({ success: false, message: '상대 사용자 ID가 올바르지 않습니다.' });
    }
    const threadId = chatQueries.openThread(me, other);
    return res.json({ success: true, threadId });
  } catch (e) {
    console.error('POST /dm/open error:', e);
    return res.status(500).json({ success: false, message: '채팅방 생성 중 오류가 발생했습니다.' });
  }
});

/**
 * 내 채팅방 목록
 * GET /api/dm/list
 * peer_name, last_message, last_at 포함
 */
router.get('/list', requireAuthAPI, (req, res) => {
  try {
    const db = getDatabase();
    const me = req.session.userId;

    const threads = chatQueries.listMyThreads(me);
    const out = threads.map(t => {
      const peerId = (t.user_a === me) ? t.user_b : t.user_a;
      // 표시 이름(닉네임/이름 규칙)
      const peer = db.prepare(`
        SELECT CASE WHEN show_nickname = 1 THEN nickname ELSE name END AS display_name
        FROM users WHERE id = ?
      `).get(peerId);

      const last = db.prepare(`
        SELECT body, created_at FROM chat_messages 
        WHERE thread_id = ? ORDER BY created_at DESC, id DESC LIMIT 1
      `).get(t.id);

      return {
        thread_id: t.id,
        peer_id: peerId,
        peer_name: peer ? peer.display_name : '사용자',
        last_message: last ? last.body : null,
        last_at: last ? last.created_at : t.updated_at
      };
    });

    return res.json({ success: true, threads: out });
  } catch (e) {
    console.error('GET /dm/list error:', e);
    return res.status(500).json({ success: false, message: '채팅 목록을 불러오지 못했습니다.' });
  }
});

/**
 * 특정 채팅방 메시지 목록
 * GET /api/dm/:threadId/messages
 */
router.get('/:threadId/messages', requireAuthAPI, (req, res) => {
  try {
    const me = req.session.userId;
    const threadId = Number(req.params.threadId);
    const thread = chatQueries.getThread(threadId);
    if (!thread) return res.status(404).json({ success: false, message: '채팅방이 존재하지 않습니다.' });
    if (thread.user_a !== me && thread.user_b !== me) {
      return res.status(403).json({ success: false, message: '접근 권한이 없습니다.' });
    }
    const messages = chatQueries.listMessages(threadId);
    return res.json({ success: true, messages });
  } catch (e) {
    console.error('GET /dm/:threadId/messages error:', e);
    return res.status(500).json({ success: false, message: '메시지를 불러오지 못했습니다.' });
  }
});

module.exports = router;
