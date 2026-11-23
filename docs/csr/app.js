/* INCHEON UNITED CSR AI MANAGER */
(() => {
  'use strict';

  /* ───────── Data sources (자동 갱신되는 파일) ───────── */
  const ACTS = () => window.CSR_ACTIVITIES || { items: [], areas: [], sources: [], diagnosis: { strengths: [], gaps: [] } };
  const RES = () => window.CSR_RESEARCH || { items: [], updatedAt: '' };
  const PRO = () => window.CSR_PROPOSALS || { items: [], updatedAt: '' };

  /* ───────── Utils ───────── */
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TODAY = new Date(); TODAY.setHours(0, 0, 0, 0);
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const TODAY_ISO = iso(TODAY);
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const diff = s => Math.round((parse(s) - TODAY) / 86400000);
  const DOW = '일월화수목금토';
  const fmt = s => { if (!s) return '-'; const d = parse(s); return `${d.getMonth() + 1}.${d.getDate()} (${DOW[d.getDay()]})`; };
  const fmtFull = s => { if (!s) return '-'; const d = parse(s); return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`; };
  const fmtTime = isoStr => { if (!isoStr) return '-'; const d = new Date(isoStr); return `${d.getMonth() + 1}.${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const dday = s => { const n = diff(s); return n === 0 ? 'D-DAY' : n > 0 ? `D-${n}` : `D+${-n}`; };
  const num = n => Number(n || 0).toLocaleString('ko-KR');
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const sum = (arr, k) => arr.reduce((a, x) => a + (x[k] || 0), 0);

  const ICON = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
    research: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    proposal: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    operation: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="m5 12 5 5L20 7"/>',
    link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    won: '<path d="M4 6l3 12 3-9 2 0 3 9 3-12"/><path d="M3 11h18"/>',
  };
  const icon = (n, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24">${ICON[n]}</svg>`;

  /* ───────── Store (사용자 입력분만 localStorage에 저장) ───────── */
  const KEY = 'spyder.csr.v1';
  const DEFAULT = { research: [], proposals: {}, newProposals: [], exec: {}, settings: { manager: '담당자' } };
  let store;
  try { store = Object.assign(structuredClone(DEFAULT), JSON.parse(localStorage.getItem(KEY) || '{}')); }
  catch (e) { store = structuredClone(DEFAULT); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* 저장 불가 환경 */ } };

  /* ───────── Domain ───────── */
  const CATS = ['해외 스포츠 구단', '국내 스포츠 구단', '리그·협회', '기업·비스포츠', '공공·지역 협력', '친환경·ESG'];
  const REV = ['티켓·관중', 'MD·상품', '스폰서·파트너십', '멤버십·팬덤', '브랜드 가치'];
  const STAGES = ['직접 매출', '관람 유입', '브랜드·관계'];
  const stageTone = { '직접 매출': 'b-dark', '관람 유입': '', '브랜드·관계': 'b-line' };
  const P_STATUS = ['신규 제안', '검토', '채택', '진행 중', '완료', '보류'];
  const EXEC = ['채택', '진행 중', '완료'];
  const pStatusTone = { '신규 제안': 'b-dark', '검토': 'b-warn', '채택': 'b-ok', '진행 중': 'b-ok', '완료': 'b-line', '보류': 'b-line' };

  const acts = () => ACTS().items;
  const actMap = () => Object.fromEntries(acts().map(a => [a.id, a]));
  const research = () => [...store.research, ...RES().items].sort((a, b) => b.date.localeCompare(a.date));
  const proposals = () => [...store.newProposals, ...(PRO().items || [])]
    .map(p => ({ ...p, ...(store.proposals[p.id] || {}) }))
    .sort((a, b) => (b.created || b.updated).localeCompare(a.created || a.updated));
  const patchProposal = (id, obj) => { store.proposals[id] = { ...(store.proposals[id] || {}), ...obj, updated: TODAY_ISO }; save(); };
  const exec = id => (store.exec[id] = store.exec[id] || { owner: '', due: '', checks: {}, memos: [] });
  const progress = p => { const n = (p.actions || []).length; const e = store.exec[p.id]; const d = e ? Object.values(e.checks).filter(Boolean).length : 0; return { n, d, pct: p.status === '완료' ? 100 : pct(d, n) }; };

  /* ───────── AI 기획안 작성 요청 (tools/local-server.js → 담당 기기의 csr-develop-agent.js) ───────── */
  const AI_API = 'http://127.0.0.1:47821';
  const AI_TIMEOUT_MS = 40 * 60 * 1000;
  const pendingDrafts = () => store.newProposals.filter(p => p.aiReq && p.aiState === 'pending');
  const researchPayload = r => ({ id: r.id, org: r.org, region: r.region, category: r.category, title: r.title, source: r.source, url: r.url,
    summary: r.summary, result: r.result, insight: r.insight, apply: r.apply, revenueLink: r.revenueLink });

  async function requestAI(id) {
    const d = store.newProposals.find(x => x.id === id);
    if (!d) return;
    const rmap = Object.fromEntries(research().map(r => [r.id, r]));
    const p = { ...d, ...(store.proposals[id] || {}) };
    const reqId = uid('rq');
    const body = {
      reqId, replaces: id,
      research: (p.research || []).map(x => rmap[x]).filter(Boolean).map(researchPayload),
      draft: { title: p.title, background: p.background, goal: p.goal, target: p.target, strategy: p.strategy, revenueModel: p.revenueModel, actions: p.actions || [] },
    };
    try {
      // text/plain 으로 보내 사전 요청(preflight) 없이 전달
      const res = await fetch(`${AI_API}/csr/develop`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || '요청 거부');
      Object.assign(d, { aiReq: reqId, aiState: 'pending', aiAt: new Date().toISOString(), aiError: '' });
      save(); render();
      toast('AI가 기획안을 작성하고 있습니다. 보통 2~5분 뒤 자동으로 채워집니다.');
    } catch (e) {
      Object.assign(d, { aiState: 'failed', aiError: e.message && !/fetch/i.test(e.message) ? e.message : '이 PC의 자동화 프로그램에 연결할 수 없습니다. "자동화 등록 (이 PC).cmd" 실행 여부를 확인하세요.' });
      save(); render();
      toast('AI 작성 요청에 실패했습니다. 초안은 직접 편집할 수 있습니다.');
    }
  }

  /* AI 결과가 proposals.js 에 들어오면 초안을 AI 기획안으로 교체 */
  function reconcileAI() {
    const byReq = Object.fromEntries((PRO().items || []).filter(x => x.fromRequest).map(x => [x.fromRequest, x]));
    const done = [];
    let changed = false;
    store.newProposals = store.newProposals.filter(d => {
      const hit = d.aiReq && byReq[d.aiReq];
      if (hit) {
        const keep = store.proposals[d.id] && store.proposals[d.id].status;   // 사용자가 바꾼 상태는 유지
        if (keep && keep !== '검토') store.proposals[hit.id] = { ...(store.proposals[hit.id] || {}), status: keep };
        delete store.proposals[d.id];
        if (ui.pSel === d.id) ui.pSel = hit.id;
        done.push(hit.title); changed = true;
        return false;
      }
      if (d.aiState === 'pending' && Date.now() - Date.parse(d.aiAt) > AI_TIMEOUT_MS) {
        Object.assign(d, { aiState: 'failed', aiError: '응답 시간이 초과되었습니다. 다시 시도해 주세요.' }); changed = true;
      }
      return true;
    });
    if (changed) save();
    return done;
  }

  async function pollAI() {
    const list = pendingDrafts();
    if (!list.length) return;
    let st;
    try { st = await (await fetch(`${AI_API}/csr/develop/status?ids=${list.map(d => d.aiReq).join(',')}`)).json(); } catch { return; }
    let changed = false, finished = false;
    for (const d of list) {
      const s = st[d.aiReq] || '';
      if (s === 'done') finished = true;
      else if (s.startsWith('failed')) { Object.assign(d, { aiState: 'failed', aiError: s.slice(7) || 'AI 작성 실패' }); changed = true; }
      else if ((s === 'queued' || s === 'working') && d.aiStep !== s) { d.aiStep = s; changed = true; }
    }
    if (changed) { save(); if (!busy()) render(); }
    if (finished) refreshData();
  }

  /* ───────── UI state ───────── */
  const ui = { aArea: '전체', aStage: '전체', rCat: '전체', rRegion: '전체', rQuery: '', pSel: null, pFilter: '전체', pLimit: 50 };
  const prioBadge = p => `<span class="badge ${p === '높음' ? 'b-dark' : p === '중간' ? '' : 'b-line'}">우선순위 ${esc(p)}</span>`;
  const revChips = list => (list || []).map(r => `<span class="rev">${icon('won', 'icon-sm')}${esc(r)}</span>`).join('');
  const kpi = (l, v, unit, s, p = null) => `
    <div class="kpi glass"><div class="l">${l}</div><div class="v">${v}<small>${unit}</small></div><div class="s">${s}</div>
    ${p !== null ? `<div class="bar"><i style="width:${p}%"></i></div>` : ''}</div>`;

  /* ───────── Views ───────── */
  function vDashboard() {
    const A = acts(), R = research(), P = proposals();
    const people = sum(A, 'people'), audience = sum(A, 'audience');
    const adopted = P.filter(p => EXEC.includes(p.status));
    const todayP = P.filter(p => (p.created || '').slice(0, 10) === TODAY_ISO).length;
    const areas = ACTS().areas.map(a => ({ a, n: A.filter(x => x.area === a).length, p: sum(A.filter(x => x.area === a), 'people') })).sort((x, y) => y.n - x.n);
    const maxN = Math.max(1, ...areas.map(x => x.n));
    const stages = STAGES.map(s => ({ s, n: A.filter(x => x.revenue === s).length }));
    const dg = ACTS().diagnosis;
    const fresh = P.filter(p => p.status !== '보류').slice(0, 5);

    return `
      <div class="hero-g glass">
        <div>
          <div class="eyebrow">Today · ${fmtFull(TODAY_ISO)}</div>
          <h2>CSR을 매출로 연결하는 사례 ${R.length}건 · AI 기획안 ${P.length}건</h2>
          <p class="muted">타 기관 CSR 사례를 매시간 조사해 인천유나이티드 적용 방안과 관중·티켓·MD·스폰서 매출 연결 구조를 제안합니다. 오늘 새 제안 ${todayP}건</p>
        </div>
        <a class="btn" href="#/proposal">${icon('proposal', 'icon-sm')} 오늘의 제안 보기</a>
      </div>

      <div class="grid g4">
        ${kpi('2026 CSR·마케팅 활동', A.length, '건', `${ACTS().areas.length}개 영역 · 대표활동 ${A.filter(a => a.flagship).length}건`)}
        ${kpi('직접 참여·수혜 인원', num(people), '명', `캠페인 도달 관중 ${num(audience)}명`)}
        ${kpi('누적 타 기관 사례', R.length, '건', `해외 ${R.filter(r => r.region === '해외').length} · 국내 ${R.filter(r => r.region !== '해외').length} · 마지막 ${fmtTime(RES().updatedAt)}`)}
        ${kpi('실행 중인 기획', adopted.length, '건', `완료 ${P.filter(p => p.status === '완료').length}건 · 전체 제안 ${P.length}건`, pct(P.filter(p => p.status === '완료').length, adopted.length))}
      </div>

      <div class="grid g21">
        <div class="panel">
          <div class="panel-h"><h3>${icon('heart', 'icon-sm')} 2026 활동 영역 분포</h3><a class="link-more" href="#/incheon">전체 활동 →</a></div>
          <div class="rows">${areas.map(x => `
            <div class="row" style="padding:7px 0">
              <div class="grow"><div style="display:flex;justify-content:space-between;font-size:13px"><b>${esc(x.a)}</b><span>${x.n}건${x.p ? ` <span class="muted">· ${num(x.p)}명</span>` : ''}</span></div>
              <div class="bar" style="margin-top:5px"><i style="width:${Math.max(6, pct(x.n, maxN))}%"></i></div></div>
            </div>`).join('')}
          </div>
        </div>
        <div class="panel">
          <div class="panel-h"><h3>${icon('won', 'icon-sm')} 매출 연결 단계</h3></div>
          <div class="stage">${stages.map(x => `<div class="${x.s === '직접 매출' ? 'on' : ''}"><b>${x.n}</b><span>${x.s}</span></div>`).join('')}</div>
          <p class="muted" style="font-size:12.5px;margin-top:10px">각 활동이 티켓·MD 판매(직접 매출), 신규 관람객 유입, 브랜드·관계 형성 중 어디까지 연결되는지 AI가 분류한 결과입니다.</p>
          <div class="sec" style="margin-top:14px"><b>매출 연결 공백</b><ul class="steps">${dg.gaps.slice(0, 3).map(g => `<li>${esc(g)}</li>`).join('')}</ul></div>
        </div>
      </div>

      <div class="grid g2">
        <div class="panel">
          <div class="panel-h"><h3>최근 타 기관 사례</h3><a class="link-more" href="#/research">→</a></div>
          <div class="rows">${R.slice(0, 5).map(r => `
            <div class="row"><span class="badge ${r.region === '해외' ? 'b-dark' : 'b-line'}" style="min-width:42px;justify-content:center">${esc(r.region || '국내')}</span><div class="grow"><a class="t" style="display:block" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a><div class="d">${esc(r.org || r.category)} · ${esc(r.source)}</div></div></div>`).join('') || '<div class="empty">첫 리서치가 진행 중입니다. 매시간 자동으로 채워집니다.</div>'}
          </div>
        </div>
        <div class="panel">
          <div class="panel-h"><h3>최신 AI 기획안</h3><a class="link-more" href="#/proposal">→</a></div>
          <div class="rows">${fresh.map(p => `
            <div class="row"><div class="grow"><a class="t" style="display:block;cursor:pointer" data-act="goProposal" data-id="${p.id}">${esc(p.title)}</a><div class="d">${esc(p.area || '')}${p.area ? ' · ' : ''}${(p.revenue || []).map(esc).join(', ')} · ${p.created ? fmtTime(p.created) : fmtFull(p.updated)}</div></div><span class="badge ${pStatusTone[p.status] || ''}">${esc(p.status)}</span></div>`).join('') || '<div class="empty">첫 기획안을 생성하는 중입니다.</div>'}
          </div>
        </div>
      </div>`;
  }

  function vIncheon() {
    const A = acts(), dg = ACTS().diagnosis;
    const list = A.filter(a => (ui.aArea === '전체' || a.area === ui.aArea) && (ui.aStage === '전체' || a.revenue === ui.aStage));
    return `
      <div class="hero-g glass">
        <div>
          <div class="eyebrow">Incheon United · 2026 CSR & Marketing</div>
          <h2>2026 시즌 활동 ${A.length}건 · 참여 ${num(sum(A, 'people'))}명 · 캠페인 도달 ${num(sum(A, 'audience'))}명</h2>
          <p class="muted">출처: ${ACTS().sources.map(esc).join(' / ')}</p>
        </div>
      </div>

      <div class="grid g2">
        <div class="panel"><div class="panel-h"><h3>강점</h3></div><ul class="steps">${dg.strengths.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
        <div class="panel"><div class="panel-h"><h3>매출 연결 공백 <span class="badge b-line" style="margin-left:6px">AI 분석</span></h3></div><ul class="steps">${dg.gaps.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
      </div>

      <div class="panel">
        <div class="panel-h" style="flex-wrap:wrap;gap:10px">
          <div class="toolbar">${['전체', ...ACTS().areas].map(a => `<button class="chip ${ui.aArea === a ? 'on' : ''}" data-act="aArea" data-v="${esc(a)}">${esc(a)} ${a === '전체' ? A.length : A.filter(x => x.area === a).length}</button>`).join('')}</div>
          <div class="toolbar">${['전체', ...STAGES].map(s => `<button class="chip ${ui.aStage === s ? 'on' : ''}" data-act="aStage" data-v="${esc(s)}">${s === '전체' ? '매출 단계 전체' : esc(s)}</button>`).join('')}</div>
        </div>
        <div class="tbl-wrap"><table class="tbl wrap">
          <thead><tr><th>활동</th><th>영역</th><th>기간</th><th>대상</th><th>성과</th><th>매출 연결</th><th></th></tr></thead>
          <tbody>${list.map(a => `<tr class="click" data-act="activity" data-id="${a.id}">
            <td><b>${esc(a.name)}</b>${a.flagship ? ' <span class="badge b-dark" style="margin-left:4px">대표</span>' : ''}</td>
            <td>${esc(a.area)}</td><td class="muted" style="white-space:nowrap">${esc(a.period)}</td>
            <td style="max-width:200px">${esc(a.target)}</td>
            <td style="max-width:300px">${esc(a.result)}</td>
            <td><span class="badge ${stageTone[a.revenue]}">${esc(a.revenue)}</span></td>
            <td>${a.link ? `<a class="src" href="${esc(a.link)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${icon('link', 'icon-sm')}</a>` : ''}</td>
          </tr>`).join('') || '<tr><td colspan="7" class="empty">해당 조건의 활동이 없습니다.</td></tr>'}</tbody>
        </table></div>
      </div>`;
  }

  function vResearch() {
    const all = research();
    const q = ui.rQuery.trim().toLowerCase();
    const list = all.filter(r => (ui.rCat === '전체' || r.category === ui.rCat) && (ui.rRegion === '전체' || (r.region || '국내') === ui.rRegion) &&
      (!q || [r.org, r.title, r.summary, r.insight, r.apply, r.revenueLink, r.source].join(' ').toLowerCase().includes(q)));
    return `
      <div class="hero-g glass">
        <div>
          <div class="eyebrow">CSR Research · 매시간 자동 조사</div>
          <h2>누적 타 기관 CSR 사례 ${all.length}건</h2>
          <p class="muted">종목·국내외·분야 제한 없이 실제 사례를 원문 링크와 함께 축적하고, 인천유나이티드 적용 방안과 매출 연결 포인트를 붙입니다. 마지막 업데이트 ${fmtTime(RES().updatedAt)}</p>
        </div>
        <button class="btn" data-act="addResearch">${icon('plus', 'icon-sm')} 사례 직접 추가</button>
      </div>

      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr))">
        ${['전체', ...CATS].map(c => `
          <button class="cat-count glass ${ui.rCat === c ? 'on' : ''}" data-act="rCat" data-v="${esc(c)}">
            <div class="v">${c === '전체' ? all.length : all.filter(r => r.category === c).length}</div><div class="l">${esc(c)}</div>
          </button>`).join('')}
      </div>

      <div class="toolbar">
        <div class="search">${icon('research', 'icon-sm')}<input id="rq" placeholder="기관·사례·적용 방안 검색" value="${esc(ui.rQuery)}"></div>
        ${['전체', '국내', '해외'].map(x => `<button class="chip ${ui.rRegion === x ? 'on' : ''}" data-act="rRegion" data-v="${x}">${x}</button>`).join('')}
        <span class="sp"></span>
        <span class="muted" style="font-size:13px">${list.length}건 표시</span>
      </div>

      <div class="grid g2">
        ${list.length ? list.map(rCard).join('') : `<div class="panel empty" style="grid-column:1/-1">${all.length ? '조건에 맞는 사례가 없습니다.' : '첫 리서치가 진행 중입니다. 매시간 자동으로 새 사례가 추가됩니다.'}</div>`}
      </div>`;
  }
  const rCard = r => `
    <article class="rcard">
      <div class="meta"><span class="badge">${esc(r.category)}</span><span class="badge b-line">${esc(r.region || '국내')}</span>${prioBadge(r.priority)}<span style="margin-left:auto">수집 ${fmtFull(r.date)}${r.published ? ` · 발행 ${fmtFull(r.published)}` : ''}</span></div>
      <h4>${esc(r.title)}</h4>
      ${r.org ? `<div class="muted" style="font-size:12.5px;margin:-4px 0 6px">${esc(r.org)}</div>` : ''}
      <p>${esc(r.summary)}</p>
      ${r.result ? `<p style="font-size:13px"><b>성과</b> ${esc(r.result)}</p>` : ''}
      <div class="callout"><b>INSIGHT</b>${esc(r.insight)}</div>
      <div class="callout soft"><b>인천유나이티드 적용 방안</b>${esc(r.apply)}</div>
      ${r.revenueLink || (r.revenue || []).length ? `<div class="callout soft"><b>매출 연결</b>${esc(r.revenueLink)}<div style="margin-top:6px">${revChips(r.revenue)}</div></div>` : ''}
      <div class="foot">
        ${r.url ? `<a class="src" href="${esc(r.url)}" target="_blank" rel="noopener">${icon('link', 'icon-sm')} ${esc(r.source || '원문 보기')} · 원문 보기</a>` : `<span class="src">${esc(r.source || '출처 없음')}</span>`}
        <button class="btn btn-ghost btn-sm" data-act="toProposal" data-id="${esc(r.id)}">기획안으로 발전 →</button>
      </div>
    </article>`;

  function vProposal() {
    const all = proposals();
    const F = {
      '전체': () => true,
      '오늘 제안': x => (x.created || '').slice(0, 10) === TODAY_ISO,
      ...Object.fromEntries(P_STATUS.map(s => [s, x => x.status === s])),
    };
    const list = all.filter(F[ui.pFilter] || F['전체']);
    if (!ui.pSel || !list.some(p => p.id === ui.pSel)) ui.pSel = list[0]?.id;
    const p = all.find(x => x.id === ui.pSel);
    return `
      <div class="hero-g glass">
        <div>
          <div class="eyebrow">AI Proposal · 매시간 CSR 기획안 3건+ 자동 제안</div>
          <h2>오늘 새 기획안 ${all.filter(F['오늘 제안']).length}건 · 누적 ${all.length}건</h2>
          <p class="muted">타 기관 사례 + 인천유나이티드 2026 활동을 바탕으로 "CSR → 매출" 구조를 설계합니다. 마지막 생성 ${fmtTime(PRO().updatedAt)}</p>
        </div>
        <button class="btn" data-act="newProposal">${icon('plus', 'icon-sm')} 새 기획안</button>
      </div>
      <div class="toolbar">
        ${Object.keys(F).map(f => `<button class="chip ${ui.pFilter === f ? 'on' : ''}" data-act="pFilter" data-v="${f}">${f} ${all.filter(F[f]).length}</button>`).join('')}
      </div>
      <div class="p-wrap">
        <div class="panel" style="padding:10px">
          ${list.length ? list.slice(0, ui.pLimit).map(x => `
            <button class="p-item ${x.id === ui.pSel ? 'on' : ''}" data-act="pSel" data-id="${x.id}">
              <div style="display:flex;gap:6px;flex-wrap:wrap"><span class="badge ${pStatusTone[x.status] || ''}">${esc(x.status)}</span>${prioBadge(x.priority)}${x.area ? `<span class="badge b-line">${esc(x.area)}</span>` : ''}</div>
              <div class="t">${esc(x.title)}</div>
              <div class="muted" style="font-size:12px">${originLabel(x)} · ${x.created ? fmtTime(x.created) : fmtFull(x.updated)}</div>
            </button>`).join('') + (list.length > ui.pLimit ? `<button class="btn btn-ghost" style="width:100%;margin-top:6px" data-act="pMore">더 보기 (${list.length - ui.pLimit}건)</button>` : '') : '<div class="empty">해당 조건의 기획안이 없습니다.</div>'}
        </div>
        ${p ? pDetail(p) : '<div class="panel empty">기획안을 선택하세요.</div>'}
      </div>`;
  }

  const statusSelect = p => `<select class="input" style="width:auto;height:32px" data-act="pStatus" data-id="${p.id}">
    ${[...new Set([...P_STATUS, p.status])].map(s => `<option ${s === p.status ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>`;
  const researchLinks = p => {
    const rmap = Object.fromEntries(research().map(r => [r.id, r]));
    return (p.research || []).filter(id => rmap[id]).map(id => `<a class="callout soft" style="display:block;margin-bottom:8px" href="${esc(rmap[id].url)}" target="_blank" rel="noopener"><b>${esc(rmap[id].org || rmap[id].category)} · ${esc(rmap[id].source)}</b>${esc(rmap[id].title)}</a>`).join('') || '<span class="muted">연결된 사례 없음</span>';
  };
  const linkedActs = p => { const m = actMap(); return (p.linked || []).filter(id => m[id]).map(id => `<span class="chip" data-act="activity" data-id="${id}">${esc(m[id].name)}</span>`).join(' '); };

  const originLabel = x => x.ai ? (x.origin === 'develop' ? 'AI 기획 · 사례 발전' : 'AI 제안')
    : x.aiState === 'pending' ? 'AI 작성 중…' : x.aiState === 'failed' ? 'AI 작성 실패' : '직접 작성';
  const aiBanner = p => {
    if (p.ai) return '';
    if (p.aiState === 'pending') return `
      <div class="ai-state"><span class="spin"></span><div class="grow"><b>AI가 기획안을 작성하고 있습니다 · ${p.aiStep === 'working' ? '작성 중' : '대기 중'}</b>
        <span class="muted">근거 사례 원문과 인천유나이티드 2026 활동을 분석해 전략·매출 연결 구조·실행 방안·예산·KPI를 채웁니다. 보통 2~5분, 완료되면 이 초안이 AI 기획안으로 자동 교체됩니다.</span></div></div>`;
    if (p.aiState === 'failed') return `
      <div class="ai-state fail"><div class="grow"><b>AI 작성에 실패했습니다</b><span class="muted">${esc(p.aiError || '')}</span></div>
        <button class="btn btn-sm" data-act="aiWrite" data-id="${p.id}">${icon('spark', 'icon-sm')} 다시 시도</button></div>`;
    return '';
  };

  function pDetail(p) {
    const la = linkedActs(p);
    const canAI = !p.ai && store.newProposals.some(x => x.id === p.id) && p.aiState !== 'pending';
    return `
        <div class="panel p-detail">
          ${aiBanner(p)}
          <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start">
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">${statusSelect(p)}${prioBadge(p.priority)}${p.area ? `<span class="badge b-line">${esc(p.area)}</span>` : ''}</div>
            <div class="toolbar">
              ${canAI && p.aiState !== 'failed' ? `<button class="btn btn-sm" data-act="aiWrite" data-id="${p.id}">${icon('spark', 'icon-sm')} AI로 작성</button>` : ''}
              <button class="btn btn-ghost btn-sm" data-act="editProposal" data-id="${p.id}">${icon('edit', 'icon-sm')} 편집</button>
              <button class="btn btn-sm" data-act="ppt" data-id="${p.id}">${icon('proposal', 'icon-sm')} PPT 기획안 미리보기</button>
            </div>
          </div>
          <h2>${esc(p.title)}</h2>
          <div style="margin:2px 0 8px">${revChips(p.revenue)}</div>
          <p class="muted">${esc(p.background)}</p>
          <div class="sec"><div class="kv">
            <div><small>목표</small>${esc(p.goal) || '-'}</div>
            <div><small>타깃</small>${esc(p.target) || '-'}</div>
            <div><small>실행 시점</small>${esc(p.timeline) || '-'}</div>
          </div></div>
          <div class="sec"><b>핵심 전략</b>${esc(p.strategy) || '<span class="muted">작성 전</span>'}</div>
          <div class="callout" style="margin-top:14px"><b>매출 연결 구조</b>${esc(p.revenueModel) || '작성 전'}</div>
          <div class="sec"><b>세부 실행 방안</b>${(p.actions || []).length ? `<ol class="steps">${p.actions.map(a => `<li>${esc(a)}</li>`).join('')}</ol>` : '<span class="muted">작성 전</span>'}</div>
          ${(p.partners || []).length ? `<div class="sec"><b>협력 기관·파트너 후보</b><div class="toolbar">${p.partners.map(x => `<span class="badge b-line">${esc(x)}</span>`).join('')}</div></div>` : ''}
          <div class="sec"><div class="kv">
            <div><small>예상 비용</small>${(p.budget || []).map(b => `${esc(b.item)} ${esc(b.cost)}`).join('<br>') || '-'}</div>
            <div style="grid-column:span 2"><small>기대 효과</small>${esc(p.effect) || '-'}</div>
          </div></div>
          <div class="sec"><b>성과 측정 지표 (KPI)</b>
            ${(p.kpis || []).length ? `<div class="rows">${p.kpis.map(k => `<div class="row"><div class="grow">${esc(k.name)}</div><b>${esc(k.target)}</b></div>`).join('')}</div>` : '<span class="muted">작성 전</span>'}
          </div>
          ${la ? `<div class="sec"><b>연계할 인천유나이티드 2026 활동</b><div class="toolbar">${la}</div></div>` : ''}
          <div class="sec"><b>근거 사례</b>${researchLinks(p)}</div>
        </div>`;
  }

  function vOperation() {
    const P = proposals();
    const cols = EXEC.map(st => ({ st, list: P.filter(p => p.status === st) }));
    const review = P.filter(p => p.status === '검토' || p.status === '신규 제안').sort((a, b) => (a.status === '검토' ? -1 : 0) - (b.status === '검토' ? -1 : 0));
    return `
      <div class="hero-g glass">
        <div>
          <div class="eyebrow">Execution · 채택된 기획 실행 관리</div>
          <h2>채택 ${cols[0].list.length} · 진행 중 ${cols[1].list.length} · 완료 ${cols[2].list.length}</h2>
          <p class="muted">Proposal에서 상태를 '채택'으로 바꾸면 이곳에 카드가 생깁니다. 담당자·마감일·실행 체크리스트·메모로 진행 상황을 관리하세요.</p>
        </div>
        <a class="btn btn-ghost" href="#/proposal">기획안 검토하러 가기 →</a>
      </div>
      <div class="board">
        ${cols.map(c => `
          <div class="col">
            <div class="col-h"><b>${c.st}</b><span>${c.list.length}</span></div>
            ${c.list.map(p => { const g = progress(p), e = store.exec[p.id] || {}; return `
              <button class="kcard" data-act="execOpen" data-id="${p.id}">
                <div class="t">${esc(p.title)}</div>
                <div class="d">${esc(e.owner || '담당 미정')}${e.due ? ` · 마감 ${fmt(e.due)} <span class="${diff(e.due) < 0 && p.status !== '완료' ? 'late' : ''}">${dday(e.due)}</span>` : ''}</div>
                <div class="bar" style="margin-top:8px"><i style="width:${g.pct}%"></i></div>
                <div class="d" style="margin-top:4px">실행 ${g.d}/${g.n}</div>
              </button>`; }).join('') || '<div class="empty" style="padding:22px 8px">없음</div>'}
          </div>`).join('')}
      </div>
      <div class="panel">
        <div class="panel-h"><h3>채택 대기 기획안</h3><span class="muted" style="font-size:12.5px">${review.length}건 · 최근 10건 표시</span></div>
        <div class="rows">${review.slice(0, 10).map(p => `
          <div class="row"><span class="badge ${pStatusTone[p.status] || ''}">${esc(p.status)}</span><div class="grow"><a class="t" style="display:block;cursor:pointer" data-act="goProposal" data-id="${p.id}">${esc(p.title)}</a><div class="d">${esc(p.area || '')} · ${(p.revenue || []).map(esc).join(', ')}</div></div>
          <button class="btn btn-ghost btn-sm" data-act="adopt" data-id="${p.id}">${icon('check', 'icon-sm')} 채택</button></div>`).join('') || '<div class="empty">채택을 기다리는 기획안이 없습니다.</div>'}
        </div>
      </div>`;
  }

  /* ───────── Router ───────── */
  const ROUTES = {
    dashboard: { label: 'Dashboard', sub: 'INCHEON UNITED CSR · 오늘의 현황', icon: 'home', view: vDashboard },
    incheon:   { idx: '01', label: 'Incheon 2026', title: 'Incheon United 2026', sub: '2026 CSR·마케팅 활동 현황 및 매출 연결 진단', icon: 'heart', view: vIncheon },
    research:  { idx: '02', label: 'Research', title: 'CSR Research', sub: '타 기관 CSR 사례 조사 · 매시간 업데이트', icon: 'research', view: vResearch },
    proposal:  { idx: '03', label: 'Proposal', title: 'Proposal', sub: 'CSR → 매출 증대 기획안 · 매시간 자동 생성', icon: 'proposal', view: vProposal },
    operation: { idx: '04', label: 'Execution', title: 'Execution Manager', sub: '채택 기획 실행 · 담당 · 체크리스트', icon: 'operation', view: vOperation },
  };
  const route = () => { const r = location.hash.replace(/^#\/?/, '').split('?')[0]; return ROUTES[r] ? r : 'dashboard'; };

  function render() {
    const doneAI = reconcileAI();
    if (doneAI.length) setTimeout(() => toast(`AI 기획안 작성 완료: ${doneAI[0]}${doneAI.length > 1 ? ` 외 ${doneAI.length - 1}건` : ''}`), 0);
    const r = route(), R = ROUTES[r];
    const nNew = proposals().filter(p => (p.created || '').slice(0, 10) === TODAY_ISO && p.status === '신규 제안').length;
    $('#nav').innerHTML = Object.entries(ROUTES).map(([k, v], i) => `
      ${i === 1 ? '<div class="nav-sec">MODULES</div>' : ''}
      <a class="nav-link ${k === r ? 'on' : ''}" href="#/${k}">
        ${v.idx ? `<span class="idx">${v.idx}</span>` : ''}${icon(v.icon)}${v.label}
        ${k === 'proposal' && nNew ? `<span class="num">${nNew}</span>` : ''}
      </a>`).join('');
    $('#crumb').textContent = R.sub;
    $('#title').textContent = R.title || 'Dashboard';
    $('#view').innerHTML = R.view();
    document.title = `${R.title || 'Dashboard'} · CSR`;
  }

  /* ───────── 자동 갱신: 데이터 파일을 30초마다 다시 읽음 ───────── */
  let pendingRender = false;
  const busy = () => $('#modal-root').innerHTML !== '' || ['TEXTAREA', 'INPUT', 'SELECT'].includes(document.activeElement?.tagName);
  function refreshData() {
    const files = [
      ['activities.js', () => ACTS().version, '인천유나이티드 활동 자료가 업데이트되었습니다.'],
      ['research.js', () => RES().updatedAt, '새 CSR 사례가 추가되었습니다.'],
      ['proposals.js', () => PRO().updatedAt, '새 CSR 기획안이 추가되었습니다.'],
      ['../assets/app-version.js', () => window.APP_VERSION, 'reload'],
    ];
    for (const [file, ver, msg] of files) {
      const before = ver();
      const s = document.createElement('script');
      s.src = `${file}?t=${Date.now()}`;
      s.onload = () => {
        s.remove();
        if (ver() === before) return;
        if (msg === 'reload') { if (!busy()) location.reload(); else window.APP_VERSION = before; return; }   // 화면 코드 업데이트 → 자동 새로고침
        if (busy()) pendingRender = true; else { render(); toast(msg); }
      };
      s.onerror = () => s.remove();
      document.head.appendChild(s);
    }
  }
  setInterval(refreshData, 30000);
  setInterval(pollAI, 15000);

  /* ───────── Modal / Toast ───────── */
  function modal(html, wide = false) {
    $('#modal-root').innerHTML = `<div class="modal-ov" data-act="ovClose"><div class="modal ${wide ? 'wide' : ''}">${html}</div></div>`;
  }
  const closeModal = () => { $('#modal-root').innerHTML = ''; if (pendingRender) { pendingRender = false; render(); } };
  const mHead = (eyebrow, title) => `<div class="modal-h"><div><div class="eyebrow">${eyebrow}</div><h3>${title}</h3></div><button class="x" data-act="close">${icon('close')}</button></div>`;
  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400); }
  const val = id => ($('#' + id)?.value ?? '').trim();
  const lines = s => s.split('\n').map(x => x.trim()).filter(Boolean);

  /* 인천 활동 상세 */
  function openActivity(id) {
    const a = actMap()[id];
    if (!a) return;
    const related = proposals().filter(p => (p.linked || []).includes(id));
    modal(`
      ${mHead(`${esc(a.area)} · ${esc(a.period)}`, esc(a.name))}
      <div class="kv">
        <div><small>대상</small>${esc(a.target)}</div>
        <div><small>매출 연결 단계</small><span class="badge ${stageTone[a.revenue]}">${esc(a.revenue)}</span></div>
        <div><small>참고 링크</small>${a.link ? `<a class="src" href="${esc(a.link)}" target="_blank" rel="noopener">${icon('link', 'icon-sm')} 원문 보기</a>` : '-'}</div>
      </div>
      <div class="sec"><b>내용</b>${esc(a.content)}</div>
      <div class="sec"><b>성과</b>${esc(a.result)}</div>
      <div class="sec"><b>이 활동을 발전시키는 AI 기획안 (${related.length})</b>
        <div class="rows">${related.slice(0, 8).map(p => `<div class="row"><div class="grow"><a class="t" style="cursor:pointer" data-act="goProposal" data-id="${p.id}">${esc(p.title)}</a></div><span class="badge ${pStatusTone[p.status] || ''}">${esc(p.status)}</span></div>`).join('') || '<div class="empty">아직 연결된 기획안이 없습니다.</div>'}</div>
      </div>
      <div class="modal-f"><button class="btn" data-act="close">닫기</button></div>`, true);
  }

  /* 실행 관리 카드 */
  function openExec(id) {
    const p = proposals().find(x => x.id === id);
    if (!p) return;
    const e = exec(id);
    modal(`
      ${mHead(`${esc(p.status)} · ${esc(p.area || 'CSR')}`, esc(p.title))}
      <div class="form">
        <div class="field"><label>담당자</label><input class="input" id="e_owner" value="${esc(e.owner)}" placeholder="이름"></div>
        <div class="field"><label>마감일</label><input class="input" type="date" id="e_due" value="${esc(e.due)}"></div>
        <div class="field"><label>상태</label><select class="input" id="e_status">${EXEC.concat('보류').map(s => `<option ${s === p.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div class="field"></div>
      </div>
      <div class="sec"><b>실행 체크리스트</b>
        <div class="checks">${(p.actions || []).map((a, i) => `<label><input type="checkbox" data-i="${i}" ${e.checks[i] ? 'checked' : ''}><span>${esc(a)}</span></label>`).join('') || '<span class="muted">실행 방안이 없습니다. 기획안을 편집해 추가하세요.</span>'}</div>
      </div>
      <div class="callout soft" style="margin-top:12px"><b>매출 연결 구조</b>${esc(p.revenueModel) || '-'}</div>
      <div class="sec"><b>진행 메모</b>
        <ul class="log">${[...e.memos].reverse().map(l => `<li><time>${fmt(l.date)}</time><span>${esc(l.text)}</span></li>`).join('') || '<li class="muted">메모가 없습니다.</li>'}</ul>
        <div class="toolbar" style="margin-top:10px"><input class="input" id="e_memo" placeholder="미팅·협의·진행 메모" style="flex:1"><button class="btn btn-ghost" data-act="execMemo" data-id="${id}">기록</button></div>
      </div>
      <div class="modal-f"><button class="btn btn-ghost" data-act="goProposal" data-id="${id}">기획안 보기</button><button class="btn" data-act="execSave" data-id="${id}">저장</button></div>`, true);
  }
  function saveExecFields(id) {
    const e = exec(id);
    e.owner = val('e_owner'); e.due = val('e_due');
    document.querySelectorAll('.checks input[type=checkbox]').forEach(c => { e.checks[c.dataset.i] = c.checked; });
    const st = val('e_status');
    const p = proposals().find(x => x.id === id);
    if (st && p && st !== p.status) patchProposal(id, { status: st });
    save();
  }

  /* 사례 직접 추가 */
  function openResearchForm() {
    modal(`
      ${mHead('CSR Research', '사례 직접 추가')}
      <div class="form">
        <div class="field"><label>분류</label><select class="input" id="r_cat">${CATS.map(c => `<option>${c}</option>`).join('')}</select></div>
        <div class="field"><label>지역</label><select class="input" id="r_region"><option>국내</option><option>해외</option></select></div>
        <div class="field"><label>기관·구단명</label><input class="input" id="r_org"></div>
        <div class="field"><label>우선순위</label><select class="input" id="r_prio"><option>높음</option><option selected>중간</option><option>낮음</option></select></div>
        <div class="field full"><label>제목</label><input class="input" id="r_title"></div>
        <div class="field"><label>출처</label><input class="input" id="r_src" placeholder="매체·기관명"></div>
        <div class="field"><label>원문 링크</label><input class="input" id="r_url" placeholder="https://"></div>
        <div class="field full"><label>요약</label><textarea class="input" id="r_sum"></textarea></div>
        <div class="field full"><label>성과</label><input class="input" id="r_result"></div>
        <div class="field full"><label>핵심 인사이트</label><textarea class="input" id="r_ins" style="min-height:60px"></textarea></div>
        <div class="field full"><label>인천유나이티드 적용 방안</label><textarea class="input" id="r_apply" style="min-height:60px"></textarea></div>
        <div class="field full"><label>매출 연결 포인트</label><input class="input" id="r_rev"></div>
      </div>
      <div class="modal-f"><button class="btn btn-ghost" data-act="close">취소</button><button class="btn" data-act="saveResearch">저장</button></div>`);
  }

  /* 기획안 편집 */
  function openProposalForm(id) {
    const p = id ? proposals().find(x => x.id === id) : { title: '', priority: '중간', area: '', revenue: [], background: '', goal: '', target: '', strategy: '', partners: [], actions: [], revenueModel: '', timeline: '', budget: [], effect: '', kpis: [] };
    modal(`
      ${mHead('CSR Proposal', id ? '기획안 편집' : '새 기획안')}
      <div class="form">
        <div class="field full"><label>기획안 제목</label><input class="input" id="p_title" value="${esc(p.title)}"></div>
        <div class="field"><label>목표</label><input class="input" id="p_goal" value="${esc(p.goal)}"></div>
        <div class="field"><label>타깃</label><input class="input" id="p_target" value="${esc(p.target)}"></div>
        <div class="field"><label>영역</label><select class="input" id="p_area">${['', ...ACTS().areas].map(o => `<option ${o === p.area ? 'selected' : ''}>${o}</option>`).join('')}</select></div>
        <div class="field"><label>우선순위</label><select class="input" id="p_prio">${['높음', '중간', '낮음'].map(o => `<option ${o === p.priority ? 'selected' : ''}>${o}</option>`).join('')}</select></div>
        <div class="field full"><label>매출 연결 유형</label><div class="toolbar">${REV.map(r => `<label class="chk"><input type="checkbox" class="p_rev" value="${r}" ${(p.revenue || []).includes(r) ? 'checked' : ''}> ${r}</label>`).join('')}</div></div>
        <div class="field full"><label>배경 및 목적</label><textarea class="input" id="p_bg" style="min-height:60px">${esc(p.background)}</textarea></div>
        <div class="field full"><label>핵심 전략</label><textarea class="input" id="p_strat" style="min-height:60px">${esc(p.strategy)}</textarea></div>
        <div class="field full"><label>매출 연결 구조</label><textarea class="input" id="p_revm" style="min-height:60px">${esc(p.revenueModel)}</textarea></div>
        <div class="field full"><label>세부 실행 방안 (한 줄에 하나)</label><textarea class="input" id="p_actions">${esc((p.actions || []).join('\n'))}</textarea></div>
        <div class="field"><label>협력 기관 (한 줄에 하나)</label><textarea class="input" id="p_partners">${esc((p.partners || []).join('\n'))}</textarea></div>
        <div class="field"><label>실행 시점</label><textarea class="input" id="p_time">${esc(p.timeline)}</textarea></div>
        <div class="field"><label>예상 비용 (항목 | 금액)</label><textarea class="input" id="p_budget">${esc((p.budget || []).map(b => `${b.item} | ${b.cost}`).join('\n'))}</textarea></div>
        <div class="field"><label>KPI (지표 | 목표)</label><textarea class="input" id="p_kpis">${esc((p.kpis || []).map(k => `${k.name} | ${k.target}`).join('\n'))}</textarea></div>
        <div class="field full"><label>기대 효과</label><textarea class="input" id="p_effect" style="min-height:60px">${esc(p.effect)}</textarea></div>
      </div>
      <div class="modal-f"><button class="btn btn-ghost" data-act="close">취소</button><button class="btn" data-act="saveProposal" data-id="${id || ''}">저장</button></div>`, true);
  }
  function saveProposal(id) {
    if (!val('p_title')) { toast('제목을 입력하세요.'); return; }
    const pairs = (s, a, b) => lines(s).map(l => { const [x, ...y] = l.split('|'); return { [a]: x.trim(), [b]: y.join('|').trim() }; });
    const data = {
      title: val('p_title'), goal: val('p_goal'), target: val('p_target'), area: val('p_area'), priority: val('p_prio'),
      revenue: [...document.querySelectorAll('.p_rev:checked')].map(c => c.value),
      background: val('p_bg'), strategy: val('p_strat'), revenueModel: val('p_revm'), actions: lines(val('p_actions')),
      partners: lines(val('p_partners')), timeline: val('p_time'),
      budget: pairs(val('p_budget'), 'item', 'cost'), kpis: pairs(val('p_kpis'), 'name', 'target'), effect: val('p_effect'),
    };
    if (id) patchProposal(id, data);
    else { const nid = uid('np'); store.newProposals.push({ id: nid, status: '검토', research: [], linked: [], created: new Date().toISOString(), updated: TODAY_ISO, ...data }); save(); ui.pSel = nid; ui.pFilter = '전체'; }
    closeModal(); render(); toast('기획안이 저장되었습니다.');
  }

  /* PPT 기획안 — 공통 엔진(assets/js/proposal-deck.js)에 넘길 구성 */
  /* AI 원고(p.deck)가 있으면 그대로, 없거나 사용자가 내용을 편집했으면 기획안 필드에서 자동 구성 */
  const userEdited = p => store.newProposals.some(x => x.id === p.id) || Object.keys(store.proposals[p.id] || {}).some(k => !['status', 'updated'].includes(k));
  function deckOf(p) {
    const rmap = Object.fromEntries(research().map(r => [r.id, r]));
    const rs = (p.research || []).map(id => rmap[id]).filter(Boolean);
    const useAI = p.deck && !userEdited(p);
    return {
      meta: { kind: 'CSR PROPOSAL', project: 'INCHEON UNITED', org: '인천유나이티드', date: fmtFull(TODAY_ISO), fileName: `인천유나이티드 CSR 기획안_${p.title}` },
      content: useAI ? p.deck : null, ai: !!useAI,
      fallback: ProposalDeck.auto({ title: p.title, goal: p.goal, target: p.target, background: p.background, strategy: p.strategy,
        strategyDetail: [p.strategy, p.revenueModel].filter(Boolean).join(' '), actions: p.actions, timeline: p.timeline,
        research: rs.map(r => ({ source: r.source || r.org, title: r.title, summary: r.summary, insight: r.insight })),
        budget: p.budget, effect: p.effect, kpis: p.kpis, result: p.revenueModel }),
    };
  }
  function openPPT(id) {
    const p = proposals().find(x => x.id === id), deck = deckOf(p);
    modal(`${mHead(`PPT 기획안 · ${ProposalDeck.count(deck)} slides`, esc(p.title))}
      ${ProposalDeck.toolbar(deck)}
      ${ProposalDeck.preview(deck)}
      <div class="modal-f"><span class="muted" style="font-size:12px;margin-right:auto;align-self:center">제안서 템플릿 v2.1에 내용을 채운 파일입니다. 이미지 자리는 도형 우클릭 → 채우기 → 그림으로 사진을 넣으세요.</span>
      <button class="btn btn-ghost" data-act="close">닫기</button><button class="btn btn-ghost" data-act="print" data-id="${id}">${icon('print', 'icon-sm')} PDF 저장</button><button class="btn" data-act="pptx" data-id="${id}">${icon('download', 'icon-sm')} PPT 다운로드</button></div>`, true);
  }
  async function downloadPPT(el) {
    const p = proposals().find(x => x.id === el.dataset.id);
    el.disabled = true; const label = el.innerHTML; el.textContent = 'PPT 생성 중…';
    try { await ProposalDeck.download(deckOf(p)); toast('PPT 파일을 다운로드했습니다.'); }
    catch (e) { toast(e.message || 'PPT 생성에 실패했습니다.'); }
    finally { el.disabled = false; el.innerHTML = label; }
  }

  /* 설정 */
  function openSettings() {
    modal(`${mHead('Settings', '설정')}
      <div class="sec"><b>데이터 연동 상태</b>
        <p style="font-size:13px">인천유나이티드 활동 자료: ${ACTS().items.length}건 (${esc(ACTS().version || '-')})<br>
        <span class="muted">사례 리서치 업데이트 ${fmtTime(RES().updatedAt)} · 기획안 생성 ${fmtTime(PRO().updatedAt)}</span></p>
      </div>
      <div class="sec"><b>데이터 관리</b>
        <p class="muted" style="font-size:13px;margin-bottom:10px">기획안 상태·편집, 실행 관리, 직접 추가한 사례는 이 브라우저에 저장됩니다.</p>
        <div class="toolbar"><button class="btn btn-ghost" data-act="export">내 입력 데이터 내보내기 (JSON)</button><button class="btn btn-ghost" data-act="reset" style="color:var(--danger)">내 입력 데이터 초기화</button></div>
      </div>
      <div class="modal-f"><button class="btn" data-act="close">닫기</button></div>`);
  }

  /* ───────── Events ───────── */
  const ACT = {
    close: closeModal,
    ovClose: (el, e) => { if (e.target === el) closeModal(); },
    settings: openSettings,
    export: () => {
      const blob = new Blob([JSON.stringify({ exported: TODAY_ISO, ...store }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `csr-backup-${TODAY_ISO}.json`; a.click();
    },
    reset: () => { if (confirm('기획안 상태·편집, 실행 관리, 직접 추가한 사례 등 이 브라우저에 저장된 입력 내용이 초기화됩니다. 계속할까요?')) { store = structuredClone(DEFAULT); save(); closeModal(); render(); toast('초기화되었습니다.'); } },

    aArea: el => { ui.aArea = el.dataset.v; render(); },
    aStage: el => { ui.aStage = el.dataset.v; render(); },
    activity: el => openActivity(el.dataset.id),

    rCat: el => { ui.rCat = el.dataset.v; render(); },
    rRegion: el => { ui.rRegion = el.dataset.v; render(); },
    addResearch: openResearchForm,
    saveResearch: () => {
      if (!val('r_title')) { toast('제목을 입력하세요.'); return; }
      const url = val('r_url');
      store.research.push({ id: uid('cm'), category: val('r_cat'), region: val('r_region'), org: val('r_org'), priority: val('r_prio'), date: TODAY_ISO, title: val('r_title'), source: val('r_src'),
        url: /^https?:\/\//.test(url) ? url : '', summary: val('r_sum'), result: val('r_result'), insight: val('r_ins'), apply: val('r_apply'), revenue: [], revenueLink: val('r_rev') });
      save(); closeModal(); render(); toast('사례가 추가되었습니다.');
    },
    toProposal: el => {
      const r = research().find(x => x.id === el.dataset.id);
      const nid = uid('np');
      store.newProposals.push({ id: nid, title: `${r.org ? r.org + ' 사례 – ' : ''}인천유나이티드 적용안`, status: '검토', priority: r.priority, created: new Date().toISOString(), updated: TODAY_ISO,
        area: '', revenue: r.revenue || [], background: r.summary, goal: '', target: '', strategy: r.apply, revenueModel: r.revenueLink || '', partners: [], actions: [], timeline: '', budget: [], effect: '', kpis: [], research: [r.id], linked: [] });
      save(); ui.pSel = nid; ui.pFilter = '전체';
      if (location.hash === '#/proposal') render(); else location.hash = '#/proposal';
      requestAI(nid);   // AI가 사례를 분석해 전체 기획안 작성 → 완료 시 초안 자동 교체
    },
    aiWrite: el => requestAI(el.dataset.id),

    pFilter: el => { ui.pFilter = el.dataset.v; ui.pSel = null; ui.pLimit = 50; render(); },
    pSel: el => { ui.pSel = el.dataset.id; render(); },
    pMore: () => { ui.pLimit += 50; render(); },
    goProposal: el => { closeModal(); ui.pFilter = '전체'; ui.pSel = el.dataset.id; if (location.hash === '#/proposal') render(); else location.hash = '#/proposal'; },
    newProposal: () => openProposalForm(null),
    editProposal: el => openProposalForm(el.dataset.id),
    saveProposal: el => saveProposal(el.dataset.id),
    ppt: el => openPPT(el.dataset.id),
    pptx: downloadPPT,
    print: el => {
      const p = proposals().find(x => x.id === el.dataset.id);
      $('#print-root').innerHTML = ProposalDeck.printHtml(deckOf(p));
      document.body.classList.add('printing');
      window.print();
      document.body.classList.remove('printing');
    },

    adopt: el => { patchProposal(el.dataset.id, { status: '채택' }); render(); toast('채택되었습니다. 실행 관리 보드에 추가했습니다.'); },
    execOpen: el => openExec(el.dataset.id),
    execMemo: el => { const t = val('e_memo'); if (!t) return; saveExecFields(el.dataset.id); exec(el.dataset.id).memos.push({ date: TODAY_ISO, text: t }); save(); openExec(el.dataset.id); pendingRender = true; },
    execSave: el => { saveExecFields(el.dataset.id); closeModal(); render(); toast('저장되었습니다.'); },
  };

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'SELECT') return;
    const fn = ACT[el.dataset.act];
    if (fn) fn(el, e);
  });
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset.act === 'pStatus') { patchProposal(el.dataset.id, { status: el.value }); render(); toast(`상태가 '${el.value}'(으)로 변경되었습니다.${EXEC.includes(el.value) ? ' 실행 관리 보드에 표시됩니다.' : ''}`); }
  });
  document.addEventListener('input', e => {
    if (e.target.id === 'rq') {
      ui.rQuery = e.target.value;
      const pos = e.target.selectionStart;
      render();
      const inp = $('#rq'); inp.focus(); inp.setSelectionRange(pos, pos);
    }
  });
  document.addEventListener('focusout', () => { setTimeout(() => { if (pendingRender && !busy()) { pendingRender = false; render(); } }, 0); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

  /* ───────── Init ───────── */
  $('#today').textContent = `${fmtFull(TODAY_ISO)} (${DOW[TODAY.getDay()]})`;
  $('#btn-settings').innerHTML = `${icon('settings', 'icon-sm')} 설정`;
  $('#back-hub').innerHTML = `${icon('back')} 업무 선택으로`;
  render();
})();
