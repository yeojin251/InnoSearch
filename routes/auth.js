const express = require('express');
const { userQueries } = require('../db/db');
const { hashPassword, verifyPassword } = require('../utils/password');
const { validateSignupData, validateLoginData } = require('../utils/validate');

const router = express.Router();

// 회원가입
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, password2, organization } = req.body;
    console.log('회원가입 요청 데이터:', { name, email, organization }); // 디버깅용
    
    // 입력 데이터 검증
    const validation = validateSignupData({ name, email, password, password2 });
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: '입력 데이터가 올바르지 않습니다.',
        errors: validation.errors
      });
    }
    
    // 이메일 중복 확인
    if (userQueries.emailExists(email)) {
      return res.status(409).json({
        success: false,
        message: '이미 사용 중인 이메일입니다.'
      });
    }
    
    // 비밀번호 해시
    const passwordHash = await hashPassword(password);
    
    // 사용자 생성
    const result = userQueries.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password_hash: passwordHash,
      organization: organization ? organization.trim() : null
    });
    
    // 세션에 사용자 정보 저장
    req.session.userId = result.lastInsertRowid;
    req.session.userEmail = email.trim().toLowerCase();
    req.session.userName = name.trim();
    
    res.status(201).json({
      success: true,
      message: '회원가입이 완료되었습니다.',
      user: {
        id: result.lastInsertRowid,
        name: name.trim(),
        email: email.trim().toLowerCase()
      }
    });
    
  } catch (error) {
    console.error('회원가입 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

// 로그인
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // 입력 데이터 검증
    const validation = validateLoginData({ email, password });
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: '입력 데이터가 올바르지 않습니다.',
        errors: validation.errors
      });
    }
    
    // 사용자 찾기
    const user = userQueries.findByEmail(email.trim().toLowerCase());
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '이메일 또는 비밀번호가 올바르지 않습니다.'
      });
    }
    
    // 비밀번호 검증
    const isPasswordValid = await verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: '이메일 또는 비밀번호가 올바르지 않습니다.'
      });
    }
    
    // 세션에 사용자 정보 저장
    req.session.userId = user.id;
    req.session.userEmail = user.email;
    req.session.userName = user.name;
    
    res.json({
      success: true,
      message: '로그인되었습니다.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
    
  } catch (error) {
    console.error('로그인 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

// 로그아웃
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('세션 삭제 오류:', err);
      return res.status(500).json({
        success: false,
        message: '로그아웃 중 오류가 발생했습니다.'
      });
    }
    
    res.clearCookie('connect.sid');
    res.json({
      success: true,
      message: '로그아웃되었습니다.'
    });
  });
});

// 현재 사용자 정보 조회
router.get('/me', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      success: false,
      message: '로그인이 필요합니다.'
    });
  }
  
  const user = userQueries.findById(req.session.userId);
  if (!user) {
    // 세션은 있지만 사용자가 DB에 없는 경우
    req.session.destroy();
    return res.status(401).json({
      success: false,
      message: '사용자 정보를 찾을 수 없습니다.'
    });
  }
  
  res.json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      organization: user.organization
    }
  });
});

// 회원 탈퇴
router.delete('/account', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      success: false,
      message: '로그인이 필요합니다.'
    });
  }
  
  try {
    const db = require('../db/db').getDatabase();
    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    const result = stmt.run(req.session.userId);
    
    if (result.changes > 0) {
      // 세션 삭제
      req.session.destroy((err) => {
        if (err) {
          console.error('세션 삭제 오류:', err);
        }
      });
      
      res.json({
        success: true,
        message: '회원 탈퇴가 완료되었습니다.'
      });
    } else {
      res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }
  } catch (error) {
    console.error('회원 탈퇴 오류:', error);
    res.status(500).json({
      success: false,
      message: '회원 탈퇴 중 오류가 발생했습니다.'
    });
  }
});

module.exports = router;
