// 로그인 폼 처리

class LoginForm {
  constructor() {
    this.form = document.querySelector('.auth-card');
    this.init();
  }

  init() {
    if (this.form) {
      this.form.addEventListener('submit', (e) => this.handleSubmit(e));
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
      submitBtn.textContent = '로그인 중...';
      
      // 폼 데이터 수집
      const formData = this.getFormData();
      
      // 유효성 검사
      const validation = this.validateForm(formData);
      if (!validation.isValid) {
        this.showErrors(validation.errors);
        return;
      }
      
      // API 호출
      const response = await window.apiClient.post('/login', formData);
      
      if (response.success) {
        this.showSuccess('로그인되었습니다!');
        
        // 1초 후 홈페이지로 이동
        setTimeout(() => {
          window.location.href = '/home';
        }, 1000);
      }
      
    } catch (error) {
      console.error('로그인 오류:', error);
      this.showError(error.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      // 버튼 활성화
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  // 폼 데이터 수집
  getFormData() {
    const formData = new FormData(this.form);
    return {
      email: formData.get('email') || '',
      password: formData.get('password') || ''
    };
  }

  // 클라이언트 측 유효성 검사
  validateForm(data) {
    const errors = [];
    
    // 이메일 검사
    if (!data.email.trim()) {
      errors.push('이메일을 입력해주세요.');
    } else if (!this.isValidEmail(data.email)) {
      errors.push('올바른 이메일 형식을 입력해주세요.');
    }
    
    // 비밀번호 검사
    if (!data.password) {
      errors.push('비밀번호를 입력해주세요.');
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
  new LoginForm();
});
