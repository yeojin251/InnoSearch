// public/js/chatModal.js
(function () {
  // apiClient가 있으면 경로 그대로 넘기고,
  // 없으면 fetch로 '/api' 프리픽스를 붙여 호출하는 래퍼
  const api = window.apiClient || {
    async get(path) {
      const r = await fetch('/api' + path, { credentials: 'include' });
      if (!r.ok) throw new Error(`GET ${path} ${r.status}`);
      return r.json();
    },
    async post(path, body) {
      const r = await fetch('/api' + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body || {})
      });
      if (!r.ok) throw new Error(`POST ${path} ${r.status}`);
      return r.json();
    }
  };

  const tpl = `
  <div id="dm-overlay" class="overlay" style="display:none;position:fixed;inset:0;background:rgba(2,6,23,.55);align-items:center;justify-content:center;z-index:1000;">
    <div class="panel" style="width:min(520px,92%);background:#fff;border:1px solid #e2e8f0;border-radius:20px;box-shadow:0 20px 60px rgba(2,6,23,.35);padding:18px;">
      <header style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <h3 id="dm-title" style="margin:0;font-weight:800;font-size:18px;color:#0f172a;">채팅</h3>
        <button id="dm-close" aria-label="닫기"
          style="width:28px;height:28px;border:none;background:transparent;cursor:pointer;
                 border-radius:9999px;display:flex;align-items:center;justify-content:center;
                 font-size:18px;line-height:1;color:#334155;">
          ×
        </button>
      </header>
      <div id="dm-messages" style="height:300px;overflow:auto;border:1px solid #e2e8f0;border-radius:12px;padding:8px;background:#f8fafc;"></div>
      <div style="display:flex;gap:8px;margin-top:8px;">
        <input id="dm-input" type="text" placeholder="메시지 입력" style="flex:1;border:1px solid #cbd5e1;border-radius:12px;padding:10px;">
        <button id="dm-send" class="btn primary" style="border-radius:12px;padding:8px 12px;background:#6366f1;color:#fff;border:none;cursor:pointer;">전송</button>
      </div>
    </div>
  </div>`;

  let socket = null;
  let currentThread = null;
  let currentPeerId = null;
  let bound = false;

  function ensure() {
    if (document.getElementById('dm-overlay')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = tpl;
    document.body.appendChild(wrap.firstElementChild);
    const overlay = document.getElementById('dm-overlay');
    const btnClose = document.getElementById('dm-close');
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    btnClose.addEventListener('click', closeModal);
    btnClose.addEventListener('mouseenter', () => {
      btnClose.style.background = '#e2e8f0';
    });
    btnClose.addEventListener('mouseleave', () => {
      btnClose.style.background = 'transparent';
    });
   // ESC로 닫기
   document.addEventListener('keydown', (e) => {
     if (e.key === 'Escape') closeModal();
  });
}
  

  function closeModal() {
    const overlay = document.getElementById('dm-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  const esc = (s) =>
    typeof s === 'string'
      ? s.replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;' }[m]))
      : '';

  async function getMe() {
    try {
      if (window.sessionManager?.getCurrentUser) {
        const me0 = window.sessionManager.getCurrentUser();
        if (me0?.id) return { id: me0.id, display_name: me0.display_name || me0.nickname || me0.name };
      }
      const res = await api.get('/me/profile-full');
      const p = res?.profile;
      if (p?.user_id) return { id: p.user_id, display_name: p.display_name || p.nickname || p.name };
    } catch (e) {
      console.error('getMe error:', e);
    }
    return null;
  }

  async function getPeerName(peerId) {
    try {
      if (!peerId) return null;
      const res = await api.get(`/users/${peerId}/profile`);
      const p = res?.profile;
      return p?.display_name || p?.nickname || p?.name || `사용자 #${peerId}`;
    } catch (e) {
      console.error('getPeerName error:', e);
      return `사용자 #${peerId}`;
    }
  }

  function addMsg(meId, m) {
    const box = document.getElementById('dm-messages');
    if (!box) return;
    const senderId = (m.sender_id ?? m.senderId);
    const mine = (senderId === meId);
    const line = document.createElement('div');
    line.style.margin = '6px 0';
    line.style.display = 'flex';
    line.style.justifyContent = mine ? 'flex-end' : 'flex-start';
    line.innerHTML = `<span style="display:inline-block;background:${mine ? '#6366f1' : '#e2e8f0'};color:${mine ? '#fff' : '#111827'};padding:6px 10px;border-radius:12px;max-width:80%;">${esc(m.body || '')}</span>`;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
  }

  function mountSocket(meId) {
    if (!window.io) {
      console.error('❌ Socket.IO client not loaded. <script src="/socket.io/socket.io.js"></script> 포함 필요');
      return null;
    }
    if (socket && socket.connected) return socket;

    socket = io('/dm', { path: '/socket.io', auth: { userId: meId }, withCredentials: true });

    socket.on('dm:message', (m) => {
      addMsg(meId, { sender_id: m.senderId ?? m.sender_id, body: m.body, ts: m.ts });
    });

    socket.on('connect_error', (e) => console.error('DM socket connect_error:', e?.message || e));
    socket.on('disconnect', (reason) => console.log('DM socket disconnected:', reason));

    return socket;
  }

  async function sendViaSocketOrRest(threadId, body) {
  // 소켓 연결 시: ACK 기다려서 성공/실패 판단
  if (socket?.connected) {
    return await new Promise((resolve) => {
      // 타임아웃 대비(네트워크 이슈 등) — 2초 후 성공 처리(서버 에코가 오면 어차피 보임)
      const to = setTimeout(() => resolve({ ok: true, echoedByServer: true, timeout: true }), 2000);
      socket.emit('dm:send', { threadId, body }, (resp) => {
        clearTimeout(to);
        resolve({ ok: !!resp?.ok, echoedByServer: true });
      });
    });
  }
  // REST 백업
  try {
    const r = await api.post(`/dm/${threadId}/send`, { body });
    return { ok: !!r?.success, echoedByServer: false };
  } catch (e) {
    console.error('REST send failed:', e);
    return { ok: false, echoedByServer: false };
  }
}

  async function openChatModalWith(otherUserId) {
    ensure();
    const overlay = document.getElementById('dm-overlay');
    const list = document.getElementById('dm-messages');
    const input = document.getElementById('dm-input');
    const sendBtn = document.getElementById('dm-send');
    const title = document.getElementById('dm-title');

    overlay.style.display = 'flex';
    list.innerHTML = '불러오는 중…';

    const me = await getMe();
    if (!me?.id) {
      alert('로그인이 필요합니다.');
      location.href = '/login';
      return;
    }

    try {
      const peerId = Number(otherUserId);
      if (!peerId || Number.isNaN(peerId)) throw new Error('상대 사용자 ID가 잘못되었습니다.');
      if (peerId === me.id) throw new Error('본인에게는 메시지를 보낼 수 없습니다.');

      // 1) 스레드 열기  (★ 여기부터는 /api 프리픽스 없이 순수 경로만!)
      const openRes = await api.post('/dm/open', { otherUserId: peerId });
      if (!openRes?.success || !openRes.threadId) throw new Error('스레드 생성 실패');
      currentThread = Number(openRes.threadId);
      currentPeerId = peerId;

      // 2) 타이틀
      try {
        const peerName = await getPeerName(currentPeerId);
        title.textContent = `${peerName} 님과의 대화`;
      } catch { title.textContent = '채팅'; }

      // 3) 메시지 이력
      const msgs = await api.get(`/dm/${currentThread}/messages`);
      list.innerHTML = '';
      (msgs?.messages || []).forEach(m => addMsg(me.id, m));

      // 4) 소켓 + 방 참가
      const s = mountSocket(me.id);
      if (s) {
        s.emit('join',   { threadId: currentThread });
        s.emit('dm:join',{ threadId: currentThread });
      }

      // 5) 전송 바인딩
      if (!bound) {
        const send = async () => {
          const body = (input.value || '').trim();
          if (!body || !currentThread) return;

          // 버튼 연타 방지
          sendBtn.disabled = true;
          try {
            const { ok, echoedByServer } = await sendViaSocketOrRest(currentThread, body);
            if (!ok) {
              alert('메시지 전송에 실패했습니다.');
              return;
            }
            // ✅ 성공 시 입력창 비우기 (소켓/REST 모두 공통)
            input.value = '';
            input.focus();

            // 소켓이 끊겨서 서버 에코가 안 오는 경우에만 로컬로 그려줌
            if (!echoedByServer) addMsg(me.id, { sender_id: me.id, body });
          } finally {
            sendBtn.disabled = false;
          }
        };
        sendBtn.addEventListener('click', send);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
        bound = true;
        }
      } catch (e) {
      console.error('openChatModalWith error:', e);
      list.innerHTML = '<div class="mini" style="color:#ef4444;">채팅을 열 수 없습니다.</div>';
      }
    }

  window.openChatModalWith = openChatModalWith;
  window.closeChatModal = closeModal;
})();
