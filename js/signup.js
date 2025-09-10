// 회원가입 폼 처리

class SignupForm {
  constructor() {
    this.form = document.querySelector('.auth-card');
    this.init();
  }

  init() {
    if (this.form) {
      this.form.addEventListener('submit', (e) => this.handleSubmit(e));
      this.setupValidation();
    }
  }

  // 폼 제출 처리
  async handleSubmit(e) {
    e.preventDefault();
    
    const submitBtn = this.form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    try {
      // 버튼 비활성화
      submitBtn.disabled = true;
      submitBtn.textContent = '처리 중...';
      
      // 폼 데이터 수집
      const formData = this.getFormData();
      console.log('전송할 데이터:', formData); // 디버깅용
      
      // 유효성 검사
      const validation = this.validateForm(formData);
      if (!validation.isValid) {
        this.showErrors(validation.errors);
        return;
      }
      
      // API 호출
      const response = await window.apiClient.post('/signup', formData);
      
      if (response.success) {
        this.showSuccess('회원가입이 완료되었습니다!');
        
        // 2초 후 로그인 페이지로 이동
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      }
      
    } catch (error) {
      console.error('회원가입 오류:', error);
      this.showError(error.message || '회원가입 중 오류가 발생했습니다.');
    } finally {
      // 버튼 활성화
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  // 폼 데이터 수집
  getFormData() {
    const formData = new FormData(this.form);
    const orgValue = formData.get('org');
    console.log('원본 org 값:', orgValue); // 디버깅용
    return {
      name: formData.get('name') || '',
      email: formData.get('email') || '',
      password: formData.get('password') || '',
      password2: formData.get('password2') || '',
      organization: orgValue ? orgValue.trim() : ''
    };
  }

  // 클라이언트 측 유효성 검사
  validateForm(data) {
    const errors = [];
    
    // 이름 검사
    if (!data.name.trim()) {
      errors.push('이름을 입력해주세요.');
    } else if (data.name.trim().length < 2) {
      errors.push('이름은 최소 2자 이상이어야 합니다.');
    }
    
    // 이메일 검사
    if (!data.email.trim()) {
      errors.push('이메일을 입력해주세요.');
    } else if (!this.isValidEmail(data.email)) {
      errors.push('올바른 이메일 형식을 입력해주세요.');
    }
    
    // 비밀번호 검사
    if (!data.password) {
      errors.push('비밀번호를 입력해주세요.');
    } else if (data.password.length < 8) {
      errors.push('비밀번호는 최소 8자 이상이어야 합니다.');
    }
    
    // 비밀번호 확인 검사
    if (data.password !== data.password2) {
      errors.push('비밀번호가 일치하지 않습니다.');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // 이메일 형식 검사
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // 실시간 유효성 검사 설정
  setupValidation() {
    const password = this.form.querySelector('input[name="password"]');
    const password2 = this.form.querySelector('input[name="password2"]');
    
    if (password2) {
      password2.addEventListener('input', () => {
        if (password.value !== password2.value) {
          password2.setCustomValidity('비밀번호가 일치하지 않습니다.');
        } else {
          password2.setCustomValidity('');
        }
      });
    }
  }

  // 에러 메시지 표시
  showErrors(errors) {
    this.clearMessages();
    const errorContainer = this.createMessageContainer('error');
    errorContainer.innerHTML = errors.map(error => `<p>${error}</p>`).join('');
    this.form.insertBefore(errorContainer, this.form.firstChild);
  }

  // 단일 에러 메시지 표시
  showError(message) {
    this.clearMessages();
    const errorContainer = this.createMessageContainer('error');
    errorContainer.innerHTML = `<p>${message}</p>`;
    this.form.insertBefore(errorContainer, this.form.firstChild);
  }

  // 성공 메시지 표시
  showSuccess(message) {
    this.clearMessages();
    const successContainer = this.createMessageContainer('success');
    successContainer.innerHTML = `<p>${message}</p>`;
    this.form.insertBefore(successContainer, this.form.firstChild);
  }

  // 메시지 컨테이너 생성
  createMessageContainer(type) {
    const container = document.createElement('div');
    container.className = `message ${type}`;
    return container;
  }

  // 기존 메시지 제거
  clearMessages() {
    const existingMessages = this.form.querySelectorAll('.message');
    existingMessages.forEach(msg => msg.remove());
  }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  new SignupForm();
});
