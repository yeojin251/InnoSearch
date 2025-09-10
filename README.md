# InnoSearch - 회원가입/로그인 시스템

InnoSearch의 회원가입 및 로그인 기능이 구현된 웹 애플리케이션입니다.

## 🚀 시작하기

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경 변수 설정
```bash
# env.example 파일을 .env로 복사
copy env.example .env

# .env 파일을 열어서 실제 값으로 수정
# SESSION_SECRET=your-actual-secret-key
```

### 3. 서버 실행
```bash
# 개발 모드 (nodemon 사용)
npm run dev

# 또는 일반 실행
npm start
```

### 4. 브라우저에서 확인
```
http://localhost:3000
```

## 📁 프로젝트 구조

```
InnoSearch/
├── server.js              # Express 서버 메인 파일
├── package.json           # 의존성 및 스크립트
├── .env                   # 환경 변수 (생성 필요)
├── .gitignore            # Git 무시 파일
├── db/                   # 데이터베이스 관련
│   ├── db.js            # SQLite 연결 및 쿼리
│   ├── init.sql         # DB 스키마 초기화
│   └── innosearch.db    # SQLite 데이터베이스 (자동 생성)
├── routes/              # API 라우트
│   └── auth.js         # 인증 관련 API
├── middleware/          # 미들웨어
│   └── requireAuth.js  # 인증 검사 미들웨어
├── utils/              # 유틸리티 함수
│   ├── password.js     # 비밀번호 해시/검증
│   └── validate.js     # 입력 데이터 검증
├── js/                 # 프론트엔드 JavaScript
│   ├── apiClient.js    # API 클라이언트
│   ├── session.js      # 세션 관리
│   ├── login.js        # 로그인 폼 처리
│   └── signup.js       # 회원가입 폼 처리
├── css/                # 스타일시트
│   ├── styles.css      # 메인 스타일
│   └── mem_styles.css  # 회원가입/로그인 전용 스타일
├── home.html           # 홈페이지
├── login.html          # 로그인 페이지
├── signup.html         # 회원가입 페이지
└── myLab.html          # 마이페이지
```

## 🔧 주요 기능

### 회원가입
- 이름, 이메일, 비밀번호 입력
- 실시간 유효성 검사
- 비밀번호 해시 저장
- 이메일 중복 확인

### 로그인
- 이메일/비밀번호 인증
- 세션 기반 인증
- 자동 로그인 상태 유지

### 인증 상태 관리
- 로그인 시: 로그인/회원가입 버튼 숨김, 마이페이지/로그아웃 버튼 표시
- 로그아웃 시: 버튼 상태 초기화
- 사용자명 표시

## 🛠 기술 스택

- **Backend**: Node.js, Express.js
- **Database**: SQLite (better-sqlite3)
- **Authentication**: bcrypt, express-session
- **Frontend**: Vanilla JavaScript, HTML5, CSS3

## 📝 API 엔드포인트

- `POST /api/signup` - 회원가입
- `POST /api/login` - 로그인
- `POST /api/logout` - 로그아웃
- `GET /api/me` - 현재 사용자 정보 조회

## 🔒 보안 기능

- 비밀번호 bcrypt 해시
- 세션 기반 인증
- 입력 데이터 검증
- SQL 인젝션 방지 (prepared statements)

## 🧪 테스트 계정

개발용 테스트 계정이 자동으로 생성됩니다:
- 이메일: `test@innosearch.com`
- 비밀번호: `test123`

## 📱 사용법

1. **회원가입**: `/signup` 페이지에서 새 계정 생성
2. **로그인**: `/login` 페이지에서 기존 계정으로 로그인
3. **마이페이지**: 로그인 후 `/myLab` 페이지에서 개인 활동 확인
4. **로그아웃**: 우상단 로그아웃 버튼 클릭

## 🚨 주의사항

- 실제 운영 환경에서는 `.env` 파일의 `SESSION_SECRET`을 강력한 랜덤 키로 변경하세요
- HTTPS 환경에서는 세션 쿠키의 `secure` 옵션을 `true`로 설정하세요
- 데이터베이스 파일(`db/innosearch.db`)은 `.gitignore`에 포함되어 있습니다