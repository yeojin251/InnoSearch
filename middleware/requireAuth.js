// middleware/requireAuth.js
// 인증 미들웨어 (페이지/API 분리)

// API 호출 여부 판별
function isApiRequest(req) {
  return (
    (req.originalUrl && req.originalUrl.startsWith('/api/')) ||
    (req.get('accept') || '').includes('application/json') ||
    req.xhr === true
  );
}

// 페이지용: 미로그인 시 로그인 페이지로 리다이렉트
// (단, fetch 등으로 페이지 라우트를 JSON으로 요청하면 401 JSON 반환)
function requireAuthPage(req, res, next) {
  if (req.session && req.session.userId) return next();

  if (isApiRequest(req)) {
    return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
  }
  // 로그인 페이지 경로는 프로젝트 라우트에 맞춰 선택하세요.
  // app.get('/login', ...)이면 '/login' 유지, 정적 파일이면 '/login.html'로 변경
  return res.redirect('/login');
}

// API용: 항상 JSON으로 401 반환
function requireAuthAPI(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
}

module.exports = {
  requireAuthPage,
  requireAuthAPI,
};