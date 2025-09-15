const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'innosearch.db');

let db = null;

// 데이터베이스 연결
function getDatabase() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

// 컬럼 존재 여부 확인
function hasColumn(table, col) {
  const database = getDatabase();
  const info = database.prepare(`PRAGMA table_info(${table})`).all();
  return info.some(c => c.name === col);
}

// DB 마이그레이션(컬럼 추가)
function migrateUsersTable() {
  const database = getDatabase();

  // users 테이블이 없으면 생성(닉네임 포함)
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      organization TEXT,
      nickname TEXT UNIQUE NOT NULL,
      show_nickname INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 컬럼 누락 시 추가(구 DB 호환)
  if (!hasColumn('users', 'nickname')) {
    database.exec(`ALTER TABLE users ADD COLUMN nickname TEXT UNIQUE;`);
    // 기본 닉네임을 name 또는 email local-part로 채우고, 중복 시 suffix
    const users = database.prepare(`SELECT id, name, email FROM users`).all();
    const existsNick = new Set(
      database.prepare(`SELECT nickname FROM users WHERE nickname IS NOT NULL`).all().map(r => r.nickname)
    );
    const up = database.prepare(`UPDATE users SET nickname = ? WHERE id = ?`);
    const toNick = (name, email) => {
      const base = (name && name.trim()) || (email.split('@')[0]);
      let n = base || 'user';
      let k = 1;
      while (existsNick.has(n)) {
        k += 1;
        n = `${base}${k}`;
      }
      existsNick.add(n);
      return n;
    };
    const tx = database.transaction(() => {
      for (const u of users) {
        const nk = toNick(u.name, u.email);
        up.run(nk, u.id);
      }
    });
    tx();
  }

  if (!hasColumn('users', 'show_nickname')) {
    database.exec(`ALTER TABLE users ADD COLUMN show_nickname INTEGER NOT NULL DEFAULT 1;`);
  }

  // 인덱스
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
    CREATE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname);
  `);
}

// 데이터베이스 초기화
async function initDatabase() {
  try {
    const database = getDatabase();

    // users 마이그레이션
    migrateUsersTable();

    // 게시글/댓글 테이블
    const createPostsTable = `
      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `;
    const createCommentsTable = `
      CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `;
    database.exec(createPostsTable);
    database.exec(createCommentsTable);

    // (기존) 익명번호 매핑 테이블은 더 이상 사용하지 않지만, 호환을 위해 남겨둠
    database.exec(`
      CREATE TABLE IF NOT EXISTS post_comment_alias (
        post_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        anon_index INTEGER NOT NULL,
        PRIMARY KEY (post_id, user_id),
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 채팅 테이블
    const createChatTables = `
      CREATE TABLE IF NOT EXISTS chat_threads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_a INTEGER NOT NULL,
        user_b INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_chat_threads_pair ON chat_threads(user_a, user_b);

      CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        thread_id INTEGER NOT NULL,
        sender_id INTEGER NOT NULL,
        body TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(thread_id);
    `;
    database.exec(createChatTables);

    // 인덱스
    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at);
      CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
    `;
    database.exec(createIndexes);

    console.log('✅ 데이터베이스 테이블/마이그레이션 완료');

    // 테스트 유저 (개발용)
    const testUser = database.prepare('SELECT COUNT(*) as count FROM users').get();
    if (testUser.count === 0) {
      const bcrypt = require('bcrypt');
      const testPassword = await bcrypt.hash('test123', 10);
      const insertTestUser = database.prepare(`
        INSERT INTO users (name, email, password_hash, organization, nickname, show_nickname)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      insertTestUser.run('테스트 사용자', 'test@innosearch.com', testPassword, 'InnoSearch Lab', '테스트사용자', 1);
      console.log('✅ 테스트 사용자 생성 완료 (test@innosearch.com / test123)');
    }

  } catch (error) {
    console.error('❌ 데이터베이스 초기화 실패:', error);
    throw error;
  }
}

// 사용자 쿼리
const userQueries = {
  findByEmail: (email) => {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email);
  },
  findById: (id) => {
    const db = getDatabase();
    const stmt = db.prepare('SELECT id, name, email, organization, nickname, show_nickname, created_at FROM users WHERE id = ?');
    return stmt.get(id);
  },
  create: (userData) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO users (name, email, password_hash, organization, nickname, show_nickname)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      userData.name,
      userData.email,
      userData.password_hash,
      userData.organization,
      userData.nickname,
      userData.show_nickname ? 1 : 0
    );
  },
  emailExists: (email) => {
    const db = getDatabase();
    const stmt = db.prepare('SELECT COUNT(*) as count FROM users WHERE email = ?');
    const result = stmt.get(email);
    return result.count > 0;
  },
  nicknameExists: (nickname) => {
    const db = getDatabase();
    const stmt = db.prepare('SELECT COUNT(*) as count FROM users WHERE nickname = ?');
    const result = stmt.get(nickname);
    return result.count > 0;
  },
  updateShowNickname: (id, show) => {
    const db = getDatabase();
    const stmt = db.prepare('UPDATE users SET show_nickname = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    return stmt.run(show ? 1 : 0, id);
  }
};

