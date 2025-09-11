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
    
    // 사용자 테이블 생성
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
    
    // 인덱스 생성
    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
    `;
    
    database.exec(createIndexes);
    
    console.log('✅ 데이터베이스 테이블 생성 완료');
    
    // 테스트 데이터 삽입 (개발용)
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

// 사용자 관련 쿼리
const userQueries = {
  // 이메일로 사용자 찾기
  findByEmail: (email) => {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email);
  },
  
  // ID로 사용자 찾기
  findById: (id) => {
    const db = getDatabase();
    const stmt = db.prepare('SELECT id, name, email, organization, created_at FROM users WHERE id = ?');
    return stmt.get(id);
  },
  
  // 새 사용자 생성
  create: (userData) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO users (name, email, password_hash, organization)
      VALUES (?, ?, ?, ?)
    `);
    return stmt.run(userData.name, userData.email, userData.password_hash, userData.organization);
  },
  
  // 이메일 중복 확인
  emailExists: (email) => {
    const db = getDatabase();
    const stmt = db.prepare('SELECT COUNT(*) as count FROM users WHERE email = ?');
    const result = stmt.get(email);
    return result.count > 0;
  }
};

// 데이터베이스 연결 종료
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

// 게시판 관련 쿼리
const boardQueries = {
  // 새 게시글 생성
  createPost: (title, content, userId) => {
    const db = getDatabase();
    const stmt = db.prepare('INSERT INTO posts (title, content, user_id) VALUES (?, ?, ?)');
    return stmt.run(title, content, userId);
  },

  // 모든 게시글 목록 조회 (최신순)
  getAllPosts: () => {
    const db = getDatabase();
    // 익명성을 위해 사용자 이름은 '익명'으로 고정하고, id와 작성일시만 가져옵니다.
    const stmt = db.prepare(`
      SELECT p.id, p.title, '익명' as author, p.created_at
      FROM posts p
      ORDER BY p.id DESC
    `);
    return stmt.all();
  },

  // ID로 특정 게시글 조회
  findPostById: (id) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT p.id, p.title, p.content, '익명' as author, p.created_at, p.user_id
      FROM posts p
      WHERE p.id = ?
    `);
    return stmt.get(id);
  },

  // 특정 게시글의 댓글 목록 조회
  getCommentsByPostId: (postId) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT c.id, c.content, '익명' as author, c.created_at, c.user_id
      FROM comments c
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
    `);
    return stmt.all(postId);
  },

  // 새 댓글 추가
  createComment: (postId, userId, content) => {
    const db = getDatabase();
    const stmt = db.prepare('INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)');
    return stmt.run(postId, userId, content);
  },
}

module.exports = {
  getDatabase,
  initDatabase,
  userQueries,
  boardQueries,
  closeDatabase
};
