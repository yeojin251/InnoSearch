// server.js
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const cors = require('cors');
const http = require('http');             // ✅ 추가
const { Server } = require('socket.io');  // ✅ 추가
require('dotenv').config();

// === Routes ===
const authRoutes = require('./routes/auth');
const matchingRoutes = require('./routes/matching');
const eventsRoutes = require('./routes/events');
const boardRoutes = require('./routes/board');
const profileRoutes = require('./routes/profile');  // ✅ 추가
const dmRoutes = require('./routes/dm');            // ✅ 추가
const { initDatabase, chatQueries } = require('./db/db');
const { requireAuthAPI } = require('./middleware/requireAuth'); // 소켓 권한 체크에 재사용 가능

const app = express();
const server = http.createServer(app);   // ✅ http 서버로 감싸기
const io = new Server(server, {
  path: '/socket.io',
  cors: { origin: true, credentials: true }
});

const PORT = process.env.PORT || 3000;

// ===== 미들웨어 =====
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 세션
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'innosearch-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,             // HTTPS면 true
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
});
app.use(sessionMiddleware);

// ===== API 라우트 =====
app.use('/api', authRoutes);
app.use('/api/matching', matchingRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/board', boardRoutes);
app.use('/api', profileRoutes);  // ✅ /api/me/profile-full, /api/users/:id/profile
app.use('/api/dm', dmRoutes);    // ✅ DM REST API

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

// ===== Socket.IO (DM) =====
// 세션 공유(선택): 필요시 socket.request에 세션 주입
io.engine.use((req, res, next) => sessionMiddleware(req, res, next));

const dm = io.of('/dm');

dm.on('connection', (socket) => {
  // 세션 사용자 확인(선택)
  const session = socket.request?.session;
  const sessionUserId = session?.userId;

  // 클라이언트가 auth.userId로 보낸 것도 받아두지만, 세션 값을 우선
  const claimedUserId = socket.handshake?.auth?.userId;
  const userId = sessionUserId || claimedUserId;

  if (!userId) {
    socket.emit('error', { message: '인증 정보가 없습니다.' });
    socket.disconnect(true);
    return;
  }

  socket.data.userId = Number(userId);

  socket.on('join', ({ threadId }) => {
    try {
      const t = chatQueries.getThread(Number(threadId));
      if (!t) return;
      if (t.user_a !== socket.data.userId && t.user_b !== socket.data.userId) return; // 권한 체크
      const room = `thread:${t.id}`;
      socket.join(room);
    } catch (e) {
      console.error('join error:', e);
    }
  });

  socket.on('message', ({ threadId, body }) => {
    try {
      const t = chatQueries.getThread(Number(threadId));
      if (!t) return;
      if (t.user_a !== socket.data.userId && t.user_b !== socket.data.userId) return; // 권한 체크

      const trimmed = (body || '').trim();
      if (!trimmed) return;

      // DB 저장
      chatQueries.sendMessage(t.id, socket.data.userId, trimmed);

      // 방에 브로드캐스트
      const room = `thread:${t.id}`;
      dm.to(room).emit('message', { threadId: t.id, senderId: socket.data.userId, body: trimmed });
    } catch (e) {
      console.error('message error:', e);
    }
  });
});

// ===== 서버 시작 =====
async function startServer() {
  try {
    await initDatabase();
    console.log('✅ 데이터베이스 초기화 완료');

    server.listen(PORT, () => {    // ✅ io가 붙은 server로 리슨
      console.log(`🚀 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
      console.log(`📱 브라우저에서 http://localhost:${PORT} 를 열어보세요.`);
    });
  } catch (error) {
    console.error('❌ 서버 시작 실패:', error);
    process.exit(1);
  }
}

startServer();
