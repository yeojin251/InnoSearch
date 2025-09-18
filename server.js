// server.js
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// === Routes ===
const authRoutes = require('./routes/auth');
const matchingRoutes = require('./routes/matching');
const eventsRoutes = require('./routes/events');
const boardRoutes = require('./routes/board');
const profileRoutes = require('./routes/profile');   // /api/me/profile-full, /api/users/:id/profile
const dmRoutes = require('./routes/dm');             // DM REST API
const chatRoutes = require('./routes/chatRoute');    // ⭐ 추가: ChatGPT 프록시 라우트

const { initDatabase, chatQueries } = require('./db/db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  path: '/socket.io',
  cors: { origin: true, credentials: true }
});

const PORT = process.env.PORT || 3000;

// ===== 기본 설정 / 미들웨어 =====
app.set('trust proxy', 1);
app.use(cors({ origin: true, credentials: true }));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 세션 (개발용 MemoryStore, 운영은 Redis 권장)
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'innosearch-secret-key-2025',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // 배포 환경에서는 true, 로컬에서는 false
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
});
app.use(sessionMiddleware);

// ===== API 라우트 =====
app.use('/api', authRoutes);
app.use('/api/matching', matchingRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/board', boardRoutes);
app.use('/api', profileRoutes);
app.use('/api/dm', dmRoutes);
app.use('/api', chatRoutes); // ⭐ 추가: /api/chat 엔드포인트 활성화

// ===== 정적 파일 서빙 =====
app.use(express.static(path.join(__dirname)));

// ===== HTML 라우트 =====
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'home.html')));
app.get('/home', (req, res) => res.sendFile(path.join(__dirname, 'home.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, 'signup.html')));
app.get('/myLab', (req, res) => res.sendFile(path.join(__dirname, 'myLab.html')));
app.get('/board', (req, res) => res.sendFile(path.join(__dirname, 'board.html')));
app.get('/new-post.html', (req, res) => res.sendFile(path.join(__dirname, 'new-post.html')));
app.get('/post-detail.html', (req, res) => res.sendFile(path.join(__dirname, 'post-detail.html')));
app.get('/tech-detail.html', (req,res)=> res.sendFile(path.join(__dirname, 'tech-detail.html')));
// DM 단일 페이지 테스트용(옵션)
app.get('/dm', (req, res) => res.sendFile(path.join(__dirname, 'dm.html')));

// ===== 에러 핸들러(REST가 HTML로 떨어지는 문제 방지) =====
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ ok: false, error: 'Internal Server Error' });
});

// ===== Socket.IO (DM) =====
// 세션을 소켓과 공유
io.engine.use((req, res, next) => sessionMiddleware(req, res, next));

const dm = io.of('/dm');

dm.on('connection', (socket) => {
  const sess = socket.request?.session;
  const sessionUserId = sess?.userId;
  const claimedUserId = socket.handshake?.auth?.userId;
  const userId = Number(sessionUserId || claimedUserId);
  if (!userId) { socket.emit('error', { message: '인증 정보가 없습니다.' }); socket.disconnect(true); return; }
  socket.data.userId = userId;

  const handleJoin = ({ threadId }) => {
    const t = chatQueries.getThread(Number(threadId));
    if (!t) return;
    if (t.user_a !== userId && t.user_b !== userId) return;
    socket.join(`thread:${t.id}`);
  };
  socket.on('join', handleJoin);
  socket.on('dm:join', handleJoin);

  // ✅ ACK 지원: (payload, ack) 형태
  const handleSend = ({ threadId, body }, ack) => {
    try {
      const t = chatQueries.getThread(Number(threadId));
      if (!t) return typeof ack === 'function' && ack({ ok:false, error:'no_thread' });
      if (t.user_a !== userId && t.user_b !== userId) return typeof ack === 'function' && ack({ ok:false, error:'forbidden' });

      const text = (body || '').trim();
      if (!text) return typeof ack === 'function' && ack({ ok:false, error:'empty' });

      chatQueries.sendMessage(t.id, userId, text);

      const payload = { threadId: t.id, senderId: userId, body: text, ts: Date.now() };
      dm.to(`thread:${t.id}`).emit('dm:message', payload);

      if (typeof ack === 'function') ack({ ok: true }); // ✅ 성공 알림
    } catch (e) {
      console.error('dm:send error:', e);
      if (typeof ack === 'function') ack({ ok:false, error:'server' });
    }
  };
  // 레거시/신규 둘 다 같은 핸들러 사용
  socket.on('dm:send', handleSend);
  socket.on('message', handleSend);
});

// ===== 서버 시작 =====
async function startServer() {
  try {
    await initDatabase();
    console.log('✅ 데이터베이스 초기화 완료');

    server.listen(PORT, () => {
      console.log(`🚀 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
      console.log(`📱 브라우저에서 http://localhost:${PORT} 를 열어보세요.`);
    });

    // 종료 신호 핸들링 (선택)
    const shutdown = () => {
      console.log('🛑 Shutting down...');
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 2000);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('❌ 서버 시작 실패:', error);
    process.exit(1);
  }
}

startServer();
