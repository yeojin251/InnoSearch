// routes/profile.js
const express = require('express');
const router = express.Router();
const { getDatabase } = require('../db/db');
const { requireAuthAPI } = require('../middleware/requireAuth');

/**
 * 내 프로필 전체 조회 (없으면 빈 레코드 생성 후 반환)
 * GET /api/me/profile-full
 */
router.get('/me/profile-full', requireAuthAPI, (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.session.userId;

    // users + user_profiles join, 표시용 이름 fallback
    const row = db.prepare(`
      SELECT 
        u.id as user_id,
        COALESCE(up.display_name, CASE WHEN u.show_nickname = 1 THEN u.nickname ELSE u.name END) AS display_name,
        COALESCE(up.organization, u.organization) AS organization,
        up.job_title,
        up.interests,
        up.bio,
        u.nickname,
        u.show_nickname
      FROM users u
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE u.id = ?
    `).get(userId);

    // user_profiles가 없으면 생성해 둔다 (편의)
    if (!row || typeof row.job_title === 'undefined') {
      db.prepare(`
        INSERT OR IGNORE INTO user_profiles (user_id, organization)
        VALUES (?, (SELECT organization FROM users WHERE id = ?))
      `).run(userId, userId);
    }

    // 재조회
    const out = db.prepare(`
      SELECT 
        u.id as user_id,
        COALESCE(up.display_name, CASE WHEN u.show_nickname = 1 THEN u.nickname ELSE u.name END) AS display_name,
        COALESCE(up.organization, u.organization) AS organization,
        up.job_title,
        up.interests,
        up.bio,
        u.nickname,
        u.show_nickname
      FROM users u
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE u.id = ?
    `).get(userId);

    return res.json({ success: true, profile: out });
  } catch (e) {
    console.error('GET /me/profile-full error:', e);
    return res.status(500).json({ success: false, message: '프로필을 불러오지 못했습니다.' });
  }
});

/**
 * 내 프로필 저장(업서트)
 * PUT /api/me/profile-full
 * body: { display_name, organization, job_title, interests, bio }
 */
router.put('/me/profile-full', requireAuthAPI, (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.session.userId;
    const { display_name, organization, job_title, interests, bio } = req.body || {};

    // 업서트
    const stmt = db.prepare(`
      INSERT INTO user_profiles (user_id, display_name, organization, job_title, interests, bio, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        display_name = excluded.display_name,
        organization = excluded.organization,
        job_title    = excluded.job_title,
        interests    = excluded.interests,
        bio          = excluded.bio,
        updated_at   = CURRENT_TIMESTAMP
    `);
    stmt.run(userId, display_name || null, organization || null, job_title || null, interests || null, bio || null);

    return res.json({ success: true, message: '프로필이 저장되었습니다.' });
  } catch (e) {
    console.error('PUT /me/profile-full error:', e);
    return res.status(500).json({ success: false, message: '프로필 저장 중 오류가 발생했습니다.' });
  }
});

/**
 * 타인 프로필 조회
 * GET /api/users/:id/profile
 * 표시 이름: user_profiles.display_name (우선), 없으면 users의 show_nickname 규칙
 */
router.get('/users/:id/profile', (req, res) => {
  try {
    const db = getDatabase();
    const uid = Number(req.params.id);
    if (!uid) return res.status(400).json({ success: false, message: '잘못된 사용자 ID' });

    const row = db.prepare(`
      SELECT
        u.id as user_id,
        COALESCE(up.display_name, CASE WHEN u.show_nickname = 1 THEN u.nickname ELSE u.name END) AS display_name,
        COALESCE(up.organization, u.organization) AS organization,
        up.job_title,
        up.interests,
        up.bio
      FROM users u
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE u.id = ?
    `).get(uid);

    if (!row) {
      return res.status(404).json({ success: false, message: '사용자 프로필을 찾을 수 없습니다.' });
    }
    return res.json({ success: true, profile: row });
  } catch (e) {
    console.error('GET /users/:id/profile error:', e);
    return res.status(500).json({ success: false, message: '프로필을 불러오지 못했습니다.' });
  }
});

module.exports = router;
