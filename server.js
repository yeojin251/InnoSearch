const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const matchingRoutes = require('./routes/matching');
const eventsRoutes = require('./routes/events');
const { initDatabase } = require('./db/db');

const app = express();
const PORT = process.env.PORT || 3001;

// 미들웨어 설정
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 세션 설정
app.use(session({
  secret: process.env.SESSION_SECRET || 'innosearch-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // HTTPS에서는 true로 설정
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24시간
  }
}));

// 정적 파일 서빙
app.use(express.static(path.join(__dirname)));

// API 라우트
app.use('/api', authRoutes);
app.use('/api/matching', matchingRoutes);
app.use('/api/events', eventsRoutes);

// HTML 라우트
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'home.html'));
});

app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'home.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'signup.html'));
});

app.get('/myLab', (req, res) => {
  res.sendFile(path.join(__dirname, 'myLab.html'));
});

// 서버 시작
async function startServer() {
  try {
    // 데이터베이스 초기화
    await initDatabase();
    console.log('✅ 데이터베이스 초기화 완료');
    
    app.listen(PORT, () => {
      console.log(`🚀 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
      console.log(`📱 브라우저에서 http://localhost:${PORT} 를 열어보세요.`);
    });
  } catch (error) {
    console.error('❌ 서버 시작 실패:', error);
    process.exit(1);
  }
}

startServer();
