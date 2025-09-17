// public/js/chatModal.js
(function(){
  const tpl = `
  <div id="dm-overlay" class="overlay" style="display:none;position:fixed;inset:0;background:rgba(2,6,23,.55);align-items:center;justify-content:center;z-index:1000;">
    <div class="panel" style="width:min(520px,92%);background:#fff;border:1px solid #e2e8f0;border-radius:20px;box-shadow:0 20px 60px rgba(2,6,23,.35);padding:18px;">
      <header style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <h3 id="dm-title" style="margin:0;font-weight:800;font-size:18px;color:#0f172a;">채팅</h3>
        <button id="dm-close" class="btn" style="border-radius:12px;padding:6px 10px;border:1px solid #e2e8f0;background:#f8fafc;cursor:pointer;">닫기</button>
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

  function ensure() {
    if (document.getElementById('dm-overlay')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = tpl;
    document.body.appendChild(wrap.firstElementChild);
    const overlay = document.getElementById('dm-overlay');
    const btnClose = document.getElementById('dm-close');
    overlay.addEventListener('click', (e)=>{ if (e.target === overlay) overlay.style.display='none'; });
    btnClose.addEventListener('click', ()=> overlay.style.display='none');
  }

  function esc(s){ return typeof s==='string' ? s.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;' }[m])) : ''; }
  function addMsg(meId, m) {
    const box = document.getElementById('dm-messages');
    const mine = m.sender_id ? (m.sender_id === meId) : (m.senderId === meId);
    const line = document.createElement('div');
    line.style.margin = '6px 0';
    line.style.display = 'flex';
    line.style.justifyContent = mine ? 'flex-end' : 'flex-start';
    line.innerHTML = `<span style="display:inline-block;background:${mine?'#6366f1':'#e2e8f0'};color:${mine?'#fff':'#111827'};padding:6px 10px;border-radius:12px;max-width:80%;">${esc(m.body)}</span>`;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
  }

  async function openChatModalWith(otherUserId) {
    ensure();
    const overlay = document.getElementById('dm-overlay');
    const list = document.getElementById('dm-messages');
    const input = document.getElementById('dm-input');
    const sendBtn = document.getElementById('dm-send');
    const title = document.getElementById('dm-title');

    overlay.style.display='flex';
    list.innerHTML = '불러오는 중…';

    const me = window.sessionManager.getCurrentUser?.();
    if (!me) { alert('로그인이 필요합니다.'); location.href = '/login.html'; return; }

    try {
      // 1) 스레드 오픈/획득
      const r = await window.apiClient.post('/dm/open', { otherUserId: Number(otherUserId) });
      if (!r?.success || !r.threadId) throw new Error('스레드 생성 실패');
      currentThread = r.threadId;

      // 2) 초기 메시지 로드
      const msgs = await window.apiClient.get(`/dm/${currentThread}/messages`);
      list.innerHTML = '';
      (msgs?.messages || []).forEach(m => addMsg(me.id, m));

      // 3) 소켓 연결(join)
      if (!window.io) { console.error('Socket.IO client not loaded'); }
      if (!socket) {
        socket = io('/dm', { path:'/socket.io', auth: { userId: me.id } });
        socket.on('message', (m)=> {
          addMsg(me.id, { sender_id: m.senderId, body: m.body });
        });
      }
      socket.emit('join', { threadId: currentThread });

      // 4) 전송
      const send = ()=>{
        const body = (input.value||'').trim();
        if (!body) return;
        socket.emit('message', { threadId: currentThread, body });
        input.value = '';
      };
      sendBtn.onclick = send;
      input.onkeydown = (e)=>{ if (e.key === 'Enter') send(); };

      title.textContent = '채팅';
    } catch (e) {
      console.error(e);
      list.innerHTML = '<div class="mini" style="color:#ef4444;">채팅을 열 수 없습니다.</div>';
    }
  }

  window.openChatModalWith = openChatModalWith;
})();
