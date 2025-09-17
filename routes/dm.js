// routes/dm.js
const express = require('express');
const router = express.Router();
const { chatQueries, getDatabase } = require('../db/db');

// ─────────────────────────────────────────────────────────────
// 간단 인증 미들웨어 (세션 기반)
// ─────────────────────────────────────────────────────────────
function requireAuthAPI(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ success: false, message: 'unauthorized' });
  }
  next();
}

// ─────────────────────────────────────────────────────────────
// 1) DM 스레드 열기 (없으면 생성, 있으면 재사용)
// POST /api/dm/open  { otherUserId }
// ─────────────────────────────────────────────────────────────
router.post('/open', requireAuthAPI, async (req, res) => {
  try {
    const me = Number(req.session.userId);
    let { otherUserId } = req.body || {};
    otherUserId = Number(otherUserId);

    if (!otherUserId || Number.isNaN(otherUserId)) {
      return res.status(400).json({ success: false, message: '상대 사용자 ID가 올바르지 않습니다.' });
    }
    if (otherUserId === me) {
      return res.status(400).json({ success: false, message: '본인과의 대화는 생성할 수 없습니다.' });
    }

    // 상대 유저 존재 확인
    const db = getDatabase();
    const peer = db.prepare(`SELECT id FROM users WHERE id = ?`).get(otherUserId);
    if (!peer) {
      return res.status(404).json({ success: false, message: '상대 사용자를 찾을 수 없습니다.' });
    }

    const threadId = chatQueries.openThread(me, otherUserId);
    return res.json({ success: true, threadId });
  } catch (e) {
    console.error('dm/open error:', e);
    return res.status(500).json({ success: false, message: '채팅방 생성 중 오류가 발생했습니다.' });
  }
});

// ─────────────────────────────────────────────────────────────
// 2) 내 DM 목록 조회
// GET /api/dm/list
// 응답: [{thread_id, peer_id, peer_name, last_message, last_at}]
// ─────────────────────────────────────────────────────────────
router.get('/list', requireAuthAPI, (req, res) => {
  try {
    const me = Number(req.session.userId);
    const db = getDatabase();

    const rows = db.prepare(`
      SELECT
        t.id AS thread_id,
        CASE WHEN t.user_a = @me THEN t.user_b ELSE t.user_a END AS peer_id,
        COALESCE(p.display_name,
                 CASE WHEN u.show_nickname = 1 THEN u.nickname ELSE u.name END) AS peer_name,
        lm.body AS last_message,
        lm.created_at AS last_at
      FROM chat_threads t
      JOIN users u
        ON u.id = CASE WHEN t.user_a = @me THEN t.user_b ELSE t.user_a END
      LEFT JOIN user_profiles p
        ON p.user_id = u.id
      LEFT JOIN (
        SELECT m1.*
        FROM chat_messages m1
        JOIN (
          SELECT thread_id, MAX(created_at) AS max_at
          FROM chat_messages
          GROUP BY thread_id
        ) m2
          ON m1.thread_id = m2.thread_id AND m1.created_at = m2.max_at
      ) lm
        ON lm.thread_id = t.id
      WHERE t.user_a = @me OR t.user_b = @me
      ORDER BY COALESCE(lm.created_at, t.updated_at) DESC, t.id DESC
    `).all({ me });

    return res.json({ success: true, threads: rows });
  } catch (e) {
    console.error('dm/list error:', e);
    return res.status(500).json({ success: false, message: 'DM 목록 조회 중 오류가 발생했습니다.' });
  }
});

// ─────────────────────────────────────────────────────────────
// 3) 특정 스레드 메시지 이력 조회
// GET /api/dm/:threadId/messages
// ─────────────────────────────────────────────────────────────
router.get('/:threadId/messages', requireAuthAPI, (req, res) => {
  try {
    const me = Number(req.session.userId);
    const threadId = Number(req.params.threadId);

    if (!threadId || Number.isNaN(threadId)) {
      return res.status(400).json({ success: false, message: 'threadId가 올바르지 않습니다.' });
    }

    const db = getDatabase();
    const t = db.prepare(`SELECT * FROM chat_threads WHERE id = ?`).get(threadId);
    if (!t) {
      return res.status(404).json({ success: false, message: '채팅방을 찾을 수 없습니다.' });
    }
    if (t.user_a !== me && t.user_b !== me) {
      return res.status(403).json({ success: false, message: '접근 권한이 없습니다.' });
    }

    const rows = chatQueries.listMessages(threadId);
    return res.json({ success: true, messages: rows });
  } catch (e) {
    console.error('dm/messages error:', e);
    return res.status(500).json({ success: false, message: '메시지 조회 중 오류가 발생했습니다.' });
  }
});

// ─────────────────────────────────────────────────────────────
// (옵션) 4) REST로 메시지 전송 (소켓 대체/백업용)
// POST /api/dm/:threadId/send  { body }
//  - 서버가 app.set('io', io)로 io를 주입했다면 실시간 브로드캐스트도 수행
// ─────────────────────────────────────────────────────────────
router.post('/:threadId/send', requireAuthAPI, (req, res) => {
  try {
    const me = Number(req.session.userId);
    const threadId = Number(req.params.threadId);
    const body = (req.body?.body || '').trim();

    if (!threadId || Number.isNaN(threadId)) {
      return res.status(400).json({ success: false, message: 'threadId가 올바르지 않습니다.' });
    }
    if (!body) {
      return res.status(400).json({ success: false, message: '메시지 본문이 비어 있습니다.' });
    }

    const db = getDatabase();
    const t = db.prepare(`SELECT * FROM chat_threads WHERE id = ?`).get(threadId);
    if (!t) {
      return res.status(404).json({ success: false, message: '채팅방을 찾을 수 없습니다.' });
    }
    if (t.user_a !== me && t.user_b !== me) {
      return res.status(403).json({ success: false, message: '접근 권한이 없습니다.' });
    }

    chatQueries.sendMessage(threadId, me, body);

    // 실시간 브로드캐스트 (io가 주입되어 있으면)
    const io = req.app.get('io'); // server.js에서 app.set('io', io) 한 경우만 동작
    if (io) {
      const ns = io.of('/dm');
      ns.to(`thread:${threadId}`).emit('dm:message', { 
        threadId, 
        senderId: me, 
        body, 
        ts: Date.now() 
      });
    }

    return res.json({ success: true });
  } catch (e) {
    console.error('dm/send error:', e);
    return res.status(500).json({ success: false, message: '메시지 전송 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