// 게시판 쿼리
const boardQueries = {
  // 새 게시글 생성 (서버 현재 시간으로 저장)
  createPost: (title, content, userId) => {
    const db = getDatabase();
    const now = new Date().toISOString();
    const stmt = db.prepare('INSERT INTO posts (title, content, user_id, created_at) VALUES (?, ?, ?, ?)');
    return stmt.run(title, content, userId, now);
  },

  // 모든 게시글 목록 조회 (최신순) — 표시 이름은 서버에서 결정
  getAllPosts: () => {
    const db = getDatabase();
    const stmt = db.prepare(`
        SELECT 
            p.id, 
            p.title, 
            p.created_at,
            CASE WHEN u.show_nickname = 1 THEN u.nickname ELSE u.name END AS author
        FROM posts p
        JOIN users u ON p.user_id = u.id
        ORDER BY p.id DESC
    `);
    return stmt.all();
  },

  // ID로 특정 게시글 조회(표시 이름 포함)
  findPostById: (id) => {
    const db = getDatabase();
    const stmt = db.prepare(`
        SELECT 
            p.id, 
            p.title, 
            p.content, 
            p.created_at, 
            p.user_id, 
            CASE WHEN u.show_nickname = 1 THEN u.nickname ELSE u.name END AS author
        FROM posts p
        JOIN users u ON p.user_id = u.id
        WHERE p.id = ?
    `);
    return stmt.get(id);
  },

  // 특정 게시글의 댓글 목록 조회(익명 X, 표시 이름으로 반환)
  getCommentsByPostId: (postId) => {
    const db = getDatabase();
    const stmt = db.prepare(`
        SELECT 
            c.id, 
            c.post_id, 
            c.user_id, 
            c.content, 
            c.created_at,
            CASE WHEN u.show_nickname = 1 THEN u.nickname ELSE u.name END AS display_name
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.post_id = ?
        ORDER BY c.created_at ASC, c.id ASC
    `);
    return stmt.all(postId);
  },

  // 새 댓글 추가 (서버 현재 시간으로 저장)
  createComment: (postId, userId, content) => {
    const db = getDatabase();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO comments (post_id, user_id, content, created_at) VALUES (?, ?, ?, ?)
    `);
    return stmt.run(postId, userId, content, now);
  },
};

// 채팅 쿼리 (1:1) — 변경 없음
const chatQueries = {
  _pair: (a, b) => {
    const aNum = Number(a), bNum = Number(b);
    return aNum < bNum ? [aNum, bNum] : [bNum, aNum];
  },

  openThread: (me, peer) => {
    const db = getDatabase();
    const [a, b] = chatQueries._pair(me, peer);

    const findStmt = db.prepare(`
      SELECT id FROM chat_threads 
      WHERE (user_a = ? AND user_b = ?) OR (user_a = ? AND user_b = ?)
      LIMIT 1
    `);
    const found = findStmt.get(a, b, a, b);
    if (found && found.id) return found.id;

    const ins = db.prepare(`
      INSERT INTO chat_threads (user_a, user_b) VALUES (?, ?)
    `);
    const r = ins.run(a, b);
    return r.lastInsertRowid;
  },

  listMyThreads: (me) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT id, user_a, user_b, created_at, updated_at
      FROM chat_threads
      WHERE user_a = ? OR user_b = ?
      ORDER BY updated_at DESC
    `);
    return stmt.all(me, me);
  },

  getThread: (id) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT id, user_a, user_b FROM chat_threads WHERE id = ?
    `);
    return stmt.get(id);
  },

  listMessages: (threadId) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT id, thread_id, sender_id, body, created_at
      FROM chat_messages
      WHERE thread_id = ?
      ORDER BY created_at ASC, id ASC
    `);
    return stmt.all(threadId);
  },

  sendMessage: (threadId, senderId, body) => {
    const db = getDatabase();
    const now = new Date().toISOString();
    const insMsg = db.prepare(`
      INSERT INTO chat_messages (thread_id, sender_id, body, created_at) VALUES (?, ?, ?, ?)
    `);
    const r = insMsg.run(threadId, senderId, body, now);

    const updThread = db.prepare(`
      UPDATE chat_threads SET updated_at = ? WHERE id = ?
    `);
    updThread.run(now, threadId);

    return r;
  }
};

function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  getDatabase,
  initDatabase,
  userQueries,
  boardQueries,
  chatQueries,
  closeDatabase
};
