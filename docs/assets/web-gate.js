/* SPYDER AI Workspace 웹 버전 — 비밀번호로 data.enc.json 을 복호화한 뒤 기존 화면 스크립트를 실행
   (tools/cloud-common.js 의 buildWeb 이 docs/assets/web-gate.js 로 복사) */
(() => {
  const KEY = 'spyder.web.pw';
  const base = document.currentScript.src.replace(/assets\/web-gate\.js.*$/, '');
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const store = {
    get() { try { return localStorage.getItem(KEY); } catch { return null; } },
    set(v) { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch {} },
  };

  async function load() {
    const r = await fetch(`${base}data.enc.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) throw new Error('데이터를 불러오지 못했습니다.');
    return r.json();
  }
  async function decrypt(enc, pw) {
    const raw = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(enc.salt), iterations: enc.iter, hash: 'SHA-256' },
      raw, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(enc.iv) }, key, b64(enc.ct));
    return JSON.parse(new TextDecoder().decode(pt));
  }

  function ask(error) {
    return new Promise(resolve => {
      const ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(250,250,250,.96);font-family:Pretendard,system-ui,sans-serif';
      ov.innerHTML = `<form style="width:100%;max-width:340px;background:#fff;border:1px solid #e5e5e5;border-radius:16px;padding:28px 24px;box-shadow:0 10px 40px rgba(0,0,0,.06)">
        <img src="${base}assets/img/spyder-wordmark.png" alt="SPYDER" style="height:18px;display:block;margin-bottom:18px">
        <div style="font-size:11px;letter-spacing:.14em;color:#888;margin-bottom:6px">AI WORKSPACE</div>
        <div style="font-size:17px;font-weight:700;color:#111;margin-bottom:16px">비밀번호를 입력하세요</div>
        <input type="password" autocomplete="current-password" style="width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid #d4d4d4;border-radius:10px;font-size:16px;outline:none">
        <div style="min-height:18px;margin-top:8px;font-size:12px;color:#c0392b">${error ? '비밀번호가 올바르지 않습니다.' : ''}</div>
        <button style="width:100%;margin-top:6px;padding:12px;border:0;border-radius:10px;background:#111;color:#fff;font-size:15px;font-weight:600">열기</button>
      </form>`;
      document.body.appendChild(ov);
      const input = ov.querySelector('input');
      input.focus();
      ov.querySelector('form').onsubmit = e => { e.preventDefault(); const v = input.value; ov.remove(); resolve(v); };
    });
  }

  async function runWaiting() {
    for (const old of [...document.querySelectorAll('script[type="text/x-spyder-wait"]')]) {
      const s = document.createElement('script');
      for (const a of old.attributes) if (a.name !== 'type') s.setAttribute(a.name, a.value);
      if (old.src) {
        await new Promise(res => { s.onload = s.onerror = res; old.replaceWith(s); });
      } else { s.textContent = old.textContent; old.replaceWith(s); }
    }
  }

  const domReady = new Promise(r => (document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', r) : r()));

  (async () => {
    await domReady;
    let enc;
    try { enc = await load(); } catch (e) { document.body.insertAdjacentHTML('afterbegin', `<p style="padding:16px">${e.message}</p>`); return; }
    let data = null, pw = store.get(), wrong = false;
    while (!data) {
      if (!pw) pw = await ask(wrong);
      try { data = await decrypt(enc, pw); store.set(pw); } catch { pw = null; wrong = true; store.set(null); }
    }
    for (const f of Object.values(data.files)) window[f.global] = f.data;
    await runWaiting();

    // 새 데이터가 올라오면(매시간) 자동 새로고침
    const busy = () => (document.getElementById('modal-root') || {}).innerHTML || ['TEXTAREA', 'INPUT', 'SELECT'].includes((document.activeElement || {}).tagName);
    setInterval(async () => {
      try { const n = await load(); if (n.h !== enc.h && !busy()) location.reload(); } catch {}
    }, 120000);
  })();
})();
