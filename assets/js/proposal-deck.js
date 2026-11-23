/*
  공통 PPT 기획안 엔진 — 프리미엄 에디토리얼 디자인 시스템
  (기준: premium_editorial_portfolio_ppt_design_prompt.md · 다크 모노크롬 + 일렉트릭 블루 포인트, 1920×1080, 12컬럼 그리드)

  모든 업무(BASEBALL COMBINE, CSR, 이후 추가 업무)가 같은 엔진을 사용합니다.
    ProposalDeck.preview(deck)   → 미리보기 HTML (모달에 그대로 삽입)
    ProposalDeck.printHtml(deck) → 인쇄/PDF 용 HTML (#print-root 에 삽입)
    ProposalDeck.download(deck)  → 편집 가능한 .pptx 다운로드 (텍스트·도형·이미지 자리 모두 개별 개체)
    ProposalDeck.count(deck)     → 실제 슬라이드 수

  deck = {
    brand: 'BASEBALL COMBINE', kind: 'MARKETING PROPOSAL', title, subtitle, fileName,
    info: [['ORGANIZATION', 'SPYDER Korea'], ['DATE', '2026.11.23'], ...],   // 표지·마지막 장 하단 정보 (최대 3개)
    closing: { title: 'THANK YOU', text },
    slides: [ { type, no, en, title, ... } ]
  }
  slide type
    cover                                                    표지 (대형 타이포 + 우측 대형 이미지)
    overview  { lead, items:[{label,text}] }                 배경·목적 (에디토리얼 스플릿)
    divider   { align:'left'|'right' }                       섹션 구분 (풀블리드 이미지 + 대형 타이포)
    cases     { items:[{tag,title,text}], optional }         사례 (이미지 + 3단 그리드, 3개씩 자동 분할)
    insights  { items:[text], summary, optional }            인사이트 (대형 넘버링 3단)
    statement { text, notes:[{label,text}], mirror }         핵심 메시지 (대형 타이포 + 세로 이미지)
    steps     { items:[text], caption }                      실행 방안 (가로 이미지 + 세로 프로세스, 5개씩 분할)
    table     { rows:[[항목,값]], notes:[{label,text}] }      예산·기대효과 (데이터 표 + 정보 카드)
    kpi       { items:[{name,target}] }                      KPI (대형 지표)
    closing                                                  마무리 (미니멀 대형 타이포)
*/
(() => {
  'use strict';

  /* ───────── Design tokens ───────── */
  const W = 1920, H = 1080;
  const M = { l: 96, r: 96, t: 76, b: 64 };
  const GUT = 24, COL = (W - M.l - M.r - 11 * GUT) / 12;               // 122px
  const cx = i => M.l + i * (COL + GUT);
  const span = n => n * COL + (n - 1) * GUT;
  const CW = W - M.l - M.r;                                             // 1728
  const C = { bg: '081521', bg2: '080A0D', card: '151C24', text: 'FFFFFF', sub: 'AEB8C2', accent: '249FE5', line: '38434D', ph: '17232F', phLine: '52606D' };
  const FONT = 'Pretendard';
  const PH = '[도형 + 이미지 삽입 예정]';
  const LIB = (document.currentScript && document.currentScript.src || '').replace(/proposal-deck\.js.*$/, 'vendor/pptxgen.bundle.js');

  /* ───────── 텍스트 크기 계산 (미리보기·PPT 공통: 넘치면 글자 크기를 줄이고, 그래도 넘치면 말줄임) ───────── */
  const PX = 2;                                                         // 1pt = 2px (1920 캔버스 기준)
  function cw(ch) {
    if (/[ᄀ-ᇿ㄰-㆏가-힣一-鿿　-〿＀-￯]/.test(ch)) return 0.94;
    if (ch === ' ') return 0.27;
    if (/[A-Z0-9]/.test(ch)) return 0.64;
    if (/[a-z]/.test(ch)) return 0.54;
    return 0.4;
  }
  function wrapLines(text, size, w, ls) {
    const lim = w / (size * PX) / 1.05;                                // 5% 여유
    let lines = 0;
    for (const para of String(text).split('\n')) {
      let cur = 0; lines++;
      for (const word of para.split(/(\s+)/)) {
        let ww = 0; for (const ch of word) ww += cw(ch) + ls;
        if (cur + ww <= lim || (/^\s+$/.test(word))) { cur += ww; continue; }
        if (ww <= lim) { lines++; cur = ww; continue; }
        for (const ch of word) { const c = cw(ch) + ls; if (cur + c > lim) { lines++; cur = 0; } cur += c; }
      }
    }
    return lines;
  }
  /* 상자(w×h px)에 맞는 크기와 텍스트를 찾음 */
  function fit(text, w, h, size, min, lh, ls = 0) {
    text = String(text ?? '').replace(/\r/g, '').trim();
    const need = (t, s) => { const n = wrapLines(t, s, w, ls); return (n * lh - (lh - 1)) * s * PX; };   // 마지막 줄 아래 행간은 제외
    for (let s = size; s >= min; s -= 1) if (need(text, s) <= h) return { text, size: s, lines: wrapLines(text, s, w, ls) };
    let lo = 0, hi = text.length;
    while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); need(text.slice(0, mid) + '…', min) <= h ? (lo = mid) : (hi = mid - 1); }
    const t = text.slice(0, lo).trimEnd() + '…';
    return { text: t, size: min, lines: wrapLines(t, min, w, ls) };
  }

  /* ───────── 기본 요소 (좌표는 1920×1080 px) ───────── */
  const rect = (x, y, w, h, fill, o = {}) => ({ t: 'rect', x, y, w, h, fill, ...o });
  const line = (x, y, w, color = C.line, wt = 1) => ({ t: 'line', x, y, w, color, wt });
  const ph = (x, y, w, h) => ({ t: 'ph', x, y, w, h });
  /* text: size/min(pt), lh(행간 배수), ls(자간 em) */
  function text(x, y, w, h, str, o = {}) {
    const size = o.size || 13, lh = o.lh || 1.5, ls = o.ls || 0;
    const f = fit(o.upper ? String(str ?? '').toUpperCase() : str, w, h, size, o.min || size, lh, ls);
    return { t: 'text', x, y, w, h, text: f.text, size: f.size, lines: f.lines, lh, ls, bold: !!o.bold, color: o.color || C.text, align: o.align || 'left', valign: o.valign || 'top' };
  }
  const usedH = el => Math.min(el.h, (el.lines * el.lh - (el.lh - 1)) * el.size * PX);

  /* 공통 머리·꼬리 */
  function chrome(d, s, ctx) {
    return [
      text(M.l, M.t, 64, 26, s.no || '', { size: 10, bold: true, color: C.accent, ls: 0.08 }),
      text(M.l + 56, M.t, 760, 26, s.en || '', { size: 10, color: C.sub, ls: 0.12, upper: true }),
      text(W - M.r - 760, M.t, 760, 26, `${d.brand || ''}  ·  ${d.kind || ''}`, { size: 9, color: C.sub, ls: 0.1, align: 'right', upper: true }),
      line(M.l, 1004, CW),
      text(M.l, 1020, 300, 22, `${String(ctx.i).padStart(2, '0')} / ${String(ctx.n).padStart(2, '0')}`, { size: 9, color: C.sub, ls: 0.08 }),
      text(W - M.r - 700, 1020, 700, 22, d.title || '', { size: 9, color: C.sub, align: 'right' }),
    ];
  }
  const title = (s, w = span(8)) => text(M.l, 128, w, 168, s.title, { size: 34, min: 26, bold: true, lh: 1.15, ls: -0.01 });
  const info = (d, y) => {
    const items = (d.info || []).slice(0, 3);
    return [line(M.l, y, span(7)), ...items.flatMap(([k, v], i) => [
      text(M.l + i * 340, y + 24, 320, 22, k, { size: 9, color: C.sub, ls: 0.12, upper: true }),
      text(M.l + i * 340, y + 52, 320, 60, v, { size: 12, min: 10, bold: true, lh: 1.3 }),
    ])];
  };
  const empty = (msg = '내용을 입력하세요') => text(M.l, 360, span(8), 60, msg, { size: 15, color: C.sub });

  /* ───────── 레이아웃 ───────── */
  const L = {
    cover(d) {
      const t = text(M.l, 290, 900, 420, d.title, { size: 58, min: 36, bold: true, lh: 1.08, ls: -0.02 });
      const sy = t.y + usedH(t) + 32;
      return { bg: C.bg, els: [
        ph(1056, 0, 864, 1080),
        rect(M.l, 96, 56, 4, C.accent),
        text(M.l, 122, 860, 26, d.kind, { size: 11, color: C.sub, ls: 0.14, upper: true }),
        text(M.l, 152, 860, 26, d.brand, { size: 11, bold: true, ls: 0.14, upper: true }),
        t,
        text(M.l, sy, 840, Math.max(60, 860 - sy), d.subtitle, { size: 17, min: 13, color: C.sub, lh: 1.45 }),
        ...info(d, 900),
      ] };
    },

    overview(d, s, ctx) {
      const items = (s.items || []).filter(x => x && x.text).slice(0, 2);
      return { els: [
        ...chrome(d, s, ctx), title(s, span(5) + 60),
        text(M.l, 330, span(5), items.length ? 380 : 620, s.lead || '-', { size: 15, min: 11, color: C.sub, lh: 1.6 }),
        ...items.flatMap((it, i) => {
          const x = M.l + i * (span(5) / 2 + 12), w = span(5) / 2 - 12;
          return [line(x, 740, w), text(x, 760, w, 24, it.label, { size: 9, color: C.sub, ls: 0.12, upper: true }),
            text(x, 792, w, 190, it.text, { size: 13, min: 10, lh: 1.5 })];
        }),
        ph(cx(6) - 24, 128, span(6) + 24, 848),
      ] };
    },

    divider(d, s, ctx) {
      const right = s.align === 'right', x = right ? W - M.r - 1240 : M.l, al = right ? 'right' : 'left';
      return { bg: C.bg2, els: [
        ph(0, 0, W, H),
        rect(0, 600, W, 480, C.bg2, { alpha: 25 }),
        text(x, 700, 1240, 30, `${s.no || ''}   ${String(s.en || '').toUpperCase()}`, { size: 12, color: C.accent, bold: true, ls: 0.16, align: al }),
        text(x, 744, 1240, 190, s.title, { size: 60, min: 40, bold: true, lh: 1.05, ls: -0.02, align: al }),
        text(M.l, 1020, 300, 22, `${String(ctx.i).padStart(2, '0')} / ${String(ctx.n).padStart(2, '0')}`, { size: 9, color: C.sub, ls: 0.08 }),
      ] };
    },

    cases(d, s, ctx) {
      const items = s.items || [];
      if (!items.length) return { els: [...chrome(d, s, ctx), title(s), empty(s.empty)] };
      const n = items.length, w = (CW - (n - 1) * 40) / n, ih = n === 1 ? 420 : n === 2 ? 360 : 300;
      return { els: [...chrome(d, s, ctx), title(s), ...items.flatMap((it, i) => {
        const x = M.l + i * (w + 40), y = 330 + ih + 28;
        return [ph(x, 330, w, ih),
          text(x, y, w, 22, it.tag, { size: 9, color: C.sub, ls: 0.12, upper: true }),
          text(x, y + 32, w, 84, it.title, { size: 15, min: 12, bold: true, lh: 1.3 }),
          text(x, y + 128, w, 975 - (y + 128), it.text, { size: 11.5, min: 9, color: C.sub, lh: 1.55 })];
      })] };
    },

    insights(d, s, ctx) {
      const items = s.items || [];
      if (!items.length) return { els: [...chrome(d, s, ctx), title(s), empty(s.empty)] };
      const n = items.length, w = (CW - (n - 1) * 48) / n, bottom = s.summary ? 880 : 975;
      return { els: [...chrome(d, s, ctx), title(s), ...items.flatMap((t, i) => {
        const x = M.l + i * (w + 48);
        return [line(x, 350, w), text(x, 372, w, 110, String(i + 1 + (s.offset || 0)).padStart(2, '0'), { size: 48, bold: true, color: C.accent, lh: 1, ls: -0.02 }),
          text(x, 500, w, bottom - 500, t, { size: 15, min: 11, lh: 1.55 })];
      }), ...(s.summary ? [line(M.l, 900, CW), text(M.l, 922, CW, 60, s.summary, { size: 13, min: 11, color: C.sub, lh: 1.4 })] : [])] };
    },

    statement(d, s, ctx) {
      const notes = (s.notes || []).filter(x => x && x.text).slice(0, 2);
      const tx = s.mirror ? cx(5) : M.l, ix = s.mirror ? M.l : cx(8), tw = span(7);
      const big = text(tx, 330, tw, notes.length ? 500 : 640, s.text || '-', { size: 26, min: 15, lh: 1.4, ls: -0.01, bold: true });
      return { els: [...chrome(d, s, ctx), text(tx, 128, tw, 168, s.title, { size: 34, min: 26, bold: true, lh: 1.15, ls: -0.01 }),
        rect(tx, 306, 40, 3, C.accent), big,
        ...notes.flatMap((nt, i) => {
          const x = tx + i * (tw / 2 + 12), w = notes.length > 1 ? tw / 2 - 12 : tw;
          return [line(x, 856, w), text(x, 874, w, 22, nt.label, { size: 9, color: C.sub, ls: 0.12, upper: true }),
            text(x, 904, w, 80, nt.text, { size: 12, min: 9, color: C.sub, lh: 1.45 })];
        }),
        ph(ix, 200, span(4), 747)] };
    },

    steps(d, s, ctx) {
      const items = s.items || [];
      if (!items.length) return { els: [...chrome(d, s, ctx), title(s), empty(s.empty)] };
      const x0 = cx(7), w = span(5), top = 330, rowH = Math.min(150, (975 - top) / items.length);
      return { els: [...chrome(d, s, ctx), title(s, span(6)),
        ph(M.l, top, span(6) + 48, 520),
        text(M.l, top + 544, span(6), 60, s.caption || '', { size: 11, min: 9, color: C.sub, lh: 1.45 }),
        ...items.flatMap((t, i) => {
          const y = top + i * rowH;
          return [text(x0, y, 64, 30, String(i + 1 + (s.offset || 0)).padStart(2, '0'), { size: 13, bold: true, color: C.accent, ls: 0.06 }),
            ...(i < items.length - 1 ? [{ t: 'vline', x: x0 + 14, y: y + 40, h: rowH - 48, color: C.line, wt: 1 }] : []),
            text(x0 + 72, y, w - 72, rowH - 18, t, { size: 15, min: 10, lh: 1.45 })];
        })] };
    },

    table(d, s, ctx) {
      const rows = (s.rows || []).slice(0, 9), notes = (s.notes || []).filter(x => x && x.text).slice(0, 3);
      const tw = span(7), rh = 64, cardX = cx(8), cardW = span(4);
      const els = [...chrome(d, s, ctx), title(s),
        text(M.l, 330, 600, 22, s.head?.[0] || 'ITEM', { size: 9, color: C.sub, ls: 0.12, upper: true }),
        text(M.l + tw - 400, 330, 400, 22, s.head?.[1] || 'BUDGET', { size: 9, color: C.sub, ls: 0.12, align: 'right', upper: true }),
        line(M.l, 364, tw, C.sub)];
      if (!rows.length) els.push(text(M.l, 386, tw, 40, '설정 필요', { size: 14, color: C.sub }));
      rows.forEach(([a, b], i) => {
        const y = 364 + i * rh;
        els.push(text(M.l, y + 18, tw - 380, rh - 22, a, { size: 14, min: 10, lh: 1.25 }),
          text(M.l + tw - 360, y + 18, 360, rh - 22, b, { size: 14, min: 10, bold: true, align: 'right', lh: 1.25 }),
          line(M.l, y + rh, tw));
      });
      els.push(rect(cardX, 330, cardW, 645, C.card));
      els.push(rect(cardX + 40, 370, 40, 3, C.accent));
      const per = notes.length ? (645 - 90) / notes.length : 0;
      notes.forEach((nt, i) => {
        const y = 396 + i * per;
        els.push(text(cardX + 40, y, cardW - 80, 22, nt.label, { size: 9, color: C.sub, ls: 0.12, upper: true }),
          text(cardX + 40, y + 34, cardW - 80, per - 56, nt.text, { size: 14, min: 10, lh: 1.55 }));
      });
      return { els };
    },

    kpi(d, s, ctx) {
      const items = (s.items || []).slice(0, 8);
      if (!items.length) return { els: [...chrome(d, s, ctx), title(s), empty('KPI 설정 필요')] };
      const rows = items.length > 4 ? 2 : 1, per = Math.ceil(items.length / rows), w = (CW - (per - 1) * 32) / per;
      const cellH = rows === 2 ? 300 : 380, els = [...chrome(d, s, ctx), title(s)];
      items.forEach((k, i) => {
        const r = Math.floor(i / per), c = i % per, x = M.l + c * (w + 32), y = 340 + r * (cellH + 24);
        els.push(line(x, y, w, i === 0 ? C.accent : C.line, i === 0 ? 2 : 1),
          text(x, y + 22, w, 22, `KPI ${String(i + 1).padStart(2, '0')}`, { size: 9, color: C.sub, ls: 0.12 }),
          text(x, y + 60, w, cellH - 150, k.target || '설정 필요', { size: rows === 2 ? 28 : 34, min: 16, bold: true, lh: 1.15, ls: -0.01 }),
          text(x, y + cellH - 80, w, 70, k.name, { size: 13, min: 10, color: C.sub, lh: 1.4 }));
      });
      if (rows === 1) els.push(ph(M.l, 760, CW, 215));
      return { els };
    },

    closing(d) {
      const c = d.closing || {};
      return { bg: C.bg2, els: [
        rect(M.l, 330, 56, 4, C.accent),
        text(M.l, 360, 1500, 170, c.title || 'THANK YOU', { size: 66, min: 44, bold: true, lh: 1.02, ls: -0.02 }),
        text(M.l, 540, 1100, 160, c.text || d.title, { size: 17, min: 13, color: C.sub, lh: 1.5 }),
        ...info(d, 900),
      ] };
    },
  };

  /* 많은 항목은 여러 장으로 나눔 */
  const CHUNK = { cases: 3, insights: 3, steps: 5 };
  function expand(deck) {
    const out = [];
    for (const s of deck.slides || []) {
      const size = CHUNK[s.type], items = (s.items || []).filter(x => x && (typeof x === 'string' ? x.trim() : true));
      if (size && !items.length && s.optional) continue;
      if (!size || items.length <= size) { out.push({ ...s, items }); continue; }
      const parts = Math.ceil(items.length / size), per = Math.ceil(items.length / parts);   // 장마다 고르게 (6개 → 3+3)
      for (let p = 0; p < parts; p++) out.push({ ...s, items: items.slice(p * per, (p + 1) * per), offset: p * per, title: `${s.title}${p ? ` (${p + 1}/${parts})` : ''}`, summary: p === parts - 1 ? s.summary : '' });
    }
    return out;
  }
  function build(deck) {
    const slides = expand(deck);
    return slides.map((s, i) => {
      const r = (L[s.type] || L.statement)(deck, s, { i: i + 1, n: slides.length });
      return { bg: r.bg || C.bg, els: r.els };
    });
  }

  /* ───────── HTML 미리보기 ───────── */
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pc = (v, base) => `${(v / base * 100).toFixed(4)}%`;
  function elHtml(e) {
    const box = `left:${pc(e.x, W)};top:${pc(e.y, H)};`;
    if (e.t === 'rect') return `<i class="pd-el" style="${box}width:${pc(e.w, W)};height:${pc(e.h, H)};background:#${e.fill};opacity:${e.alpha != null ? 1 - e.alpha / 100 : 1}"></i>`;
    if (e.t === 'line') return `<i class="pd-el" style="${box}width:${pc(e.w, W)};height:0;border-top:${e.wt}px solid #${e.color}"></i>`;
    if (e.t === 'vline') return `<i class="pd-el" style="${box}width:0;height:${pc(e.h, H)};border-left:${e.wt}px solid #${e.color}"></i>`;
    if (e.t === 'ph') return `<i class="pd-el pd-ph" style="${box}width:${pc(e.w, W)};height:${pc(e.h, H)}"><span>${PH}</span></i>`;
    return `<div class="pd-el pd-tx" style="${box}width:${pc(e.w, W)};height:${pc(e.h, H)};font-size:${(e.size * PX / W * 100).toFixed(4)}cqw;line-height:${e.lh};letter-spacing:${e.ls}em;color:#${e.color};font-weight:${e.bold ? 700 : 400};text-align:${e.align}">${esc(e.text)}</div>`;
  }
  const slideHtml = s => `<div class="pd-slide" style="background:#${s.bg}">${s.els.map(elHtml).join('')}</div>`;

  const CSS = `
.pd-deck{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
@media (max-width:760px){.pd-deck{grid-template-columns:1fr}}
.pd-slide{position:relative;aspect-ratio:16/9;overflow:hidden;border-radius:6px;container-type:inline-size;font-family:Pretendard,'Pretendard Variable',system-ui,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.pd-el{position:absolute;display:block;box-sizing:border-box}
.pd-tx{white-space:pre-wrap;word-break:keep-all;overflow-wrap:anywhere}
.pd-ph{background:#${C.ph};border:1px solid #${C.phLine};display:flex;align-items:center;justify-content:center}
.pd-ph span{font-size:${(11 * PX / W * 100).toFixed(3)}cqw;color:#${C.sub};font-weight:500}
@media print{#print-root .pd-slide{width:100vw;height:100vh;aspect-ratio:auto;border-radius:0;break-after:page;page-break-after:always}}`;
  function injectCss() {
    if (document.getElementById('pd-css')) return;
    const st = document.createElement('style'); st.id = 'pd-css'; st.textContent = CSS; document.head.appendChild(st);
  }

  /* ───────── PPTX ───────── */
  let libP = null;
  function loadLib() {
    if (window.PptxGenJS) return Promise.resolve();
    return libP || (libP = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = LIB;
      s.onload = res; s.onerror = () => { libP = null; rej(new Error('PPT 라이브러리를 불러오지 못했습니다.')); };
      document.head.appendChild(s);
    }));
  }
  const IN = v => +(v / 144).toFixed(4);                                // 1920px = 13.333in
  async function download(deck) {
    await loadLib();
    const pptx = new window.PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.title = deck.title || 'Proposal';
    pptx.company = deck.brand || '';
    for (const s of build(deck)) {
      const sl = pptx.addSlide();
      sl.background = { color: s.bg };
      for (const e of s.els) {
        if (e.t === 'rect') sl.addShape(pptx.ShapeType.rect, { x: IN(e.x), y: IN(e.y), w: IN(e.w), h: IN(e.h), fill: { color: e.fill, transparency: e.alpha || 0 }, line: { type: 'none' } });
        else if (e.t === 'line') sl.addShape(pptx.ShapeType.line, { x: IN(e.x), y: IN(e.y), w: IN(e.w), h: 0, line: { color: e.color, width: e.wt * 0.75 } });
        else if (e.t === 'vline') sl.addShape(pptx.ShapeType.line, { x: IN(e.x), y: IN(e.y), w: 0, h: IN(e.h), line: { color: e.color, width: e.wt * 0.75 } });
        else if (e.t === 'ph') sl.addText(PH, { shape: pptx.ShapeType.rect, x: IN(e.x), y: IN(e.y), w: IN(e.w), h: IN(e.h), fill: { color: C.ph }, line: { color: C.phLine, width: 0.75 },
          fontFace: FONT, fontSize: 11, color: C.sub, align: 'center', valign: 'middle', margin: 0, lang: 'ko-KR' });
        else sl.addText(e.text, { x: IN(e.x), y: IN(e.y), w: IN(e.w), h: IN(e.h), fontFace: FONT, fontSize: e.size, bold: e.bold, color: e.color, align: e.align, valign: e.valign,
          margin: 0, lineSpacing: +(e.size * e.lh).toFixed(1), charSpacing: +(e.size * e.ls).toFixed(2), paraSpaceBefore: 0, paraSpaceAfter: 0, fit: 'none', wrap: true, lang: 'ko-KR' });
      }
    }
    const name = String(deck.fileName || deck.title || 'proposal').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    await pptx.writeFile({ fileName: `${name}.pptx` });
  }

  injectCss();
  window.ProposalDeck = {
    preview: deck => { injectCss(); return `<div class="pd-deck">${build(deck).map(slideHtml).join('')}</div>`; },
    printHtml: deck => { injectCss(); return build(deck).map(slideHtml).join(''); },
    count: deck => expand(deck).length,
    download,
  };
})();
