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

module.exports = {
  getDatabase,
  initDatabase,
  userQueries,
  closeDatabase
};
