/*
  공통 PPT 기획안 엔진 — EDITORIAL PROPOSAL DESIGN SYSTEM v2.1
  기준: editorial_proposal_ppt_design_prompt_v2.md + 제안서_템플릿_v2.pptx (assets/js/proposal-template.js 에 내장)

  모든 업무(BASEBALL COMBINE, CSR, 이후 추가 업무)가 같은 엔진을 사용합니다.
    ProposalDeck.preview(deck)   → 미리보기 HTML (명세 좌표 그대로)
    ProposalDeck.printHtml(deck) → 인쇄/PDF 용 HTML
    ProposalDeck.download(deck)  → 템플릿 PPTX 에 내용을 채워 .pptx 다운로드 (도형·그룹·소프트 에지·그라데이션 유지)
    ProposalDeck.count(deck)     → 슬라이드 수
    ProposalDeck.auto(fields)    → AI 원고(deck)가 없을 때 기존 기획안 필드에서 칸 길이에 맞춰 자동 구성

  deck = { meta: { kind, project, org, contact, date, fileName }, content }
  content (AI 원고 형식 — tools/deck-spec.js 와 같음)
    cover      { title, subtitle }
    background { background:[2줄], strategy:[2줄], execution:[2줄] }
    market     [{ source, headline, body }]
    insight    { cards:[[2줄],[2줄]], result:[2줄] }
    strategy   { lead, text, ideas:[{ label, title, lines:[≤3] }] }
    execution  { items:[{ title, desc }], programs:[{ title, desc }] }
    schedule   { lead, text, stages:[{ period, title, lines:[3] }] }
    budget     { rows:[{ item, cost }], total, note, effects:[{ title, lines:[2] }] }
    kpi        { lead, text, items:[{ value, name, desc }], measure:{ data, period, tool } }
    closing    { subtitle }
*/
(() => {
  'use strict';

  const BASE = (document.currentScript && document.currentScript.src || '').replace(/proposal-deck\.js.*$/, '');
  const W = 1920, H = 1080;
  const C = { bg: '#081521', text: '#FFFFFF', sub: '#AEB8C2', accent: '#249FE5', ph: '#17232F', phLine: '#52606D', line: '#38434D', rule: '#A6A6A6', card: 'rgba(51,63,80,.3)' };
  const PH = '[도형 + 이미지 삽입 예정]';
  const ENUM = '❶❷❸❹❺❻❼❽❾❿';

  /* ───────── 글자 수 (공백 포함 한글 기준, 영문·숫자는 1/1.3) ───────── */
  const wlen = s => [...String(s ?? '')].reduce((n, ch) => n + (/[\x00-\x7F]/.test(ch) ? 1 / 1.3 : 1), 0);
  function clamp(s, n) {
    s = String(s ?? '').replace(/\s+/g, ' ').trim();
    if (wlen(s) <= n) return s;
    const ch = [...s];
    while (ch.length && wlen(ch.join('') + '…') > n) ch.pop();
    return ch.join('').trimEnd() + '…';
  }
  /* 명사형 종결: "~연결합니다." → "~연결." */
  function nounify(s) {
    s = String(s ?? '').trim().replace(/[.。!]+$/, '');
    if (/합니다$/.test(s)) s = s.replace(/\s*합니다$/, '');                        // 연결합니다 → 연결
    else if (/습니다$/.test(s)) s = s.replace(/습니다$/, '음');                    // 있습니다 → 있음, 했습니다 → 했음
    else if (/니다$/.test(s)) {                                                     // 됩니다 → 됨, 바뀝니다 → 바뀜, 입니다 → 임
      const ch = [...s.slice(0, -2)], last = ch.pop(), code = last ? last.charCodeAt(0) - 0xAC00 : -1;
      s = code >= 0 && code < 11172 && code % 28 === 17 ? ch.join('') + String.fromCharCode(last.charCodeAt(0) - 1) : s.slice(0, -2);
    }
    return s ? s + '.' : '';
  }
  const sentences = t => String(t ?? '').replace(/\r/g, '').split(/(?<=[.!?。])\s+|\n+/).map(x => x.trim()).filter(Boolean);
  /* 단어 단위 줄바꿈 → 최대 max 줄 (넘치면 마지막 줄 말줄임) */
  function wrap(text, per, max) {
    const words = String(text ?? '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    const lines = []; let cur = '';
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (wlen(next) <= per) { cur = next; continue; }
      if (cur) lines.push(cur);
      cur = wlen(w) <= per ? w : clamp(w, per);
    }
    if (cur) lines.push(cur);
    if (lines.length > max) { const rest = lines.slice(max - 1).join(' '); lines.length = max - 1; lines.push(clamp(rest, per)); }
    return lines;
  }
  /* 문장을 명사형으로 바꿔, per×max 칸에 들어가는 만큼만 */
  function fitSentences(text, per, max) {
    const ss = sentences(text).map(nounify).filter(Boolean);
    if (!ss.length) return [];
    let acc = '';
    for (const s of ss) { const t = acc ? `${acc} ${s}` : s; if (wrap(t, per, 99).length <= max) acc = t; else break; }
    return wrap(acc || ss[0], per, max);
  }
  const lines = (v, per, max) => (Array.isArray(v) ? v.map(x => clamp(x, per)).filter(Boolean).slice(0, max) : fitSentences(v, per, max));
  const arr = v => (Array.isArray(v) ? v.filter(Boolean) : []);
  const isLatin = s => /^[\x00-\x7F]+$/.test(String(s || ''));
  const upperLatin = s => (isLatin(s) ? String(s).toUpperCase() : String(s || ''));
  const firstClause = s => String(s || '').split(/[:：(（,，·]| - | — /)[0].trim();
  const money = s => /^[\d,]+\s*원$/.test(String(s || '').trim());

  /* ───────── 자동 구성 (AI 원고가 없을 때) ───────── */
  function auto(f) {
    const rs = arr(f.research);
    const acts = arr(f.actions);
    const titleCore = (() => { const t = String(f.title || ''); const p = t.split(/ — | - |: /)[0].trim(); return wlen(p) <= 22 ? p : clamp(t, 22); })();
    const enLead = (() => { const m = String(f.title || '').match(/[A-Z][A-Z0-9 &'.\-]{3,}/); return m ? clamp(m[0].trim(), 20) : ''; })();
    const effS = sentences(f.effect);
    const timeline = String(f.timeline || '').split(/→|->|\n/).map(s => s.trim()).filter(Boolean);
    let stages = timeline.map(t => { const m = /^(\d{4}(?:\.\d{1,2})?(?:\s*[~\-–]\s*\d{1,4}(?:\.\d{1,2})?)?|\d{4}\s*시즌[^ ]*)/.exec(t); return { period: m ? m[1].replace(/\s+/g, '') : '설정 필요', title: clamp(m ? t.slice(m[0].length).trim() : t, 18) }; });
    if (stages.length < 3) stages = [{ period: '설정 필요', title: '준비' }, { period: '설정 필요', title: '실행' }, { period: '설정 필요', title: '확산·결과 정리' }];
    stages = stages.slice(0, 8);
    const per = Math.ceil(acts.length / stages.length) || 1;
    stages.forEach((s, i) => { s.lines = acts.slice(i * per, (i + 1) * per).slice(0, 3).map(a => clamp(firstClause(a) || a, 18)); });
    const rows = arr(f.budget).map(b => ({ item: clamp(b.item, 20), cost: money(b.cost) ? b.cost : /협의/.test(b.cost) ? '협의' : '설정 필요' }));
    const allMoney = rows.length && rows.every(r => money(r.cost));
    const total = allMoney ? rows.reduce((n, r) => n + +r.cost.replace(/[^\d]/g, ''), 0).toLocaleString('ko-KR') + '원' : '설정 필요';
    return {
      cover: { title: titleCore, subtitle: clamp(nounify(sentences(f.subtitle || f.goal)[0] || ''), 60) },
      background: { background: fitSentences(f.background, 32, 2), strategy: fitSentences(f.strategy, 32, 2), execution: fitSentences(acts.join('. '), 32, 2) },
      market: rs.map(r => ({ source: upperLatin(clamp(r.source, 20)), headline: clamp(r.title, 28), body: clamp(r.summary, 250) })),
      insight: {
        cards: (rs.length ? rs.map(r => r.insight) : [f.goal, f.target]).filter(Boolean).map(t => fitSentences(t, 18, 2)),
        result: fitSentences(f.result || f.goal, 32, 2),
      },
      strategy: {
        lead: enLead || 'CORE STRATEGY', text: clamp(nounify(sentences(f.strategy)[0] || ''), 50),
        ideas: (() => {
          const ss = sentences(f.strategyDetail || f.strategy).slice(1);
          const src = ss.length ? ss : sentences(f.strategy);
          return src.slice(0, 4).map((s, i) => ({ label: `IDEA ${String(i + 1).padStart(2, '0')}`, title: clamp(firstClause(s), 20), lines: fitSentences(s, 32, 3) }));
        })(),
      },
      execution: {
        items: acts.map(a => { const t = firstClause(a); return { title: clamp(t, 16), desc: clamp(nounify(a.length > t.length + 2 ? a.slice(t.length).replace(/^[\s:：(（,，·\-—]+/, '') : a), 26) }; }),
        programs: acts.slice(0, 3).map(a => ({ title: clamp(firstClause(a), 16), desc: clamp(nounify(a), 18) })),
      },
      schedule: { lead: 'SCHEDULE', text: clamp(nounify(timeline.length ? `${stages[0].period} 착수, ${stages[stages.length - 1].period} 결과 정리` : '단계별 일정 설정 필요'), 50), stages },
      budget: {
        rows: rows.length > 6 ? [...rows.slice(0, 5), { item: `기타 ${rows.length - 5}건`, cost: '협의' }] : rows,
        total, note: '※ 금액은 견적·협의 후 확정.',
        effects: [0, 1, 2].map(i => effS[i] ? { title: clamp(firstClause(effS[i]), 16), lines: fitSentences(effS[i], 20, 2) } : { title: '설정 필요', lines: [] }),
      },
      kpi: {
        lead: 'KPI', text: clamp(nounify(sentences(f.goal)[0] || ''), 50),
        items: arr(f.kpis).map(k => { const t = String(k.target || ''); const ok = t && wlen(t) <= 7 && !/설정/.test(t); return { value: ok ? t : '설정 필요', name: clamp(k.name, 16), desc: clamp(ok ? '목표 수치' : (t.replace(/^설정 필요\s*/, '').replace(/[()（）]/g, '') || '측정 기준 설정 필요'), 18) }; }),
        measure: { data: '설정 필요', period: '설정 필요', tool: '설정 필요' },
      },
      closing: { subtitle: clamp(nounify(effS[0] || sentences(f.goal)[0] || ''), 60) },
    };
  }

  /* ───────── 정규화 (명세 10장 글자 수 한도) ───────── */
  function normalize(content, fallback) {
    const c = { ...(fallback || {}), ...Object.fromEntries(Object.entries(content || {}).filter(([, v]) => v != null)) };
    const g = (k, d) => c[k] || (fallback && fallback[k]) || d;
    const cover = g('cover', {}), bg = g('background', {}), ins = g('insight', {}), st = g('strategy', {}), ex = g('execution', {}),
      sc = g('schedule', {}), bu = g('budget', {}), kp = g('kpi', {}), cl = g('closing', {});
    const note = clamp(bu.note || '', 80);
    return {
      cover: { title: clamp(cover.title, 22), subtitle: clamp(cover.subtitle, 60) },
      background: { background: lines(bg.background, 32, 2), strategy: lines(bg.strategy, 32, 2), execution: lines(bg.execution, 32, 2) },
      market: arr(g('market', [])).map(m => ({ source: clamp(upperLatin(m.source), 20), headline: clamp(m.headline || m.title, 28), body: clamp(m.body || m.summary, 250) })),
      insight: { cards: arr(ins.cards).map(x => lines(x, 18, 2)).filter(x => x.length), result: lines(ins.result, 32, 2) },
      strategy: { lead: clamp(String(st.lead || 'CORE STRATEGY').toUpperCase(), 20), text: clamp(st.text, 50),
        ideas: arr(st.ideas).map(i => ({ label: clamp(i.label, 10), title: clamp(i.title, 20), lines: lines(i.lines, 32, 3) })) },
      execution: { items: arr(ex.items).map(i => ({ title: clamp(i.title, 16), desc: clamp(i.desc, 26) })), programs: arr(ex.programs).map(i => ({ title: clamp(i.title, 16), desc: clamp(i.desc, 18) })) },
      schedule: { lead: clamp(String(sc.lead || 'SCHEDULE').toUpperCase(), 20), text: clamp(sc.text, 50),
        stages: arr(sc.stages).map(s => ({ period: clamp(s.period, 12), title: clamp(s.title, 18), lines: lines(s.lines, 18, 3) })) },
      budget: {
        rows: (() => { const r = arr(bu.rows).map(x => ({ item: clamp(x.item, 20), cost: clamp(x.cost || '설정 필요', 14) })); return r.length > 6 ? [...r.slice(0, 5), { item: `기타 ${r.length - 5}건`, cost: '협의' }] : r; })(),
        total: clamp(bu.total || '설정 필요', 14), note: note && !note.startsWith('※') ? clamp('※ ' + note, 80) : note,
        effects: [0, 1, 2].map(i => { const e = arr(bu.effects)[i] || {}; return { title: clamp(e.title || '설정 필요', 16), lines: lines(e.lines || [], 20, 2) }; }),
      },
      kpi: { lead: clamp(String(kp.lead || 'KPI').toUpperCase(), 20), text: clamp(kp.text, 50),
        items: arr(kp.items).map(k => ({ value: clamp(k.value || '설정 필요', 7), name: clamp(k.name, 16), desc: clamp(k.desc, 18) })),
        measure: { data: clamp(kp.measure?.data || '설정 필요', 28), period: clamp(kp.measure?.period || '설정 필요', 28), tool: clamp(kp.measure?.tool || '설정 필요', 28) } },
      closing: { subtitle: clamp(cl.subtitle, 60) },
    };
  }

  /* ───────── 페이지 구성 (07장 순서 + 09장 확장 규칙) ───────── */
  const HEAD = {
    background: ['01', 'BACKGROUND', '프로젝트 배경 및 목적'], market: ['02', 'MARKET ANALYSIS', '시장 및 경쟁사 분석'],
    insight: ['03', 'INSIGHT', '마케팅 인사이트'], strategy: ['04', 'CORE STRATEGY', '핵심 전략 및 아이디어'],
    execution: ['05', 'EXECUTION', '세부 실행 방안'], schedule: ['05', 'EXECUTION', '실행 일정'],
    budget: ['06', 'BUDGET & EFFECT', '예상 비용 및 기대 효과'], kpi: ['07', 'KPI', '성과 측정 지표'],
  };
  const chunks = (list, max) => {
    if (list.length <= max) return [list];
    const parts = Math.ceil(list.length / max), per = Math.ceil(list.length / parts);
    return Array.from({ length: parts }, (_, i) => list.slice(i * per, (i + 1) * per));
  };
  function plan(deck) {
    const c = normalize(deck.content, deck.fallback);
    const pages = [{ type: 'cover', c }];
    const add = (type, groups, mk) => groups.forEach((g, i) => pages.push({ type, part: groups.length > 1 ? ` (${i + 1}/${groups.length})` : '', ...mk(g, i) }));
    pages.push({ type: 'background', part: '', d: c.background });
    if (c.market.length) add('market', chunks(c.market, 3), g => ({ d: g }));
    add('insight', chunks(c.insight.cards.length ? c.insight.cards : [['설정 필요']], 2), g => ({ d: { cards: g, result: c.insight.result } }));
    add('strategy', chunks(c.strategy.ideas.length ? c.strategy.ideas : [{ label: 'IDEA 01', title: '설정 필요', lines: [] }], 2), g => ({ d: { ...c.strategy, ideas: g } }));
    const ex = chunks(c.execution.items.length ? c.execution.items : [{ title: '설정 필요', desc: '' }], 5);
    let off = 0;
    add('execution', ex, (g, i) => { const o = off; off += g.length; return { d: { items: g, offset: o, programs: c.execution.programs.slice(i * 3, i * 3 + 3) } }; });
    let so = 0;
    add('schedule', chunks(c.schedule.stages.length ? c.schedule.stages : [{ period: '설정 필요', title: '설정 필요', lines: [] }], 4), g => { const o = so; so += g.length; return { d: { ...c.schedule, stages: g, offset: o } }; });
    pages.push({ type: 'budget', part: '', d: c.budget });
    let ko = 0;
    add('kpi', chunks(c.kpi.items.length ? c.kpi.items : [{ value: '설정 필요', name: '설정 필요', desc: '' }], 4), g => { const o = ko; ko += g.length; return { d: { ...c.kpi, items: g, offset: o } }; });
    pages.push({ type: 'closing', c });
    pages.forEach((p, i) => { p.num = String(i + 1).padStart(2, '0'); });
    return { c, pages, meta: deck.meta || {} };
  }

  /* ───────── HTML 미리보기 (명세 좌표) ───────── */
  const T = {
    DISPLAY: [700, 25, C.text, -0.96, { pt: 51.8 }], PAGE_TITLE: [900, 15, C.text], HEAD_NUM: [700, 10, C.accent, 0.8, { pt: 15 }],
    HEAD_CAT: [200, 10, C.sub, 1.2, { pt: 15 }], KICKER: [400, 10, C.sub, 1.54, { pt: 16.5 }], COVER_SUB: [400, 10.5, C.sub, 0, { pt: 23.2 }],
    LEAD: [600, 14, C.accent], LEAD_TEXT: [600, 12, C.text], LABEL: [800, 12, C.accent], BODY: [400, 12.5, C.text, 0, { m: 1.5 }],
    CELL: [400, 12.5, C.text], ITEM_TITLE: [900, 12, C.text], ITEM_TEXT: [400, 12, C.text], LIST_TITLE: [600, 12.5, C.accent],
    CARD_TITLE: [900, 11, C.text], SEMI11: [600, 11, C.text], TAG: [600, 10.5, C.text], ENUM: [500, 18, C.accent], ENUM_S: [500, 14, C.accent],
    META_LABEL: [400, 9, C.sub, 1.08, { pt: 13.5 }], META_VALUE: [700, 12, C.text, 0, { pt: 15.6 }], SMALL: [400, 9, C.sub, 0, { pt: 14 }],
    LOGO: [400, 9, C.sub, 0.9, { pt: 13.5 }], PAGE_NUM: [400, 9, C.sub, 0.72, { pt: 13.5 }],
  };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const P = (v, b) => `${(v / b * 100).toFixed(3)}%`;
  const CQ = v => `${(v / W * 100).toFixed(4)}cqw`;
  const box = (x, y, w, h) => `left:${P(x, W)};top:${P(y, H)};${w != null ? `width:${P(w, W)};` : ''}${h != null ? `height:${P(h, H)};` : ''}`;
  /* 텍스트. mode A: 고정 박스(여백 0) / B: 자동 맞춤(여백 좌 0.1in·상 0.05in, 줄바꿈 없음) */
  function tx(x, y, w, h, content, tok, o = {}) {
    const [wt, size, color, ls = 0, lh = { m: 1 }] = T[tok];
    const lineH = lh.pt ? (lh.pt / size).toFixed(3) : (lh.m * 1.2).toFixed(3);
    const B = o.mode === 'B';
    const html = (Array.isArray(content) ? content : [content]).map(r => (typeof r === 'object' && r ? `<span style="color:${r.color}">${esc(r.text)}</span>` : esc(r))).join('\n');
    const st = `${box(B ? x + 14.4 : x, B ? y + 7.2 : y, B ? null : w, B ? null : h)}font-weight:${wt};font-size:${CQ(size * 2)};color:${o.color || color};letter-spacing:${(ls / size).toFixed(3)}em;line-height:${lineH};text-align:${o.align || 'left'};${B ? 'white-space:pre;' : ''}${o.valign === 'middle' ? 'display:flex;flex-direction:column;justify-content:center;' : ''}${o.align === 'center' && o.valign === 'middle' ? 'align-items:center;' : ''}`;
    return `<div class="pd-t" style="${st}">${o.valign === 'middle' ? `<span>${html}</span>` : html}</div>`;
  }
  const bx = (x, y, w, h, css) => `<i class="pd-e" style="${box(x, y, w, h)}${css}"></i>`;
  const ph = (x, y, w, h, o = {}) => `<i class="pd-e pd-ph${o.soft ? ' pd-soft' : ''}" style="${box(x, y, w, h)}"></i><div class="pd-t pd-phx" style="${box(x, y, w, h)}font-size:${CQ((o.small ? 9 : 11) * 2)}">${PH}</div>`;
  const card = (x, y, w, h) => bx(x, y, w, h, `background:${C.card};border-radius:${CQ(Math.min(w, h) * 0.16667)};filter:blur(${CQ(1.6)})`);
  const hl = (x, y, w, color = C.line) => bx(x, y, w, null, `height:0;border-top:${CQ(1.5)} solid ${color}`);
  const grad = (x, y, w, kind) => bx(x, y, w, null, `height:${CQ(1.5)};background:${kind === 'cover' ? `linear-gradient(90deg,#F2F2F2,${C.bg})` : `linear-gradient(90deg,${C.bg} 0%,#fff 30%,#fff 70%,${C.bg} 100%)`}`);
  const chevrons = (x, y) => [0, 20.5, 41].map((dx, i) => bx(x + dx, y, 19, 19, `background:${C.accent};opacity:${[0.2, 0.5, 1][i]};clip-path:polygon(0 0,50% 0,100% 50%,50% 100%,0 100%,50% 50%)`)).join('');

  function header(p) {
    const [no, cat, title] = HEAD[p.type];
    return tx(96, 76, 64, 28, no, 'HEAD_NUM') + tx(134.6, 76, 760, 26, cat, 'HEAD_CAT') + tx(81.5, 106, null, null, title + p.part, 'PAGE_TITLE', { mode: 'B' }) +
      tx(1064, 79.4, 760, 26, 'LOGO', 'LOGO', { align: 'right' }) + tx(1524, 993, 300, 22, p.num, 'PAGE_NUM', { align: 'right' });
  }
  const lead = d => tx(81.1, 207.8, null, null, d.lead, 'LEAD', { mode: 'B' }) + tx(81.1, 256, null, null, d.text, 'LEAD_TEXT', { mode: 'B' });

  const VIEW = {
    cover(p, m, closing) {
      const c = p.c, info = closing ? [['ORGANIZATION', m.org], ['CONTACT', m.contact || '설정 필요'], ['DATE', m.date]] : [['ORGANIZATION', m.org], ['PROJECT', m.project], ['DATE', m.date]];
      return ph(1116, 0, 804, 1080) + bx(96, 336, 56, 4, `background:${C.accent}`) +
        tx(96, 352, 860, 66, [{ text: String(m.kind || '').toUpperCase(), color: C.sub }, { text: String(m.project || '').toUpperCase(), color: C.text }], 'KICKER') +
        tx(96, 441.8, 1692, 92, closing ? 'THANK YOU' : c.cover.title, 'DISPLAY', { valign: 'middle' }) +
        tx(96, 529.5, 1014, 40.3, closing ? c.closing.subtitle : c.cover.subtitle, 'COVER_SUB') + grad(96, 868, 998, 'cover') +
        info.map(([k, v], i) => tx(96 + 340 * i, 892, 320, 22, k, 'META_LABEL') + tx(96 + 340 * i, 920, 320, 60, v, 'META_VALUE')).join('');
    },
    closing(p, m) { return VIEW.cover(p, m, true); },
    background(p) {
      const d = p.d, sec = (y, label, body) => tx(81.5, y, null, null, label, 'LABEL', { mode: 'B' }) + tx(81.5, y + 37.2, null, null, body.join('\n'), 'BODY', { mode: 'B' });
      return header(p) + sec(265, 'BACKGROUND', d.background) + hl(96, 444.1, 594) + sec(485.7, 'STRATEGY', d.strategy) + hl(97, 664.8, 594) + sec(706.5, 'EXECUTION', d.execution) +
        ph(1048, 207.4, 776, 168) + ph(1048, 383.4, 388, 482.8) + ph(1436, 383.4, 388, 482.8);
    },
    market(p) {
      return header(p) + p.d.map((m, i) => { const x = [96, 685.3, 1274.7][i];
        return ph(x, 252.3, 549.3, 300, { soft: true }) + tx(x, 580.3, 549.3, 22, m.source, 'META_LABEL') + tx(x, 612.3, 549.3, 35.4, m.headline, 'META_VALUE') + tx(x, 657.7, 549.3, 189, m.body, 'SMALL');
      }).join('');
    },
    insight(p) {
      return header(p) + p.d.cards.map((cd, i) => { const x = 96 + 474.2 * i;
        return card(x, 305.1, 442, 299.9) + tx(x, 245.1, 442, 26, `INSIGHT ${'➀➁➂➃➄➅'[i + (p.part ? (+p.part.match(/\d/)[0] - 1) * 2 : 0)] || ''}`, 'TAG', { align: 'center' }) +
          grad(x + 69.8, 287.8, 302.4) + tx(x, 406.5, 442, 92, cd.join('\n'), 'BODY', { align: 'center', valign: 'middle' });
      }).join('') + tx(96, 696.3, 908, 28, 'RESULT', 'LABEL', { align: 'center' }) + tx(96, 733.5, 908, 92, p.d.result.join('\n'), 'BODY', { align: 'center' }) +
        ph(1309.6, 167.4, 514.4, 771.1, { soft: true });
    },
    strategy(p) {
      return header(p) + lead(p.d) + p.d.ideas.map((it, r) => { const dy = 316.4 * r;
        return tx(81.1, 357.9 + dy, null, null, it.label, 'TAG', { mode: 'B' }) + hl(272, 378.5 + dy, 1418, C.rule) +
          ph(86.5, 418.7 + dy, 423.5, 213.3, { soft: true }) + ph(514.6, 418.7 + dy, 423.5, 213.3, { soft: true }) +
          tx(981, 427.3 + dy, null, null, it.title, 'ITEM_TITLE', { mode: 'B' }) + it.lines.map((l, k) => tx(981, 470.9 + 44.7 * k + dy, null, null, `> ${l}`, 'ITEM_TEXT', { mode: 'B' })).join('');
      }).join('');
    },
    execution(p) {
      const ys = [251.2, 350.9, 450.6, 550.4, 650.1];
      return header(p) + p.d.items.map((it, i) => tx(83.2, ys[i], null, null, ENUM[p.d.offset + i] || '', 'ENUM', { mode: 'B' }) +
        tx(128, ys[i], null, null, it.title, 'LIST_TITLE', { mode: 'B' }) + tx(128, ys[i] + 33.5, null, null, it.desc, 'SEMI11', { mode: 'B' })).join('') +
        p.d.programs.map((g, i) => { const x = [704.2, 1088.6, 1473][i];
          return card(x, 407.6, 351, 526.4) + ph(x + 70.4, 497.1, 210, 173.7, { small: true }) + tx(x, 702.8, 351, 26, g.title, 'CARD_TITLE', { align: 'center' }) + tx(x, 784.4, 351, 26, g.desc, 'SEMI11', { align: 'center' });
        }).join('');
    },
    schedule(p) {
      const n = p.d.stages.length;
      return header(p) + lead(p.d) + hl(96, 420, 1728, C.rule) + p.d.stages.map((s, i) => { const x = 96 + 440 * i;
        return tx(x - 13, 370, null, null, ENUM[p.d.offset + i] || '', 'ENUM_S', { mode: 'B' }) + tx(x + 30.7, 371.8, null, null, s.period, 'LIST_TITLE', { mode: 'B' }) +
          (i < n - 1 ? chevrons(x + 348, 384.7) : '') + card(x, 452, 408, 420) + tx(x, 492, 408, 30, s.title, 'ITEM_TITLE', { align: 'center' }) +
          [0, 1, 2].map(k => tx(x, 536 + 44 * k, 408, 28, s.lines[k] || '', 'ITEM_TEXT', { align: 'center' })).join('') + ph(x + 32, 682, 344, 150, { small: true });
      }).join('');
    },
    budget(p) {
      const d = p.d, n = Math.max(d.rows.length, 1), Y = 742 + 72 * (n - 5);
      return header(p) + tx(96, 302, 400, 30, 'ITEM', 'LABEL') + tx(612, 302, 400, 30, 'BUDGET', 'LABEL', { align: 'right' }) + hl(96, 360, 916) +
        (d.rows.length ? d.rows : [{ item: '설정 필요', cost: '설정 필요' }]).map((r, i) => tx(96, 380 + 72 * i, 500, 38, r.item, 'CELL') + tx(612, 380 + 72 * i, 400, 38, r.cost, 'CELL', { align: 'right' }) + hl(96, 432 + 72 * i, 916)).join('') +
        bx(96, Y, 916, 30, `background:${C.accent};opacity:.3`) + tx(96, Y, 516, 30, 'TOTAL', 'ITEM_TITLE', { valign: 'middle' }) + tx(612, Y, 400, 30, d.total, 'ITEM_TITLE', { align: 'right', valign: 'middle' }) +
        hl(96, Y + 50, 916, C.rule) + tx(96, Y + 78, 916, 40, d.note, 'SMALL') +
        tx(1310, 245, 514, 30, 'EXPECTED EFFECT', 'TAG', { align: 'center' }) + grad(1416, 288, 302) + card(1310, 305, 514, 633) +
        d.effects.map((e, i) => { const y = [365, 555, 745][i];
          return tx(1337, y, null, null, ENUM[i], 'ENUM', { mode: 'B' }) + tx(1382, y, null, null, e.title, 'LIST_TITLE', { mode: 'B' }) + [0, 1].map(k => tx(1382, y + 34 * (k + 1), null, null, e.lines[k] || '', 'SEMI11', { mode: 'B' })).join('');
        }).join('') + hl(1350, 515, 434) + hl(1350, 705, 434);
    },
    kpi(p) {
      const d = p.d, labels = [['DATA', d.measure.data], ['PERIOD', d.measure.period], ['TOOL', d.measure.tool]];
      return header(p) + lead(d) + d.items.map((k, i) => { const x = 96 + 440 * i;
        return card(x, 358, 408, 360) + tx(x, 401, 408, 26, `KPI ${String(d.offset + i + 1).padStart(2, '0')}`, 'TAG', { align: 'center' }) + grad(x + 84, 444, 240) +
          tx(x, 472, 408, 92, k.value, 'DISPLAY', { align: 'center', valign: 'middle' }) + tx(x, 598, 408, 26, k.name, 'CARD_TITLE', { align: 'center' }) + tx(x, 640, 408, 26, k.desc, 'SEMI11', { align: 'center' });
      }).join('') + tx(81, 770, null, null, '측정 방법', 'TAG', { mode: 'B' }) + hl(272, 790, 1552, C.rule) +
        labels.map(([k, v], i) => { const x = [81, 670, 1260][i]; return tx(x, 826, null, null, k, 'LABEL', { mode: 'B' }) + tx(x, 864, null, null, v, 'BODY', { mode: 'B' }); }).join('');
    },
  };
  const slideHtml = (p, m) => `<div class="pd-slide">${VIEW[p.type](p, m)}</div>`;

  const CSS = `
.pd-deck{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
@media (max-width:760px){.pd-deck{grid-template-columns:1fr}}
.pd-slide{position:relative;aspect-ratio:16/9;overflow:hidden;border-radius:6px;background:${C.bg};container-type:inline-size;font-family:Pretendard,'Pretendard Variable',system-ui,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.pd-e{position:absolute;display:block;box-sizing:border-box}
.pd-t{position:absolute;box-sizing:border-box;word-break:keep-all;overflow-wrap:anywhere;white-space:pre-wrap}
.pd-ph{background:${C.ph};border:${CQ(1.5)} solid ${C.phLine}}
.pd-soft{filter:blur(${CQ(1.6)})}
.pd-phx{display:flex;align-items:center;justify-content:center;color:${C.sub};text-align:center}
.pd-bar{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;justify-content:space-between;margin:0 0 12px;font-size:12px}
.pd-src{color:#6b7280}.pd-src.ai{color:#111;font-weight:600}
.pd-bar label{display:flex;gap:8px;align-items:center;font-size:11px;letter-spacing:.08em;color:#6b7280}
.pd-bar input{height:30px;border:1px solid #d4d4d4;border-radius:8px;padding:0 10px;font-size:13px;min-width:240px;font-family:inherit}
@media print{#print-root .pd-slide{width:100vw;height:100vh;aspect-ratio:auto;border-radius:0;break-after:page;page-break-after:always}}`;
  function injectCss() {
    if (document.getElementById('pd-css')) return;
    const st = document.createElement('style'); st.id = 'pd-css'; st.textContent = CSS; document.head.appendChild(st);
  }

  /* ───────── PPTX: 템플릿에 내용 채우기 ───────── */
  const NS = { a: 'http://schemas.openxmlformats.org/drawingml/2006/main', p: 'http://schemas.openxmlformats.org/presentationml/2006/main' };
  const EMU = 6350;
  const TPL = { cover: 1, background: 2, market: 3, insight: 4, strategy: 5, execution: 6, schedule: 7, budget: 8, kpi: 9, closing: 10 };
  const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('PPT 생성 모듈을 불러오지 못했습니다.')); document.head.appendChild(s); });
  let libs = null;
  const loadLibs = () => libs || (libs = Promise.all([
    window.JSZip ? 0 : loadScript(BASE + 'vendor/jszip.min.js'),
    window.PROPOSAL_TEMPLATE_B64 ? 0 : loadScript(BASE + 'proposal-template.js'),
  ]).catch(e => { libs = null; throw e; }));

  const all = (el, tag, ns = 'p') => [...el.getElementsByTagNameNS(NS[ns], tag)];
  const nameOf = el => { const c = el.getElementsByTagNameNS(NS.p, 'cNvPr')[0]; return c ? c.getAttribute('name') : ''; };
  const textOf = el => all(el, 't', 'a').map(t => t.textContent).join('');
  const shapes = doc => [...all(doc, 'sp'), ...all(doc, 'grpSp'), ...all(doc, 'cxnSp')];
  const byName = (doc, name) => shapes(doc).find(e => nameOf(e) === name);
  const remove = el => el && el.parentNode && el.parentNode.removeChild(el);

  function setLines(sp, list) {
    if (!sp) return;
    const body = sp.getElementsByTagNameNS(NS.p, 'txBody')[0];
    const paras = all(body, 'p', 'a').filter(p => p.parentNode === body);
    const tpls = paras.map(p => p.cloneNode(true));
    paras.forEach(remove);
    (list.length ? list : ['']).forEach((line, i) => {
      const p = tpls[Math.min(i, tpls.length - 1)].cloneNode(true);
      all(p, 'br', 'a').forEach(remove);
      const runs = all(p, 'r', 'a');
      runs.slice(1).forEach(remove);
      if (runs[0]) runs[0].getElementsByTagNameNS(NS.a, 't')[0].textContent = line;
      body.appendChild(p);
    });
  }
  const setText = (sp, text) => setLines(sp, [String(text ?? '')]);
  function shiftY(el, dy) {
    const off = el.getElementsByTagNameNS(NS.a, 'off')[0];
    off.setAttribute('y', String(Math.round(+off.getAttribute('y') + dy * EMU)));
  }
  function growGroup(g, dy) {
    for (const tag of ['ext', 'chExt']) { const e = g.getElementsByTagNameNS(NS.a, tag)[0]; e.setAttribute('cy', String(Math.max(0, Math.round(+e.getAttribute('cy') + dy * EMU)))); }
  }
  function cloneAfter(el, after, dy, idState) {
    const c = el.cloneNode(true);
    for (const n of c.getElementsByTagNameNS(NS.p, 'cNvPr')) n.setAttribute('id', String(++idState.max));
    shiftY(c, dy);
    after.parentNode.insertBefore(c, after.nextSibling);
    return c;
  }

  function fillHeader(doc, p) {
    const num = shapes(doc).find(e => e.localName === 'sp' && nameOf(e) === 'Text 0' && /^\d+$/.test(textOf(e)));
    if (num) { const title = all(num.parentNode, 'sp').find(e => e !== num && /^TextBox/.test(nameOf(e))); if (title && p.part) setText(title, textOf(title) + p.part); }
    const pn = shapes(doc).find(e => e.localName === 'sp' && nameOf(e) === 'Text 4' && /^\d+$/.test(textOf(e)));
    if (pn) setText(pn, p.num);
  }
  const fillLead = (doc, d) => { setText(byName(doc, 'TextBox 1'), d.lead); setText(byName(doc, 'TextBox 3'), d.text); };

  const FILL = {
    cover(doc, p, m) {
      const closing = p.type === 'closing';
      setLines(byName(doc, 'Text 2'), [String(m.kind || '').toUpperCase(), String(m.project || '').toUpperCase()]);
      setText(byName(doc, 'Text 4'), closing ? 'THANK YOU' : p.c.cover.title);
      setText(byName(doc, 'Text 5'), closing ? p.c.closing.subtitle : p.c.cover.subtitle);
      setText(byName(doc, 'Text 8'), m.org || '');
      setText(byName(doc, 'Text 10'), closing ? (m.contact || '설정 필요') : (m.project || ''));
      setText(byName(doc, 'Text 12'), m.date || '');
    },
    closing(doc, p, m) { FILL.cover(doc, p, m); },
    background(doc, p) {
      setLines(byName(doc, 'TextBox 26'), p.d.background); setLines(byName(doc, 'TextBox 32'), p.d.strategy); setLines(byName(doc, 'TextBox 35'), p.d.execution);
    },
    market(doc, p) {
      const cols = [['Text 7', 'Text 8', 'Text 9', 'Text 10'], ['Text 11', 'Text 12', 'Text 13', 'Text 14'], ['Text 15', 'Text 16', 'Text 17', 'Text 18']];
      cols.forEach((names, i) => {
        const [phN, src, head, body] = names.map(n => byName(doc, n)), m = p.d[i];
        if (!m) { [phN, src, head, body].forEach(remove); return; }
        setText(src, m.source); setText(head, m.headline); setText(body, m.body);
      });
    },
    insight(doc, p) {
      const base = p.part ? (+p.part.match(/\d/)[0] - 1) * 2 : 0;
      [['그룹 55', 'TextBox 63', 'TextBox 47'], ['그룹 56', 'TextBox 65', 'TextBox 58']].forEach(([g, t, tag], i) => {
        if (!p.d.cards[i]) { remove(byName(doc, g)); remove(byName(doc, t)); return; }
        setLines(byName(doc, t), p.d.cards[i]); setText(byName(doc, tag), `INSIGHT ${'➀➁➂➃➄➅➆➇'[base + i]}`);
      });
      setLines(byName(doc, 'TextBox 41'), p.d.result);
    },
    strategy(doc, p) {
      fillLead(doc, p.d);
      [['그룹 29', 'TextBox 5', 'TextBox 14', ['TextBox 16', 'TextBox 25', 'TextBox 28']], ['그룹 30', 'TextBox 31', 'TextBox 37', ['TextBox 38', 'TextBox 39', 'TextBox 40']]].forEach(([g, lb, tt, ls], i) => {
        const it = p.d.ideas[i];
        if (!it) { remove(byName(doc, g)); return; }
        setText(byName(doc, lb), it.label); setText(byName(doc, tt), it.title);
        ls.forEach((n, k) => (it.lines[k] ? setText(byName(doc, n), `> ${it.lines[k]}`) : remove(byName(doc, n))));   // 템플릿: 줄 앞 "> " 표시
      });
    },
    execution(doc, p) {
      ['그룹 46', '그룹 47', '그룹 51', '그룹 55', '그룹 59'].forEach((g, i) => {
        const grp = byName(doc, g), it = p.d.items[i];
        if (!it) { remove(grp); return; }
        const sps = all(grp, 'sp');
        setText(sps[0], ENUM[p.d.offset + i]); setText(sps[1], it.title); setText(sps[2], it.desc);
      });
      [['그룹 67', 'TextBox 64', 'TextBox 66'], ['그룹 68', 'TextBox 70', 'TextBox 71'], ['그룹 74', 'TextBox 76', 'TextBox 77']].forEach(([g, t, d], i) => {
        const pg = p.d.programs[i];
        if (!pg) { remove(byName(doc, g)); return; }
        setText(byName(doc, t), pg.title); setText(byName(doc, d), pg.desc);
      });
    },
    schedule(doc, p) {
      fillLead(doc, p.d);
      const n = p.d.stages.length;
      for (let k = 1; k <= 4; k++) {
        const s = p.d.stages[k - 1];
        const els = [byName(doc, `P7-step${k}-1`), byName(doc, `P7-step${k}-2`), byName(doc, `P7-card${k}`)];
        if (!s) { els.forEach(remove); continue; }
        setText(els[0], ENUM[p.d.offset + k - 1]); setText(els[1], s.period);
        setText(byName(doc, `P7-card${k}-2`), s.title);
        [3, 4, 5].forEach((j, li) => setText(byName(doc, `P7-card${k}-${j}`), s.lines[li] || ''));
      }
      ['그룹 16', '그룹 25', '그룹 31'].forEach((g, i) => { if (i >= n - 1) remove(byName(doc, g)); });
    },
    budget(doc, p, m, ids) {
      const d = p.d, rows = d.rows.length ? d.rows : [{ item: '설정 필요', cost: '설정 필요' }], n = rows.length, dy = 72 * (n - 5);
      const el = k => byName(doc, `P8-table-${k}`);
      if (n > 5) {
        let after = el(18);
        for (let r = 6; r <= n; r++) {
          const base = [el(16), el(17), el(18)];
          base.forEach((b, j) => { after = cloneAfter(b, after, 72 * (r - 5), ids); after.getElementsByTagNameNS(NS.p, 'cNvPr')[0].setAttribute('name', `P8-table-r${r}-${j}`); });
        }
      }
      const rowEls = r => (r <= 5 ? [el(4 + 3 * (r - 1)), el(5 + 3 * (r - 1)), el(6 + 3 * (r - 1))] : [0, 1, 2].map(j => byName(doc, `P8-table-r${r}-${j}`)));
      for (let r = 1; r <= Math.max(5, n); r++) {
        const [a, b, line] = rowEls(r);
        if (r > n) { [a, b, line].forEach(remove); continue; }
        setText(a, rows[r - 1].item); setText(b, rows[r - 1].cost);
      }
      [19, 20, 21, 22].forEach(k => shiftY(el(k), dy));
      setText(el(20), d.total); setText(el(22), d.note);
      growGroup(byName(doc, 'P8-table'), dy);
      d.effects.forEach((e, i) => {
        const b = 4 + 4 * i;
        setText(byName(doc, `P8-effect-${b + 1}`), e.title);
        setText(byName(doc, `P8-effect-${b + 2}`), e.lines[0] || ''); setText(byName(doc, `P8-effect-${b + 3}`), e.lines[1] || '');
      });
    },
    kpi(doc, p) {
      fillLead(doc, p.d);
      for (let k = 1; k <= 4; k++) {
        const it = p.d.items[k - 1];
        if (!it) { remove(byName(doc, `P9-kpi${k}`)); continue; }
        setText(byName(doc, `P9-kpi${k}-2`), `KPI ${String(p.d.offset + k).padStart(2, '0')}`);
        setText(byName(doc, `P9-kpi${k}-4`), it.value); setText(byName(doc, `P9-kpi${k}-5`), it.name); setText(byName(doc, `P9-kpi${k}-6`), it.desc);
      }
      setText(byName(doc, 'P9-measure1-2'), p.d.measure.data); setText(byName(doc, 'P9-measure2-2'), p.d.measure.period); setText(byName(doc, 'P9-measure3-2'), p.d.measure.tool);
    },
  };

  const XMLDECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const ser = doc => { const s = new XMLSerializer().serializeToString(doc); return s.startsWith('<?xml') ? s : XMLDECL + s; };
  const parse = s => new DOMParser().parseFromString(s, 'application/xml');

  async function buildPptx(deck) {
    await loadLibs();
    const { pages, meta } = plan(deck);
    const zip = await window.JSZip.loadAsync(window.PROPOSAL_TEMPLATE_B64, { base64: true });
    const tpl = {}, rels = {};
    for (let i = 1; i <= 10; i++) {
      tpl[i] = await zip.file(`ppt/slides/slide${i}.xml`).async('string');
      rels[i] = (await zip.file(`ppt/slides/_rels/slide${i}.xml.rels`).async('string')).replace(/<Relationship [^>]*notesSlide[^>]*\/>/g, '');
    }
    Object.keys(zip.files).filter(f => /^ppt\/(slides|notesSlides)\//.test(f)).forEach(f => zip.remove(f));

    pages.forEach((p, k) => {
      const doc = parse(tpl[TPL[p.type]]);
      const ids = { max: Math.max(0, ...[...doc.getElementsByTagNameNS(NS.p, 'cNvPr')].map(n => +n.getAttribute('id') || 0)) };
      if (p.type !== 'cover' && p.type !== 'closing') fillHeader(doc, p);
      FILL[p.type](doc, p, meta, ids);
      zip.file(`ppt/slides/slide${k + 1}.xml`, ser(doc));
      zip.file(`ppt/slides/_rels/slide${k + 1}.xml.rels`, rels[TPL[p.type]]);
    });

    let pres = await zip.file('ppt/presentation.xml').async('string');
    pres = pres.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/, `<p:sldIdLst>${pages.map((_, k) => `<p:sldId id="${256 + k}" r:id="rIdS${k + 1}"/>`).join('')}</p:sldIdLst>`);
    zip.file('ppt/presentation.xml', pres);
    let prels = await zip.file('ppt/_rels/presentation.xml.rels').async('string');
    prels = prels.replace(/<Relationship [^>]*relationships\/slide"[^>]*\/>/g, '')
      .replace('</Relationships>', pages.map((_, k) => `<Relationship Id="rIdS${k + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${k + 1}.xml"/>`).join('') + '</Relationships>');
    zip.file('ppt/_rels/presentation.xml.rels', prels);
    let ct = await zip.file('[Content_Types].xml').async('string');
    ct = ct.replace(/<Override [^>]*PartName="\/ppt\/(slides\/slide|notesSlides\/notesSlide)\d+\.xml"[^>]*\/>/g, '')
      .replace('</Types>', pages.map((_, k) => `<Override PartName="/ppt/slides/slide${k + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('') + '</Types>');
    zip.file('[Content_Types].xml', ct);
    const app = zip.file('docProps/app.xml');
    if (app) zip.file('docProps/app.xml', (await app.async('string')).replace(/<Slides>\d+<\/Slides>/, `<Slides>${pages.length}</Slides>`).replace(/<Notes>\d+<\/Notes>/, '<Notes>0</Notes>'));
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  }

  async function download(deck) {
    const blob = await buildPptx(deck);
    const name = String(deck.meta?.fileName || 'proposal').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `${name}.pptx`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }

  /* 마무리 페이지 CONTACT — 모든 업무 공통, 이 브라우저에 저장 */
  const CKEY = 'spyder.ppt.contact';
  const getContact = () => { try { return localStorage.getItem(CKEY) || ''; } catch { return ''; } };
  const setContact = v => { try { localStorage.setItem(CKEY, v); } catch {} };
  const withContact = deck => ({ ...deck, meta: { ...(deck.meta || {}), contact: deck.meta?.contact || getContact() } });
  let lastDeck = null;
  document.addEventListener('change', e => {
    if (e.target.id !== 'pd-contact') return;
    setContact(e.target.value.trim());
    const host = document.querySelector('.pd-deck');
    if (host && lastDeck) host.outerHTML = preview(lastDeck);
  });
  function toolbar(deck) {
    return `<div class="pd-bar"><span class="pd-src ${deck.ai ? 'ai' : ''}">${deck.ai ? 'AI 원고 · 명세 글자 수에 맞춰 작성' : '자동 구성 · 기획안 내용을 칸 길이에 맞춰 요약 (AI 원고는 매시간 순차 작성)'}</span>
      <label>CONTACT <input id="pd-contact" placeholder="마무리 페이지 연락처 (이메일 등)" value="${esc(getContact())}"></label></div>`;
  }
  function preview(deck) {
    injectCss(); lastDeck = deck;
    const { pages, meta } = plan(withContact(deck));
    return `<div class="pd-deck">${pages.map(p => slideHtml(p, meta)).join('')}</div>`;
  }

  injectCss();
  window.ProposalDeck = {
    preview, toolbar,
    printHtml: deck => { injectCss(); const { pages, meta } = plan(withContact(deck)); return pages.map(p => slideHtml(p, meta)).join(''); },
    count: deck => plan(deck).pages.length,
    download: deck => download(withContact(deck)), auto, normalize,
  };
})();
