// 인증이 필요한 페이지 접근 시 사용하는 미들웨어

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    // 로그인하지 않은 사용자는 로그인 페이지로 리다이렉트
    return res.redirect('/login');
  }
  next();
}

// API 요청에 대한 인증 미들웨어
function requireAuthAPI(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({
      success: false,
      message: '로그인이 필요합니다.'
    });
  }
  next();
}

module.exports = {
  requireAuth,
  requireAuthAPI
};
