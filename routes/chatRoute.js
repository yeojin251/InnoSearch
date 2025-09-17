// routes/chatRoute.js
// CommonJS 버전 (server.js의 require와 호환)
// - node-fetch 불필요 (Node 18+는 글로벌 fetch 내장)
// - OpenAI SSE 스트림을 파싱하여 텍스트만 전송

const express = require('express');
const router = express.Router();

// 안전 장치: API 키 없으면 바로 500
function ensureApiKey(req, res) {
  if (!process.env.OPENAI_API_KEY) {
    res.status(500).json({ ok: false, error: 'Missing OPENAI_API_KEY' });
    return false;
  }
  return true;
}

router.post('/chat', async (req, res) => {
  try {
    if (!ensureApiKey(req, res)) return;

    const { messages } = req.body;
    if (!Array.isArray(messages)) {
      return res.status(400).json({ ok: false, error: 'messages must be an array' });
    }

    // OpenAI Chat Completions (SSE streaming)
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        stream: true,
        messages
      })
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => '');
      return res.status(502).end(text || 'OpenAI upstream error');
    }

    // 프런트로 “텍스트”만 흘려보내기 위한 준비
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no'); // 일부 프록시 버퍼링 방지
    res.setHeader('Transfer-Encoding', 'chunked');

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder('utf-8');

    // OpenAI SSE 형식:
    // data: { "id": "...", "choices": [ { "delta": { "content": "..." } } ] }
    // data: [DONE]
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // 청크 내 개행 기준으로 분리
      let idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);

        // 빈 라인(sse keep-alive) 무시
        if (!line) continue;

        // SSE는 "data: ..." 라인으로 옴
        if (line.startsWith('data:')) {
          const data = line.slice(5).trim();

          if (data === '[DONE]') {
            res.end();
            return;
          }

          try {
            const json = JSON.parse(data);
            const delta = json?.choices?.[0]?.delta;
            const chunkText = delta?.content || '';
            if (chunkText) {
              res.write(chunkText);
            }
          } catch (e) {
            // JSON 파싱 실패 시 라인 전체를 무시 (로그만)
            // console.warn('SSE parse error:', e, 'line=', line);
          }
        }
      }
    }

    // 남은 버퍼 처리 (보통 필요 없음)
    if (buffer.trim()) {
      try {
        const json = JSON.parse(buffer.trim());
        const delta = json?.choices?.[0]?.delta;
        const chunkText = delta?.content || '';
        if (chunkText) res.write(chunkText);
      } catch (_) {}
    }

    res.end();
  } catch (err) {
    console.error('[/api/chat] error:', err);
    res.status(500).end('Chat proxy error');
  }
});

module.exports = router;
