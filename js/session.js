// 세션 관리 및 UI 상태 업데이트

class SessionManager {
  constructor() {
    this.currentUser = null;
    this.initPromise = this.init();
  }

  // 초기화
  async init() {
    try {
      await this.checkAuthStatus();
      this.updateUI();
    } catch (error) {
      console.log('인증 상태 확인 실패:', error.message);
      this.updateUI();
    }
  }

  // 인증 상태 확인
  async checkAuthStatus() {
    try {
      const response = await window.apiClient.get('/me');
      if (response.success) {
        this.currentUser = response.user;
        return true;
      }
    } catch (error) {
      this.currentUser = null;
      return false;
    }
  }

  // UI 업데이트
  updateUI() {
    const loginBtn = document.getElementById('btn-login');
    const signupBtn = document.getElementById('btn-signup');
    const mypageBtn = document.getElementById('btn-mypage');
    const logoutBtn = document.getElementById('btn-logout');
    const userDisplay = document.getElementById('user-display');

    if (this.currentUser) {
      // 로그인된 상태
      if (loginBtn) loginBtn.style.display = 'none';
      if (signupBtn) signupBtn.style.display = 'none';
      if (mypageBtn) mypageBtn.style.display = 'inline-block';
      if (logoutBtn) logoutBtn.style.display = 'inline-block';
      if (userDisplay) {
        userDisplay.textContent = `${this.currentUser.name}님`;
        userDisplay.style.display = 'inline-block';
      }
    } else {
      // 로그인하지 않은 상태
      if (loginBtn) loginBtn.style.display = 'inline-block';
      if (signupBtn) signupBtn.style.display = 'inline-block';
      if (mypageBtn) mypageBtn.style.display = 'none';
      if (logoutBtn) logoutBtn.style.display = 'none';
      if (userDisplay) userDisplay.style.display = 'none';
    }
  }

  // 로그아웃
  async logout() {
    try {
      await window.apiClient.post('/logout');
      this.currentUser = null;
      this.updateUI();
      
      // 홈페이지로 리다이렉트
      window.location.href = '/home';
    } catch (error) {
      console.error('로그아웃 실패:', error);
      alert('로그아웃 중 오류가 발생했습니다.');
    }
  }

  // 사용자 정보 가져오기
  getCurrentUser() {
    return this.currentUser;
  }

  // 로그인 상태 확인
  isLoggedIn() {
    return this.currentUser !== null;
  }
}

// 전역 세션 매니저 인스턴스
window.sessionManager = new SessionManager();

// 로그아웃 버튼 이벤트 리스너 (DOM 로드 후, 세션 초기화를 기다렸다가 연결)
document.addEventListener('DOMContentLoaded', async () => {
  await window.sessionManager.initPromise; // 세션 초기화 완료까지 대기
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.sessionManager.logout();
    });
  }
});
