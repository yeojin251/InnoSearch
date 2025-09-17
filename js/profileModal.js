// public/js/profileModal.js
(function () {
  const tpl = `
  <div id="profile-overlay" class="overlay" style="display:none;position:fixed;inset:0;background:rgba(2,6,23,.55);align-items:center;justify-content:center;z-index:1000;">
    <div class="panel" style="width:min(480px,92%);background:#fff;border:1px solid #e2e8f0;border-radius:20px;box-shadow:0 20px 60px rgba(2,6,23,.35);padding:18px;">
      <header style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <h3 style="margin:0;font-weight:800;font-size:18px;color:#0f172a;">프로필</h3>
        <button id="profile-close" aria-label="닫기"
          style="width:28px;height:28px;border:none;background:transparent;cursor:pointer;
                 border-radius:9999px;display:flex;align-items:center;justify-content:center;
                 font-size:18px;line-height:1;color:#334155;">×
        </button>
      </header>
      <div id="profile-body" class="mini" style="color:#64748b;">불러오는 중…</div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
        <button id="profile-dm" class="btn primary" style="border-radius:12px;padding:8px 12px;background:#6366f1;color:#fff;border:none;cursor:pointer;">채팅하기</button>
      </div>
    </div>
  </div>`;

  function closeModal() {
    const overlay = document.getElementById('profile-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  function ensure() {
    if (document.getElementById('profile-overlay')) return; // 이미 있으면 재생성 X
    const wrap = document.createElement('div');
    wrap.innerHTML = tpl;
    document.body.appendChild(wrap.firstElementChild);

    const overlay = document.getElementById('profile-overlay');
    const btnClose = document.getElementById('profile-close');

    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    btnClose.addEventListener('click', closeModal);
    btnClose.addEventListener('mouseenter', () => { btnClose.style.background = '#e2e8f0'; });
    btnClose.addEventListener('mouseleave', () => { btnClose.style.background = 'transparent'; });

    // ESC로 닫기
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  }

  async function openProfileModal(userId) {
    ensure();
    const overlay = document.getElementById('profile-overlay');
    const body = document.getElementById('profile-body');
    const dmBtn = document.getElementById('profile-dm');

    overlay.style.display = 'flex';
    body.textContent = '불러오는 중…';

    try {
      const r = await window.apiClient.get(`/users/${Number(userId)}/profile`);
      if (!r?.success) throw new Error('로드 실패');
      const p = r.profile;
      const esc = (s) => typeof s === 'string'
        ? s.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]))
        : '';

      body.innerHTML = `
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:8px;">
          <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#dbeafe,#93c5fd);"></div>
          <div>
            <div style="font-weight:700;color:#0f172a;">${esc(p.display_name || '사용자')}</div>
            <div class="mini" style="color:#64748b;">${esc(p.organization || '-')}${p.job_title ? ' · ' + esc(p.job_title) : ''}</div>
          </div>
        </div>
        <div><b>관심분야</b> : ${esc(p.interests || '-')}</div>
        <div style="margin-top:8px;"><b>소개</b></div>
        <div style="white-space:pre-wrap;margin-top:4px;">${esc(p.bio || '')}</div>
      `;
      dmBtn.onclick = () => window.openChatModalWith(userId);
    } catch (e) {
      console.error(e);
      body.textContent = '프로필을 불러올 수 없습니다.';
      dmBtn.onclick = null;
    }
  }

  window.openProfileModal = openProfileModal;
})();
