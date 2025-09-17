// db/db.js
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'innosearch.db');

let db = null;

// ─────────────────────────────────────────────────────────────
// DB 핸들러
// ─────────────────────────────────────────────────────────────
function getDatabase() {
  if (!db) {
    db = new Database(DB_PATH);
    // 성능/일관성 옵션
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON'); // FK 강제
    db.pragma('synchronous = NORMAL');
  }
  return db;
}

// 컬럼 존재 여부 확인
function hasColumn(table, col) {
  const database = getDatabase();
  const info = database.prepare(`PRAGMA table_info(${table})`).all();
  return info.some(c => c.name === col);
}

// ─────────────────────────────────────────────────────────────
// 마이그레이션: users
// ─────────────────────────────────────────────────────────────
function migrateUsersTable() {
  const database = getDatabase();

  // users 테이블(최신 스키마)
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

  // 구 스키마 호환: 누락 컬럼 추가
  if (!hasColumn('users', 'nickname')) {
    database.exec(`ALTER TABLE users ADD COLUMN nickname TEXT UNIQUE;`);
    try {
      const users = database.prepare(`SELECT id, name, email FROM users`).all();
      const existsNick = new Set(
        database.prepare(`SELECT nickname FROM users WHERE nickname IS NOT NULL`).all().map(r => r.nickname)
      );
      const up = database.prepare(`UPDATE users SET nickname = ? WHERE id = ?`);
      const toNick = (name, email) => {
        const baseRaw = (name && name.trim()) || (email && email.split('@')[0]) || 'user';
        const base = baseRaw.replace(/\s+/g, '');
        let n = base;
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
    } catch (e) {
      console.warn('migrateUsersTable.nickname 채우기 경고:', e.message);
    }
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

// ─────────────────────────────────────────────────────────────
// 초기화(테이블 생성/인덱스 생성/샘플 데이터)
// ─────────────────────────────────────────────────────────────
async function initDatabase() {
  try {
    const database = getDatabase();

    // users 마이그레이션
    migrateUsersTable();

    // 게시글/댓글
    database.exec(`
      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at);
      CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
    `);

    // (구조 호환) 익명번호 매핑
    database.exec(`
      CREATE TABLE IF NOT EXISTS post_comment_alias (
        post_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        anon_index INTEGER NOT NULL,
        PRIMARY KEY (post_id, user_id),
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // 공개 프로필
    database.exec(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id INTEGER PRIMARY KEY,
        display_name TEXT,
        job_title TEXT,
        interests TEXT,
        organization TEXT,
        bio TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // 채팅(1:1)
    database.exec(`
      CREATE TABLE IF NOT EXISTS chat_threads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_a INTEGER NOT NULL,
        user_b INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_a, user_b),
        FOREIGN KEY (user_a) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (user_b) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_chat_threads_pair ON chat_threads(user_a, user_b);

      CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        thread_id INTEGER NOT NULL,
        sender_id INTEGER NOT NULL,
        body TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(thread_id);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_ts ON chat_messages(created_at);
    `);

    console.log('✅ 데이터베이스 테이블/마이그레이션 완료');

    // 개발 편의를 위한 테스트 유저 자동 생성(비어 있을 때만)
    const { count } = database.prepare('SELECT COUNT(*) as count FROM users').get();
    if (count === 0) {
      const bcrypt = require('bcrypt');
      const testPassword = await bcrypt.hash('test123', 10);
      const insertUser = database.prepare(`
        INSERT INTO users (name, email, password_hash, organization, nickname, show_nickname)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      insertUser.run('테스트 사용자', 'test@innosearch.com', testPassword, 'InnoSearch Lab', '테스트사용자', 1);
      console.log('✅ 테스트 사용자 생성 완료 (이메일: test@innosearch.com / 비번: test123)');
    }
  } catch (error) {
    console.error('❌ 데이터베이스 초기화 실패:', error);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────
// 사용자 쿼리
// ─────────────────────────────────────────────────────────────
const userQueries = {
  findByEmail: (email) => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  },
  findById: (id) => {
    const db = getDatabase();
    return db.prepare(`
      SELECT id, name, email, organization, nickname, show_nickname, created_at
      FROM users WHERE id = ?
    `).get(id);
  },
  create: (userData) => {
    const db = getDatabase();
    return db.prepare(`
      INSERT INTO users (name, email, password_hash, organization, nickname, show_nickname)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
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
    const { count } = db.prepare('SELECT COUNT(*) as count FROM users WHERE email = ?').get(email);
    return count > 0;
  },
  nicknameExists: (nickname) => {
    const db = getDatabase();
    const { count } = db.prepare('SELECT COUNT(*) as count FROM users WHERE nickname = ?').get(nickname);
    return count > 0;
  },
  updateShowNickname: (id, show) => {
    const db = getDatabase();
    return db.prepare('UPDATE users SET show_nickname = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(show ? 1 : 0, id);
  }
};

// ─────────────────────────────────────────────────────────────
// 게시판 쿼리
// ─────────────────────────────────────────────────────────────
const boardQueries = {
  createPost: (title, content, userId) => {
    const db = getDatabase();
    const now = new Date().toISOString();
    return db.prepare(
      'INSERT INTO posts (title, content, user_id, created_at) VALUES (?, ?, ?, ?)'
    ).run(title, content, userId, now);
  },

  getAllPosts: () => {
    const db = getDatabase();
    return db.prepare(`
      SELECT 
        p.id, 
        p.title, 
        p.created_at,
        u.id AS author_id,
        CASE WHEN u.show_nickname = 1 THEN u.nickname ELSE u.name END AS author
      FROM posts p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.id DESC
    `).all();
  },

  findPostById: (id) => {
    const db = getDatabase();
    return db.prepare(`
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
    `).get(id);
  },

  getCommentsByPostId: (postId) => {
    const db = getDatabase();
    return db.prepare(`
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
    `).all(postId);
  },

  createComment: (postId, userId, content) => {
    const db = getDatabase();
    const now = new Date().toISOString();
    return db.prepare(`
      INSERT INTO comments (post_id, user_id, content, created_at) VALUES (?, ?, ?, ?)
    `).run(postId, userId, content, now);
  },
};

// ─────────────────────────────────────────────────────────────
// 채팅 쿼리 (1:1 DM)
//  - 스레드 쌍(user_a, user_b)은 항상 오름차순으로 정규화해 중복 방지
// ─────────────────────────────────────────────────────────────
const chatQueries = {
  _pair: (a, b) => {
    const aNum = Number(a), bNum = Number(b);
    return aNum < bNum ? [aNum, bNum] : [bNum, aNum];
  },

  openThread: (me, peer) => {
    const db = getDatabase();
    const [a, b] = chatQueries._pair(me, peer);

    // 존재 확인 (정규화된 한 방향만)
    const found = db.prepare(`
      SELECT id FROM chat_threads WHERE user_a = ? AND user_b = ? LIMIT 1
    `).get(a, b);
    if (found?.id) return found.id;

    // 생성
    const r = db.prepare(`
      INSERT INTO chat_threads (user_a, user_b) VALUES (?, ?)
    `).run(a, b);
    return r.lastInsertRowid;
  },

  listMyThreads: (me) => {
    const db = getDatabase();
    return db.prepare(`
      SELECT id, user_a, user_b, created_at, updated_at
      FROM chat_threads
      WHERE user_a = ? OR user_b = ?
      ORDER BY updated_at DESC, id DESC
    `).all(me, me);
  },

  getThread: (id) => {
    const db = getDatabase();
    return db.prepare(`
      SELECT id, user_a, user_b FROM chat_threads WHERE id = ?
    `).get(id);
  },

  listMessages: (threadId) => {
    const db = getDatabase();
    return db.prepare(`
      SELECT id, thread_id, sender_id, body, created_at
      FROM chat_messages
      WHERE thread_id = ?
      ORDER BY created_at ASC, id ASC
    `).all(threadId);
  },

  sendMessage: (threadId, senderId, body) => {
    const db = getDatabase();
    const now = new Date().toISOString();

    const tx = db.transaction(() => {
      const r = db.prepare(`
        INSERT INTO chat_messages (thread_id, sender_id, body, created_at)
        VALUES (?, ?, ?, ?)
      `).run(threadId, senderId, body, now);

      db.prepare(`UPDATE chat_threads SET updated_at = ? WHERE id = ?`)
        .run(now, threadId);

      return r;
    });

    return tx();
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
