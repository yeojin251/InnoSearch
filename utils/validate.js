// 입력 데이터 검증 유틸리티

// 이메일 형식 검증
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// 비밀번호 강도 검증
function validatePassword(password) {
  const errors = [];
  
  if (!password) {
    errors.push('비밀번호를 입력해주세요.');
  } else {
    if (password.length < 8) {
      errors.push('비밀번호는 최소 8자 이상이어야 합니다.');
    }
    if (!/(?=.*[a-zA-Z])/.test(password)) {
      errors.push('비밀번호는 영문자를 포함해야 합니다.');
    }
    if (!/(?=.*\d)/.test(password)) {
      errors.push('비밀번호는 숫자를 포함해야 합니다.');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// 이름 검증
function validateName(name) {
  const errors = [];
  
  if (!name || name.trim().length === 0) {
    errors.push('이름을 입력해주세요.');
  } else if (name.trim().length < 2) {
    errors.push('이름은 최소 2자 이상이어야 합니다.');
  } else if (name.trim().length > 50) {
    errors.push('이름은 50자를 초과할 수 없습니다.');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// 회원가입 데이터 검증
function validateSignupData(data) {
  const errors = [];
  
  // 이름 검증
  const nameValidation = validateName(data.name);
  if (!nameValidation.isValid) {
    errors.push(...nameValidation.errors);
  }
  
  // 이메일 검증
  if (!data.email || data.email.trim().length === 0) {
    errors.push('이메일을 입력해주세요.');
  } else if (!validateEmail(data.email)) {
    errors.push('올바른 이메일 형식을 입력해주세요.');
  }
  
  // 비밀번호 검증
  const passwordValidation = validatePassword(data.password);
  if (!passwordValidation.isValid) {
    errors.push(...passwordValidation.errors);
  }
  
  // 비밀번호 확인 검증
  if (data.password !== data.password2) {
    errors.push('비밀번호가 일치하지 않습니다.');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// 로그인 데이터 검증
function validateLoginData(data) {
  const errors = [];
  
  if (!data.email || data.email.trim().length === 0) {
    errors.push('이메일을 입력해주세요.');
  } else if (!validateEmail(data.email)) {
    errors.push('올바른 이메일 형식을 입력해주세요.');
  }
  
  if (!data.password || data.password.trim().length === 0) {
    errors.push('비밀번호를 입력해주세요.');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  validateEmail,
  validatePassword,
  validateName,
  validateSignupData,
  validateLoginData
};
