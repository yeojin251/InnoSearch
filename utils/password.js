const bcrypt = require('bcrypt');

// 비밀번호 해시 생성
async function hashPassword(password) {
  try {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  } catch (error) {
    console.error('비밀번호 해시 생성 실패:', error);
    throw new Error('비밀번호 처리 중 오류가 발생했습니다.');
  }
}

// 비밀번호 검증
async function verifyPassword(password, hashedPassword) {
  try {
    return await bcrypt.compare(password, hashedPassword);
  } catch (error) {
    console.error('비밀번호 검증 실패:', error);
    throw new Error('비밀번호 검증 중 오류가 발생했습니다.');
  }
}

module.exports = {
  hashPassword,
  verifyPassword
};
