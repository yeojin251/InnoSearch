const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

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

// 데이터베이스 초기화
async function initDatabase() {
  try {
    const database = getDatabase();
    
    // 사용자 테이블
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        organization TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    database.exec(createUsersTable);

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

    // 댓글 익명번호 매핑 테이블 (게시글-사용자별 고정 번호)
    const createAliasTable = `
      CREATE TABLE IF NOT EXISTS post_comment_alias (
        post_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        anon_index INTEGER NOT NULL,
        PRIMARY KEY (post_id, user_id),
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `;
    database.exec(createAliasTable);

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
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
      CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at);
      CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
    `;
    database.exec(createIndexes);
    
    console.log('✅ 데이터베이스 테이블 생성 완료');
    
    // 테스트 유저 (개발용)
    const testUser = database.prepare('SELECT COUNT(*) as count FROM users').get();
    if (testUser.count === 0) {
      const bcrypt = require('bcrypt');
      const testPassword = await bcrypt.hash('test123', 10);
      const insertTestUser = database.prepare(`
        INSERT INTO users (name, email, password_hash, organization)
        VALUES (?, ?, ?, ?)
      `);
      insertTestUser.run('테스트 사용자', 'test@innosearch.com', testPassword, 'InnoSearch Lab');
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
    const stmt = db.prepare('SELECT id, name, email, organization, created_at FROM users WHERE id = ?');
    return stmt.get(id);
  },
  create: (userData) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO users (name, email, password_hash, organization)
      VALUES (?, ?, ?, ?)
    `);
    return stmt.run(userData.name, userData.email, userData.password_hash, userData.organization);
  },
  emailExists: (email) => {
    const db = getDatabase();
    const stmt = db.prepare('SELECT COUNT(*) as count FROM users WHERE email = ?');
    const result = stmt.get(email);
    return result.count > 0;
  }
};

// 게시판 쿼리
const boardQueries = {
  // 새 게시글 생성
  createPost: (title, content, userId) => {
    const db = getDatabase();
    const stmt = db.prepare('INSERT INTO posts (title, content, user_id) VALUES (?, ?, ?)');
    return stmt.run(title, content, userId);
  },

  // 모든 게시글 목록 조회 (최신순) — author_id, author_label 제공
  getAllPosts: () => {
    const db = getDatabase();
    const stmt = db.prepare(`
        SELECT 
            p.id, 
            p.title, 
            p.created_at,
            u.name AS author -- users 테이블에서 name을 가져와 author로 별칭
        FROM posts p
        JOIN users u ON p.user_id = u.id -- users 테이블과 JOIN
        ORDER BY p.id DESC
    `);
    return stmt.all();
},

  // ID로 특정 게시글 조회
  findPostById: (id) => {
    const db = getDatabase();
    const stmt = db.prepare(`
        SELECT 
            p.id, 
            p.title, 
            p.content, 
            p.created_at, 
            p.user_id, 
            u.name AS author -- users 테이블에서 name을 가져와 author로 별칭
        FROM posts p
        JOIN users u ON p.user_id = u.id -- users 테이블과 JOIN
        WHERE p.id = ?
    `);
    return stmt.get(id);
},

  // 특정 게시글의 댓글 목록 조회 (익명 라벨 포함을 위해 alias join)
  getCommentsByPostIdWithAnon: (postId) => {
    const db = getDatabase();
    const stmt = db.prepare(`
        SELECT 
            c.id, 
            c.post_id, 
            c.user_id, 
            c.content, 
            c.created_at,
            a.anon_index,
            u.name AS author -- users 테이블에서 name을 가져와 author로 별칭 추가
        FROM comments c
        JOIN users u ON c.user_id = u.id -- users 테이블과 JOIN
        LEFT JOIN post_comment_alias a ON a.post_id = c.post_id AND a.user_id = c.user_id
        WHERE c.post_id = ?
        ORDER BY c.created_at ASC
    `);
    return stmt.all(postId);
},

  // 익명번호 보장: 있으면 반환, 없으면 다음 번호로 부여
  ensureAnonIndex: (postId, userId) => {
    const db = getDatabase();
    const getStmt = db.prepare(`
      SELECT anon_index FROM post_comment_alias WHERE post_id = ? AND user_id = ?
    `);
    const row = getStmt.get(postId, userId);
    if (row && row.anon_index) return row.anon_index;

    const maxStmt = db.prepare(`
      SELECT COALESCE(MAX(anon_index), 0) AS max_idx 
      FROM post_comment_alias WHERE post_id = ?
    `);
    const { max_idx } = maxStmt.get(postId);
    const nextIdx = (max_idx || 0) + 1;

    const ins = db.prepare(`
      INSERT INTO post_comment_alias (post_id, user_id, anon_index) VALUES (?, ?, ?)
    `);
    ins.run(postId, userId, nextIdx);
    return nextIdx;
  },

  // 새 댓글 추가 (익명번호 함께 저장)
  createComment: (postId, userId, content, anonIndex) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)
    `);
    // comments 테이블에는 anon_index를 직접 저장하지 않지만, alias 테이블로 매핑 유지
    return stmt.run(postId, userId, content);
  },
};

// 채팅 쿼리 (1:1)
const chatQueries = {
  // participants 정렬 키 생성
  _pair: (a, b) => {
    const aNum = Number(a), bNum = Number(b);
    return aNum < bNum ? [aNum, bNum] : [bNum, aNum];
  },

  // 스레드 찾기/생성
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
    const insMsg = db.prepare(`
      INSERT INTO chat_messages (thread_id, sender_id, body) VALUES (?, ?, ?)
    `);
    const r = insMsg.run(threadId, senderId, body);

    const updThread = db.prepare(`
      UPDATE chat_threads SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    updThread.run(threadId);

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
