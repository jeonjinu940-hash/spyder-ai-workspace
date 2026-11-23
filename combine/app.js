/* SPYDER BASEBALL COMBINE AI MANAGER */
(() => {
  'use strict';

  /* ───────── Data sources (자동 갱신되는 파일) ───────── */
  const REC = () => window.COMBINE_RECORDS || { schedule: [], players: [], source: '', syncedAt: '' };
  const RES = () => window.COMBINE_RESEARCH || { items: [], updatedAt: '' };
  const PRO = () => window.COMBINE_PROPOSALS || { marketing: [], sns: [], updatedAt: '' };

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
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  const ICON = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
    research: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    proposal: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    operation: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    kakao: '<path d="M4 5h16v11H9l-5 4z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    check: '<path d="m5 12 5 5L20 7"/>',
    link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
    sync: '<path d="M20 12a8 8 0 0 1-14.3 4.9M4 12A8 8 0 0 1 18.3 7.1"/><path d="M18 3v4.5h-4.5M6 21v-4.5h4.5"/>',
    box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
  };
  const LOGO = '../assets/img/spyder-wordmark.png';
  const icon = (n, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24">${ICON[n]}</svg>`;

  /* ───────── Store (사용자 입력분만 localStorage에 저장) ───────── */
  const KEY = 'spyder.combine.v2';
  const DEFAULT = { research: [], proposals: {}, newProposals: [], memos: {}, giftSent: {}, snsDone: {}, sent: {}, drafts: {}, history: [], settings: { manager: '담당자' } };
  let store;
  try { store = Object.assign(structuredClone(DEFAULT), JSON.parse(localStorage.getItem(KEY) || '{}')); }
  catch (e) { store = structuredClone(DEFAULT); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* 저장 불가 환경 */ } };

  /* ───────── 기록 분석 ───────── */
  const METRICS = [
    { k: 'm55', label: '55m', name: '55m 직선주루', unit: '초', asc: true },
    { k: 'm27', label: '27m', name: '27m 직선주루', unit: '초', asc: true },
    { k: 'm5', label: '5m', name: '5m 스타트', unit: '초', asc: true },
    { k: 'b1', label: '1루', name: '홈→1루', unit: '초', asc: true },
    { k: 'b2', label: '2루', name: '홈→2루', unit: '초', asc: true },
    { k: 'grip', label: '악력', name: '악력', unit: 'kg', asc: false },
  ];
  const M = Object.fromEntries(METRICS.map(m => [m.k, m]));
  const fmtVal = (m, v) => (v == null ? '-' : m.k === 'grip' ? v.toFixed(1) : v.toFixed(3));
  const better = (m, a, b) => (m.asc ? a < b : a > b);

  function ranking(k, players = REC().players) {
    const m = M[k];
    const list = players.filter(p => p[k] != null).sort((a, b) => (m.asc ? a[k] - b[k] : b[k] - a[k]));
    let rank = 0;
    return list.map((p, i) => { if (i === 0 || list[i - 1][k] !== p[k]) rank = i + 1; return { ...p, rank }; });
  }
  const schoolPlayers = name => REC().players.filter(p => p.school === name);

  function schools() {
    return REC().schedule.map(s => {
      const ps = schoolPlayers(s.school);
      const d = diff(s.date);
      const status = s.measured ? '측정완료' : d >= 0 ? '예정' : '확인 필요';
      const giftPending = s.measured && !s.giftDone && !!s.giftItems && !store.giftSent[s.school];
      return { ...s, id: s.school, players: ps, count: ps.length, status, giftPending, memos: store.memos[s.school] || [] };
    });
  }
  const school = id => schools().find(s => s.id === id);
  const addMemo = (id, text) => { (store.memos[id] = store.memos[id] || []).push({ date: TODAY_ISO, text }); save(); };
  /* SNS 업로드 일정 (엑셀 SNS SCHEDULE) + 브라우저에서 바꾼 업로드 상태 */
  function snsPosts() {
    const schoolSet = new Set(REC().schedule.map(s => s.school));
    return (REC().sns || []).map(x => {
      const key = `${x.date}|${x.school}|${x.post}`;
      const isDone = !!(x.done || store.snsDone[key]);
      return { ...x, key, isDone, late: !isDone && diff(x.date) < 0, sch: schoolSet.has(x.school), title: x.school ? `${x.school} ${x.post}` : x.post };
    }).sort((a, b) => a.date.localeCompare(b.date));
  }
  function setSns(key, done) {
    if (done) store.snsDone[key] = TODAY_ISO; else delete store.snsDone[key];
    const school = key.split('|')[1];
    if (school) addMemo(school, `[SNS] ${key.split('|')[2]} ${done ? '업로드 완료' : '업로드 전으로 변경'}`);
    save();
    if ($('#modal-root').innerHTML && school) { openSchool(school); pendingRender = true; } else render();
    toast(done ? 'SNS 업로드 완료로 표시했습니다.' : '업로드 전으로 되돌렸습니다.');
  }

  /* 물품 증정 완료 처리 → 관련 후속 업무(물품 발송 안내 메시지) 자동 정리 */
  function setGift(id, done) {
    const s = school(id);
    if (!s) return;
    const key = `gift:${s.school}:${s.date}`;
    if (done) {
      store.giftSent[s.school] = TODAY_ISO;
      store.sent[key] = { date: TODAY_ISO, auto: true };
      delete store.drafts[key];
      addMemo(s.school, '[물품 증정] 증정 완료 처리 · 물품 발송 안내 업무 자동 종료');
    } else {
      delete store.giftSent[s.school];
      if (store.sent[key] && store.sent[key].auto) delete store.sent[key];
      addMemo(s.school, '[물품 증정] 증정 완료 취소');
    }
    save();
    if ($('#modal-root').innerHTML) { openSchool(id); pendingRender = true; } else render();
    toast(done ? `${s.school} 증정 완료 · 후속 업무를 자동으로 정리했습니다.` : `${s.school} 증정 완료를 취소했습니다.`);
  }
  const greetName = s => { const n = (s.contactName || '').replace(/님$/, '').trim(); return n ? `${n}님` : '감독님'; };
  const cleanItems = t => (t || '').replace(/\s*(발송|지급)\s*필요\s*/g, '').split(/\s*[\/,]\s*/).filter(Boolean);

  /* ───────── AI 업무 감지 엔진 ───────── */
  const TASK = {
    confirm: { label: '일정 확인', tone: 'b-danger', cool: Infinity },
    thanks:  { label: '참여 감사·기록 안내', tone: 'b-ok', cool: Infinity },
    gift:    { label: '물품 발송 안내', tone: 'b-warn', cool: 7 },
  };
  function detectTasks() {
    const out = [];
    for (const s of schools()) {
      const d = diff(s.date);
      const add = (type, reason, prio) => {
        const key = `${type}:${s.school}:${s.date}`;
        const sent = store.sent[key];
        if (sent && (TASK[type].cool === Infinity || -diff(sent.date) < TASK[type].cool)) return;
        out.push({ key, type, school: s, reason, prio });
      };
      if (!s.measured && d >= 0 && d <= 2) add('confirm', `측정 ${dday(s.date)} (${fmt(s.date)} ${s.time}) · 일정 확인 필요`, 1);
      if (s.measured && d <= 0 && d >= -7) add('thanks', `${fmt(s.date)} 측정 완료 (${s.count}명) · 감사 및 기록 안내`, 2);
      if (s.giftPending) add('gift', `물품 증정 미완료 · ${cleanItems(s.giftItems).slice(0, 3).join(', ')}${cleanItems(s.giftItems).length > 3 ? ' 외' : ''}`, 3);
    }
    return out.sort((a, b) => a.prio - b.prio || b.school.date.localeCompare(a.school.date));
  }

  function draft(type, s) {
    const m = store.settings.manager || '담당자';
    const head = `안녕하세요 ${greetName(s)},\nSPYDER 베이스볼 컴바인 담당 ${m}입니다.`;
    const end = '\n\n감사합니다.\nSPYDER 드림';
    if (type === 'confirm') {
      return `${head}\n\n${fmt(s.date)} ${s.time} ${s.school} 컴바인 측정 일정 확인차 연락드립니다.\n\n· 일시: ${fmt(s.date)} ${s.time}\n· 측정 항목: 5m·27m·55m 직선주루, 1루·2루 주루, 악력\n\n선수들은 운동복과 스파이크를 준비해 주시면 됩니다.\n혹시 일정이나 참여 인원에 변동이 있으시면 편하게 말씀 부탁드립니다.${end}`;
    }
    if (type === 'thanks') {
      const lines = ['m55', 'm5', 'b1', 'grip'].map(k => {
        const top = ranking(k, s.players)[0];
        return top ? `· ${M[k].name} 1위: ${top.name} (${fmtVal(M[k], top[k])}${M[k].unit})` : null;
      }).filter(Boolean);
      return `${head}\n\n${fmt(s.date)} ${s.school} 컴바인 측정에 협조해 주셔서 진심으로 감사드립니다.\n총 ${s.count}명의 선수가 참여해 주었고, 학교 내 주요 기록은 아래와 같습니다.\n\n${lines.join('\n')}\n\n전체 기록과 전국 순위는 SPYDER 베이스볼 컴바인 페이지에서 확인하실 수 있습니다.${end}`;
    }
    if (type === 'gift') {
      return `${head}\n\n${s.school} 컴바인 측정 참여 기념 SPYDER 물품을 아래와 같이 준비하고 있습니다.\n\n${cleanItems(s.giftItems).map(i => `· ${i}`).join('\n')}\n\n받으실 주소와 수령인 정보를 회신해 주시면 빠르게 발송해 드리겠습니다.${end}`;
    }
    return '';
  }

  function markSent(task, text) {
    const s = task.school, T = TASK[task.type];
    store.sent[task.key] = { date: TODAY_ISO };
    store.history.unshift({ date: TODAY_ISO, type: task.type, school: s.school, text });
    delete store.drafts[task.key];
    addMemo(s.school, `[카카오톡] ${T.label} 메시지 발송`);
  }

  /* ───────── Research / Proposal ───────── */
  const CATS = ['스포츠 브랜드 마케팅', '야구 시장 동향', '프로모션 전략', 'SNS 마케팅', '경쟁사 분석', '상품 분석'];
  const research = () => [...store.research, ...RES().items].sort((a, b) => b.date.localeCompare(a.date));
  const P_STATUS = ['신규 제안', '검토', '채택', '보류'];
  const proposals = (type = 'marketing') => [...(type === 'marketing' ? store.newProposals : []), ...(PRO()[type] || [])]
    .map(p => ({ type, ...p, ...(store.proposals[p.id] || {}) }))
    .sort((a, b) => (b.created || b.updated).localeCompare(a.created || a.updated));
  const allProposals = () => [...proposals('marketing'), ...proposals('sns')];
  const patchProposal = (id, obj) => { store.proposals[id] = { ...(store.proposals[id] || {}), ...obj, updated: TODAY_ISO }; save(); };

  /* ───────── UI state ───────── */
  const ui = { rankK: 'm55', rCat: '전체', rQuery: '', pTab: 'marketing', pSel: null, pFilter: '전체', pLimit: 50, oFilter: '전체', sFilter: '업로드 전', kSel: null };
  const prioBadge = p => `<span class="badge ${p === '높음' ? 'b-dark' : p === '중간' ? '' : 'b-line'}">우선순위 ${esc(p)}</span>`;
  const statusTone = { '예정': 'b-dark', '측정완료': 'b-ok', '확인 필요': 'b-warn' };
  const pStatusTone = { '신규 제안': 'b-dark', '검토': 'b-warn', '채택': 'b-ok', '보류': 'b-line' };
  const kpi = (l, v, unit, s, p) => `
    <div class="kpi glass"><div class="l">${l}</div><div class="v">${v}<small>${unit}</small></div><div class="s">${s}</div>
    ${p !== null ? `<div class="bar"><i style="width:${p}%"></i></div>` : ''}</div>`;
  const sourceLine = () => `<span class="src-line">${icon('sync', 'icon-sm')} ${esc(REC().source || '엑셀 기록 없음')} · 동기화 ${fmtTime(REC().syncedAt)}</span>`;

  /* ───────── Views ───────── */
  function vDashboard() {
    const ss = schools(), tasks = detectTasks(), P = REC().players;
    const done = ss.filter(s => s.measured);
    const upcoming = ss.filter(s => !s.measured && diff(s.date) >= 0).sort((a, b) => a.date.localeCompare(b.date));
    const next = upcoming[0];
    const gift = ss.filter(s => s.giftPending);
    const g1 = P.filter(p => p.grade === 1).length, g2 = P.filter(p => p.grade === 2).length;
    const m = M[ui.rankK];
    const rank = ranking(ui.rankK).slice(0, 10);
    const avg = done.map(s => {
      const v = s.players.map(p => p[ui.rankK]).filter(x => x != null);
      return { school: s.school, v: v.length ? v.reduce((a, b) => a + b, 0) / v.length : null, n: v.length };
    }).filter(x => x.v != null).sort((a, b) => (m.asc ? a.v - b.v : b.v - a.v));
    const vmin = Math.min(...avg.map(a => a.v)), vmax = Math.max(...avg.map(a => a.v));
    const barW = v => (vmax === vmin ? 100 : m.asc ? 40 + 60 * (vmax - v) / (vmax - vmin) : 40 + 60 * (v - vmin) / (vmax - vmin));
    const rs = research().slice(0, 4), ps = allProposals().filter(p => p.status !== '보류').sort((a, b) => (b.created || b.updated).localeCompare(a.created || a.updated)).slice(0, 5);

    return `
      <div class="hero-g glass">
        <div>
          <div class="eyebrow">Today · ${fmtFull(TODAY_ISO)}</div>
          <h2>${done.length}개교 · ${P.length}명 측정 완료${next ? `, 다음 일정은 ${esc(next.school)} ${fmt(next.date)} (${dday(next.date)})` : ''}</h2>
          <p class="muted">AI 추천 업무 ${tasks.length}건 · ${sourceLine()}</p>
        </div>
        <a class="btn" href="#/kakao">${icon('kakao', 'icon-sm')} 메시지 제안 확인</a>
      </div>

      <div class="grid g4">
        ${kpi('측정 완료 학교', done.length, `/${ss.length}`, `진행률 ${pct(done.length, ss.length)}%`, pct(done.length, ss.length))}
        ${kpi('총 측정 선수', P.length, '명', `1학년 ${g1} · 2학년 ${g2}`, null)}
        ${kpi('남은 일정', upcoming.length, '건', next ? `다음: ${esc(next.school)} ${fmt(next.date)} ${esc(next.time)}` : '예정된 일정 없음', null)}
        ${kpi('물품 증정 미완료', gift.length, '개교', `증정 완료 ${done.length - gift.length}개교`, pct(done.length - gift.length, done.length))}
      </div>

      <div class="grid g21">
        <div class="panel">
          <div class="panel-h"><h3>${icon('spark', 'icon-sm')} AI 추천 업무</h3><a class="link-more" href="#/kakao">전체 보기 →</a></div>
          <div class="rows">
            ${tasks.length ? tasks.slice(0, 6).map(t => `
              <div class="row">
                <span class="badge ${TASK[t.type].tone}">${TASK[t.type].label}</span>
                <div class="grow"><div class="t">${esc(t.school.school)} · ${esc(greetName(t.school))}</div><div class="d">${esc(t.reason)}</div></div>
                <button class="btn btn-ghost btn-sm" data-act="goTask" data-key="${esc(t.key)}">메시지 작성</button>
              </div>`).join('') : '<div class="empty">지금 처리할 추천 업무가 없습니다.</div>'}
          </div>
        </div>
        <div class="panel">
          <div class="panel-h"><h3>${icon('operation', 'icon-sm')} 다가오는 일정</h3><a class="link-more" href="#/operation?tab=schedule">일정 관리 →</a></div>
          <div class="rows">
            ${upcoming.length ? upcoming.slice(0, 6).map(s => `
              <div class="row">
                <span class="dday ${diff(s.date) <= 2 ? 'hot' : ''}">${dday(s.date)}</span>
                <div class="grow"><div class="t">${esc(s.school)}</div><div class="d">${fmt(s.date)} ${esc(s.time)}${s.contactName ? ` · ${esc(s.contactName)}` : ''}</div></div>
              </div>`).join('') : '<div class="empty">예정된 일정이 없습니다.</div>'}
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-h" style="flex-wrap:wrap">
          <h3>${icon('trophy', 'icon-sm')} 컴바인 기록 랭킹</h3>
          <div class="toolbar">${METRICS.map(x => `<button class="chip ${x.k === ui.rankK ? 'on' : ''}" data-act="rankK" data-v="${x.k}">${x.label}</button>`).join('')}</div>
        </div>
        <div class="grid g2">
          <div>
            <div class="eyebrow" style="margin-bottom:8px">전체 TOP 10 · ${m.name} (${m.unit}, ${m.asc ? '낮을수록 우수' : '높을수록 우수'})</div>
            <div class="tbl-wrap"><table class="tbl" style="min-width:420px">
              <thead><tr><th>순위</th><th>이름</th><th>학교</th><th>학년</th><th>포지션</th><th style="text-align:right">기록</th></tr></thead>
              <tbody>${rank.map(p => `<tr>
                <td><span class="rank ${p.rank <= 3 ? 'top' : ''}">${p.rank}</span></td><td><b>${esc(p.name)}</b></td><td>${esc(p.school)}</td>
                <td>${p.grade ?? '-'}</td><td>${esc(p.pos)}</td><td style="text-align:right;font-weight:700">${fmtVal(m, p[ui.rankK])}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">기록이 없습니다.</td></tr>'}</tbody>
            </table></div>
          </div>
          <div>
            <div class="eyebrow" style="margin-bottom:8px">학교별 평균 · ${m.name}</div>
            <div class="rows">${avg.map((a, i) => `
              <div class="row" style="padding:7px 0">
                <span class="muted" style="width:18px;font-size:12px">${i + 1}</span>
                <div class="grow"><div style="display:flex;justify-content:space-between;font-size:13px"><b>${esc(a.school)}</b><span>${fmtVal(m, a.v)}${m.unit} <span class="muted">(${a.n}명)</span></span></div>
                <div class="bar" style="margin-top:5px"><i style="width:${barW(a.v)}%;${i < 3 ? '' : 'background:#9a9ca1'}"></i></div></div>
              </div>`).join('') || '<div class="empty">측정 데이터가 없습니다.</div>'}
            </div>
          </div>
        </div>
      </div>

      <div class="grid g2">
        <div class="panel">
          <div class="panel-h"><h3>최근 조사 자료</h3><a class="link-more" href="#/research">→</a></div>
          <div class="rows">${rs.map(r => `
            <div class="row"><div class="grow"><a class="t" style="display:block" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a><div class="d">${esc(r.category)} · ${esc(r.source)}</div></div></div>`).join('') || '<div class="empty">조사 자료가 없습니다.</div>'}
          </div>
        </div>
        <div class="panel">
          <div class="panel-h"><h3>최신 AI 제안</h3><a class="link-more" href="#/proposal">→</a></div>
          <div class="rows">${ps.map(p => `
            <div class="row"><span class="badge ${p.type === 'sns' ? 'b-line' : ''}" style="min-width:74px;justify-content:center">${p.type === 'sns' ? 'SNS' : 'MARKETING'}</span><div class="grow"><a class="t" style="display:block;cursor:pointer" data-act="goProposal" data-id="${p.id}" data-type="${p.type}">${esc(p.title)}</a><div class="d">${p.created ? fmtTime(p.created) : fmt(p.updated)}</div></div><span class="badge ${pStatusTone[p.status] || ''}">${esc(p.status)}</span></div>`).join('') || '<div class="empty">제안이 없습니다.</div>'}
          </div>
        </div>
      </div>`;
  }

  function vResearch() {
    const all = research();
    const q = ui.rQuery.trim().toLowerCase();
    const list = all.filter(r => (ui.rCat === '전체' || r.category === ui.rCat) &&
      (!q || [r.title, r.summary, r.insight, r.apply, r.source].join(' ').toLowerCase().includes(q)));
    return `
      <div class="hero-g glass">
        <div>
          <div class="eyebrow">AI Research · 매시간 자동 조사</div>
          <h2>누적 조사 자료 ${all.length}건</h2>
          <p class="muted">컴바인을 통한 SPYDER 야구 비전 확대·매출 증대에 적용할 실제 사례를 매시간 조사해 원문 링크와 함께 축적합니다. 마지막 업데이트 ${fmtTime(RES().updatedAt)}</p>
        </div>
        <button class="btn" data-act="addResearch">${icon('plus', 'icon-sm')} 자료 직접 추가</button>
      </div>

      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr))">
        ${['전체', ...CATS].map(c => `
          <button class="cat-count glass ${ui.rCat === c ? 'on' : ''}" data-act="rCat" data-v="${esc(c)}">
            <div class="v">${c === '전체' ? all.length : all.filter(r => r.category === c).length}</div><div class="l">${esc(c)}</div>
          </button>`).join('')}
      </div>

      <div class="toolbar">
        <div class="search">${icon('research', 'icon-sm')}<input id="rq" placeholder="제목·인사이트·적용 방안 검색" value="${esc(ui.rQuery)}"></div>
        <span class="sp"></span>
        <span class="muted" style="font-size:13px">${list.length}건 표시</span>
      </div>

      <div class="grid g2">
        ${list.length ? list.map(rCard).join('') : '<div class="panel empty" style="grid-column:1/-1">조건에 맞는 자료가 없습니다.</div>'}
      </div>`;
  }
  const rCard = r => `
    <article class="rcard">
      <div class="meta"><span class="badge">${esc(r.category)}</span>${prioBadge(r.priority)}<span style="margin-left:auto">수집 ${fmtFull(r.date)}${r.published ? ` · 발행 ${fmtFull(r.published)}` : ''}</span></div>
      <h4>${esc(r.title)}</h4>
      <p>${esc(r.summary)}</p>
      <div class="callout"><b>INSIGHT</b>${esc(r.insight)}</div>
      <div class="callout soft"><b>COMBINE 적용 방안</b>${esc(r.apply)}</div>
      <div class="foot">
        ${r.url ? `<a class="src" href="${esc(r.url)}" target="_blank" rel="noopener">${icon('link', 'icon-sm')} ${esc(r.source || '원문 보기')} · 원문 보기</a>` : `<span class="src">${esc(r.source || '출처 없음')}</span>`}
        <button class="btn btn-ghost btn-sm" data-act="toProposal" data-id="${esc(r.id)}">기획안으로 발전 →</button>
      </div>
    </article>`;

  function vProposal() {
    const type = ui.pTab;
    const all = proposals(type);
    const F = {
      '전체': () => true,
      '오늘 제안': x => (x.created || '').slice(0, 10) === TODAY_ISO || x.updated === TODAY_ISO && !x.created,
      ...Object.fromEntries(P_STATUS.map(s => [s, x => x.status === s])),
    };
    const list = all.filter(F[ui.pFilter] || F['전체']);
    if (!ui.pSel || !list.some(p => p.id === ui.pSel)) ui.pSel = list[0]?.id;
    const p = all.find(x => x.id === ui.pSel);
    const counts = t => proposals(t).filter(F['오늘 제안']).length;
    return `
      <div class="hero-g glass">
        <div>
          <div class="eyebrow">AI Proposal · 매시간 MARKETING 3건+ · SNS 3건+ 자동 제안</div>
          <h2>오늘 새 제안 ${counts('marketing') + counts('sns')}건</h2>
          <p class="muted">최신 리서치 자료와 엑셀 측정 기록을 바탕으로 제안합니다. 마지막 생성 ${fmtTime(PRO().updatedAt)}</p>
        </div>
        <div class="seg">
          <button class="${type === 'marketing' ? 'on' : ''}" data-act="pTab" data-v="marketing">MARKETING <span>${proposals('marketing').length}</span></button>
          <button class="${type === 'sns' ? 'on' : ''}" data-act="pTab" data-v="sns">SNS <span>${proposals('sns').length}</span></button>
        </div>
      </div>
      <div class="toolbar">
        ${Object.keys(F).map(f => `<button class="chip ${ui.pFilter === f ? 'on' : ''}" data-act="pFilter" data-v="${f}">${f} ${all.filter(F[f]).length}</button>`).join('')}
        <span class="sp"></span>
        ${type === 'marketing' ? `<button class="btn" data-act="newProposal">${icon('plus', 'icon-sm')} 새 기획안</button>` : ''}
      </div>
      <div class="p-wrap">
        <div class="panel" style="padding:10px">
          ${list.length ? list.slice(0, ui.pLimit).map(x => `
            <button class="p-item ${x.id === ui.pSel ? 'on' : ''}" data-act="pSel" data-id="${x.id}">
              <div style="display:flex;gap:6px;flex-wrap:wrap"><span class="badge ${pStatusTone[x.status] || ''}">${esc(x.status)}</span>${prioBadge(x.priority)}${type === 'sns' && x.format ? `<span class="badge b-line">${esc(x.format)}</span>` : ''}</div>
              <div class="t">${esc(x.title)}</div>
              <div class="muted" style="font-size:12px">${x.ai ? 'AI 제안' : '직접 작성'} · ${x.created ? fmtTime(x.created) : fmtFull(x.updated)}</div>
            </button>`).join('') + (list.length > ui.pLimit ? `<button class="btn btn-ghost" style="width:100%;margin-top:6px" data-act="pMore">더 보기 (${list.length - ui.pLimit}건)</button>` : '') : '<div class="empty">해당 조건의 제안이 없습니다.</div>'}
        </div>
        ${p ? (type === 'sns' ? snsDetail(p) : mkDetail(p)) : '<div class="panel empty">제안을 선택하세요.</div>'}
      </div>`;
  }

  const statusSelect = p => `<select class="input" style="width:auto;height:32px" data-act="pStatus" data-id="${p.id}">
    ${[...new Set([...P_STATUS, p.status])].map(s => `<option ${s === p.status ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>`;
  const researchLinks = p => {
    const rmap = Object.fromEntries(research().map(r => [r.id, r]));
    return (p.research || []).filter(id => rmap[id]).map(id => `<a class="callout soft" style="display:block;margin-bottom:8px" href="${esc(rmap[id].url)}" target="_blank" rel="noopener"><b>${esc(rmap[id].category)} · ${esc(rmap[id].source)}</b>${esc(rmap[id].title)}</a>`).join('') || '<span class="muted">연결된 자료 없음</span>';
  };

  function snsDetail(p) {
    const d = p.design || {};
    return `
        <div class="panel p-detail">
          <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start">
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">${statusSelect(p)}${prioBadge(p.priority)}<span class="badge">${esc(p.channel)}</span><span class="badge b-line">${esc(p.format)}</span></div>
            <div class="toolbar">
              <button class="btn btn-ghost btn-sm" data-act="copyCaption" data-id="${p.id}">${icon('copy', 'icon-sm')} 캡션 복사</button>
              <button class="btn btn-sm" data-act="snsPreview" data-id="${p.id}">${icon('proposal', 'icon-sm')} 콘텐츠 시안 미리보기</button>
            </div>
          </div>
          <h2>${esc(p.title)}</h2>
          <p class="muted">${esc(p.topic)}</p>
          <div class="sec"><div class="kv">
            <div><small>콘텐츠 목적</small>${esc(p.goal) || '-'}</div>
            <div><small>타깃</small>${esc(p.target) || '-'}</div>
            <div><small>게시 시점</small>${esc(p.timing) || '-'}</div>
          </div></div>
          <div class="sec"><b>내부 텍스트 (${(p.slides || []).length}${/릴스|쇼츠|틱톡/.test(p.format + p.channel) ? '씬' : '장'})</b>
            <ol class="steps">${(p.slides || []).map(s => `<li><div><b style="display:block">${esc(s.heading)}</b><span class="muted">${esc(s.body)}</span></div></li>`).join('')}</ol>
          </div>
          <div class="sec"><b>캡션 · 해시태그</b>
            <div class="caption-box">${esc(p.caption)}<div class="tags">${(p.hashtags || []).map(h => esc(h)).join(' ')}</div></div>
          </div>
          <div class="sec"><b>디자인 방향성</b>
            <div class="kv kv2">
              ${[['콘셉트', d.concept], ['레이아웃', d.layout], ['컬러', d.color], ['타이포그래피', d.typography], ['비주얼 연출', d.visual]].filter(x => x[1]).map(([k, v]) => `<div><small>${k}</small>${esc(v)}</div>`).join('')}
            </div>
          </div>
          ${(p.dataPoints || []).length ? `<div class="sec"><b>활용 데이터</b><ul class="steps">${p.dataPoints.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
          <div class="sec"><b>근거 조사 자료</b>${researchLinks(p)}</div>
        </div>`;
  }

  function mkDetail(p) {
    return `
        <div class="panel p-detail">
          <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start">
            <div style="display:flex;gap:6px;align-items:center">${statusSelect(p)}${prioBadge(p.priority)}</div>
            <div class="toolbar">
              <button class="btn btn-ghost btn-sm" data-act="editProposal" data-id="${p.id}">${icon('edit', 'icon-sm')} 편집</button>
              <button class="btn btn-sm" data-act="ppt" data-id="${p.id}">${icon('proposal', 'icon-sm')} PPT 기획안 미리보기</button>
            </div>
          </div>
          <h2>${esc(p.title)}</h2>
          <p class="muted">${esc(p.background)}</p>
          <div class="sec"><div class="kv">
            <div><small>마케팅 목표</small>${esc(p.goal) || '-'}</div>
            <div><small>타깃</small>${esc(p.target) || '-'}</div>
            <div><small>예상 비용</small>${(p.budget || []).map(b => `${esc(b.item)} ${esc(b.cost)}`).join('<br>') || '-'}</div>
          </div></div>
          <div class="sec"><b>핵심 전략</b>${esc(p.strategy) || '<span class="muted">작성 전</span>'}</div>
          <div class="sec"><b>세부 실행 방안</b>${(p.actions || []).length ? `<ol class="steps">${p.actions.map(a => `<li>${esc(a)}</li>`).join('')}</ol>` : '<span class="muted">작성 전</span>'}</div>
          <div class="sec"><b>기대 효과</b>${esc(p.effect) || '<span class="muted">작성 전</span>'}</div>
          <div class="sec"><b>성과 측정 지표 (KPI)</b>
            ${(p.kpis || []).length ? `<div class="rows">${p.kpis.map(k => `<div class="row"><div class="grow">${esc(k.name)}</div><b>${esc(k.target)}</b></div>`).join('')}</div>` : '<span class="muted">작성 전</span>'}
          </div>
          <div class="sec"><b>근거 조사 자료</b>${researchLinks(p)}</div>
        </div>`;
  }

  /* Operation Manager: 처음엔 '측정 일정 / SNS 일정' 두 탭만, 누르면 해당 화면 (#/operation?tab=schedule|sns) */
  const opTab = () => (/[?&]tab=(schedule|sns)/.exec(location.hash) || [])[1] || '';
  function vOperation() {
    const tab = opTab();
    const ss = schools(), sp = snsPosts();
    const sDone = ss.filter(s => s.measured).length, sNext = ss.filter(s => !s.measured && diff(s.date) >= 0).sort((a, b) => a.date.localeCompare(b.date))[0];
    const pDone = sp.filter(x => x.isDone).length, pNext = sp.find(x => !x.isDone && diff(x.date) >= 0), pLate = sp.filter(x => x.late).length;
    const gift = ss.filter(s => s.giftPending).length;
    const seg = `<div class="seg">
        <button class="${tab === 'schedule' ? 'on' : ''}" data-act="opTab" data-v="schedule">측정 일정 <span>${ss.length}</span></button>
        <button class="${tab === 'sns' ? 'on' : ''}" data-act="opTab" data-v="sns">SNS 일정 <span>${sp.length}</span></button>
      </div>`;
    if (!tab) return `
      <div class="op-tabs">
        <button class="op-card glass" data-act="opTab" data-v="schedule">
          <div class="eyebrow">01 · 측정 일정</div>
          <h3>측정 일정</h3>
          <p class="muted">학교별 측정 일정 · 측정 인원 · 물품 증정 · 후속 업무</p>
          <div class="op-stats"><div><b>${sDone}<small>/${ss.length}</small></b><span>측정 완료</span></div><div><b>${gift}</b><span>물품 증정 미완료</span></div></div>
          <div class="op-next">${sNext ? `다음 측정 · ${esc(sNext.school)} ${fmt(sNext.date)} <b>${dday(sNext.date)}</b>` : '예정된 측정 없음'}</div>
          <span class="op-go">열기 →</span>
        </button>
        <button class="op-card glass" data-act="opTab" data-v="sns">
          <div class="eyebrow">02 · SNS 일정</div>
          <h3>SNS 일정</h3>
          <p class="muted">기록 게시물 · 측정 영상 · 랭킹 콘텐츠 업로드 관리</p>
          <div class="op-stats"><div><b>${pDone}<small>/${sp.length}</small></b><span>업로드 완료</span></div><div><b class="${pLate ? 'late' : ''}">${pLate}</b><span>지연</span></div></div>
          <div class="op-next">${pNext ? `다음 업로드 · ${esc(pNext.title)} ${fmt(pNext.date)} <b>${dday(pNext.date)}</b>` : '예정된 업로드 없음'}</div>
          <span class="op-go">열기 →</span>
        </button>
      </div>`;
    return `<div class="toolbar">${seg}<span class="sp"></span><span class="src-line">${icon('sync', 'icon-sm')} 엑셀 자동 반영 · ${fmtTime(REC().syncedAt)}</span></div>
      ${tab === 'sns' ? vSnsTab() : vScheduleTab()}`;
  }

  function vSnsTab() {
    const sp = snsPosts();
    const pDone = sp.filter(x => x.isDone).length, pNext = sp.find(x => !x.isDone && diff(x.date) >= 0);
    const week = sp.filter(x => !x.isDone && diff(x.date) >= 0 && diff(x.date) <= 7).length, late = sp.filter(x => x.late).length;
    return `
      <div class="grid g4">
        ${kpi('업로드 완료', pDone, `/${sp.length}`, `진행률 ${pct(pDone, sp.length)}%`, pct(pDone, sp.length))}
        ${kpi('이번 주 업로드', week, '건', '오늘부터 7일 이내', null)}
        ${kpi('지연', late, '건', late ? '업로드일이 지난 게시물' : '지연 없음', null)}
        ${kpi('다음 업로드', pNext ? dday(pNext.date) : '-', '', pNext ? `${esc(pNext.title)} · ${fmt(pNext.date)}` : '예정 없음', null)}
      </div>
      ${snsPanel()}`;
  }

  function vScheduleTab() {
    const ss = schools().sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    const tasks = detectTasks();
    const F = {
      '전체': () => true,
      '예정': s => !s.measured,
      '측정 완료': s => s.measured,
      '물품 증정 미완료': s => s.giftPending,
    };
    const list = ss.filter(F[ui.oFilter] || F['전체']);
    const done = ss.filter(s => s.measured).length;
    const giftCell = s => {
      if (!s.measured) return '<span class="muted">-</span>';
      if (s.giftDone) return '<span class="badge b-ok">증정 완료</span>';
      const on = !!store.giftSent[s.school];
      return `<select class="gift-sel ${on ? 'ok' : 'warn'}" data-act="giftSel" data-id="${esc(s.id)}" title="눌러서 상태 변경">
          <option value="0" ${on ? '' : 'selected'}>미완료</option><option value="1" ${on ? 'selected' : ''}>증정 완료</option></select>
        ${!on && s.giftItems ? `<div class="muted" style="font-size:11.5px;max-width:240px;overflow:hidden;text-overflow:ellipsis;margin-top:3px">${esc(cleanItems(s.giftItems).join(', '))}</div>` : ''}`;
    };

    return `
      <div class="grid g4">
        ${kpi('전체 일정', ss.length, '개교', sourceLine(), null)}
        ${kpi('측정 완료', done, `/${ss.length}`, `총 ${REC().players.length}명 측정`, pct(done, ss.length))}
        ${kpi('예정', ss.filter(F['예정']).length, '건', ss.filter(F['예정']).map(s => `${s.school} ${fmt(s.date)}`).slice(0, 2).join(' · ') || '없음', null)}
        ${kpi('물품 증정 미완료', ss.filter(F['물품 증정 미완료']).length, '개교', `증정 완료 ${ss.filter(s => s.measured && (s.giftDone || store.giftSent[s.school])).length}개교`, null)}
      </div>
      <div class="panel">
        <div class="panel-h">
          <div class="toolbar">${Object.keys(F).map(f => `<button class="chip ${ui.oFilter === f ? 'on' : ''}" data-act="oFilter" data-v="${f}">${f} ${ss.filter(F[f]).length}</button>`).join('')}</div>
        </div>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>일정</th><th>학교</th><th>상태</th><th>측정 인원</th><th>물품 증정</th><th>담당 지도자</th><th>후속 업무</th></tr></thead>
          <tbody>${list.map(s => {
            const ts = tasks.filter(t => t.school.id === s.id);
            const d = diff(s.date);
            return `<tr class="click" data-act="school" data-id="${esc(s.id)}">
              <td>${fmt(s.date)} ${esc(s.time)} ${!s.measured && d >= 0 ? `<span class="dday ${d <= 2 ? 'hot' : ''}" style="display:inline-block;margin-left:6px;padding:2px 6px;min-width:0">${dday(s.date)}</span>` : ''}</td>
              <td><b>${esc(s.school)}</b>${s.note && s.note !== '측정 완료' ? `<div class="muted" style="font-size:11.5px">${esc(s.note)}</div>` : ''}</td>
              <td><span class="badge ${statusTone[s.status]}">${esc(s.status)}</span></td>
              <td>${s.count ? `${s.count}명` : '<span class="muted">-</span>'}</td>
              <td>${giftCell(s)}</td>
              <td>${esc(s.contactName) || '<span class="muted">-</span>'}<div class="muted" style="font-size:11.5px">${esc(s.contactPhone)}</div></td>
              <td>${ts.length ? ts.map(t => `<span class="badge ${TASK[t.type].tone}" style="margin-right:4px">${TASK[t.type].label}</span>`).join('') : '<span class="muted">없음</span>'}</td>
            </tr>`;
          }).join('') || '<tr><td colspan="7" class="empty">해당 조건의 학교가 없습니다.</td></tr>'}</tbody>
        </table></div>
      </div>`;
  }

  /* SNS 업로드 일정 (엑셀 SNS SCHEDULE 시트) */
  function snsPanel() {
    const all = snsPosts();
    if (!all.length) return '';
    const F = {
      '업로드 전': x => !x.isDone,
      '이번 주': x => !x.isDone && diff(x.date) <= 7,
      '지연': x => x.late,
      '업로드 완료': x => x.isDone,
      '전체': () => true,
    };
    const list = all.filter(F[ui.sFilter] || F['전체']);
    const done = all.filter(x => x.isDone).length;
    const next = all.find(x => !x.isDone && diff(x.date) >= 0);
    const late = all.filter(F['지연']).length;
    const kindTone = { '기록': '', '영상': 'b-dark', '랭킹': 'b-warn', '소개': 'b-line' };
    return `
      <div class="panel" id="sns-panel" style="scroll-margin-top:20px">
        <div class="panel-h" style="flex-wrap:wrap;gap:10px">
          <div><h3>${icon('spark', 'icon-sm')} SNS 업로드 일정</h3>
            <div class="muted" style="font-size:12.5px;margin-top:4px">업로드 완료 ${done}/${all.length}건${next ? ` · 다음 ${fmt(next.date)} ${esc(next.title)} (${dday(next.date)})` : ''}${late ? ` · <b style="color:var(--danger)">지연 ${late}건</b>` : ''}</div></div>
          <div class="toolbar">${Object.keys(F).map(f => `<button class="chip ${ui.sFilter === f ? 'on' : ''}" data-act="sFilter" data-v="${f}">${f} ${all.filter(F[f]).length}</button>`).join('')}</div>
        </div>
        <div class="bar" style="margin:0 0 14px"><i style="width:${pct(done, all.length)}%"></i></div>
        <div class="tbl-wrap"><table class="tbl" style="min-width:640px">
          <thead><tr><th>업로드일</th><th>콘텐츠</th><th>유형</th><th>상태</th></tr></thead>
          <tbody>${list.map(x => {
            const d = diff(x.date);
            return `<tr ${x.sch ? `class="click" data-act="school" data-id="${esc(x.school)}"` : ''}>
              <td>${fmt(x.date)}${!x.isDone ? ` <span class="dday ${x.late || d <= 1 ? 'hot' : ''}" style="display:inline-block;margin-left:6px;padding:2px 6px;min-width:0">${x.late ? '지연' : dday(x.date)}</span>` : ''}</td>
              <td><b>${esc(x.school || '전체')}</b> <span class="muted">· ${esc(x.post)}</span></td>
              <td><span class="badge ${kindTone[x.kind] || ''}">${esc(x.kind)}</span></td>
              <td>${x.done ? '<span class="badge b-ok" title="엑셀 기준">업로드 완료</span>'
                : `<select class="gift-sel ${x.isDone ? 'ok' : 'warn'}" data-act="snsSel" data-key="${esc(x.key)}"><option value="0" ${x.isDone ? '' : 'selected'}>업로드 전</option><option value="1" ${x.isDone ? 'selected' : ''}>업로드 완료</option></select>`}</td>
            </tr>`;
          }).join('') || '<tr><td colspan="4" class="empty">해당 조건의 게시물이 없습니다.</td></tr>'}</tbody>
        </table></div>
        <p class="muted" style="font-size:12px;margin-top:10px">엑셀 'SNS SCHEDULE' 시트 기준으로 자동 반영됩니다. 비고에 "업로드 완료"를 입력하면 모든 기기에 반영되고, 여기서 바꾼 상태는 이 브라우저에만 저장됩니다.</p>
      </div>`;
  }

  function vKakao() {
    const tasks = detectTasks();
    if (!ui.kSel || !tasks.some(t => t.key === ui.kSel)) ui.kSel = tasks[0]?.key || null;
    const t = tasks.find(x => x.key === ui.kSel);
    const text = t ? (store.drafts[t.key] ?? draft(t.type, t.school)) : '';
    return `
      <div class="k-wrap">
        <div>
          <div class="panel-h" style="margin:0 2px 10px"><h3>${icon('spark', 'icon-sm')} AI가 감지한 커뮤니케이션 ${tasks.length}건</h3></div>
          ${tasks.length ? tasks.map(x => `
            <button class="k-item ${x.key === ui.kSel ? 'on' : ''}" data-act="kSel" data-key="${esc(x.key)}">
              <span class="badge ${TASK[x.type].tone}">${TASK[x.type].label}</span>
              <div class="t">${esc(x.school.school)} · ${esc(greetName(x.school))}</div>
              <div class="d">${esc(x.reason)}</div>
            </button>`).join('') : '<div class="panel empty">지금 발송이 필요한 메시지가 없습니다.</div>'}
        </div>
        ${t ? `
        <div class="panel">
          <div class="panel-h">
            <div><div class="eyebrow">제안 사유</div><h3 style="margin-top:4px">${esc(t.reason)}</h3></div>
            <span class="badge ${TASK[t.type].tone}">${TASK[t.type].label}</span>
          </div>
          <div class="kv" style="margin-bottom:16px">
            <div><small>학교</small>${esc(t.school.school)}</div>
            <div><small>일정</small>${fmt(t.school.date)} ${esc(t.school.time)}</div>
            <div><small>연락처</small>${esc(t.school.contactName) || '-'} ${esc(t.school.contactPhone)}</div>
          </div>
          <div class="grid g2">
            <div class="field"><label>메시지 초안 (수정 가능)</label>
              <textarea class="input" id="kText" data-key="${esc(t.key)}" style="min-height:330px">${esc(text)}</textarea>
            </div>
            <div class="field"><label>카카오톡 미리보기</label>
              <div class="phone">
                <div class="phone-h"><div class="avatar">${esc((t.school.contactName || t.school.school).slice(0, 1))}</div><b>${esc(greetName(t.school))}</b></div>
                <div class="bubble" id="kPreview">${esc(text)}</div>
                <div class="bubble-time">발송 전 미리보기</div>
              </div>
            </div>
          </div>
          <div class="modal-f" style="justify-content:space-between;flex-wrap:wrap">
            <button class="btn btn-ghost btn-sm" data-act="kReset" data-key="${esc(t.key)}">초안 다시 생성</button>
            <div class="toolbar">
              <button class="btn btn-ghost" data-act="kCopy">${icon('copy', 'icon-sm')} 복사</button>
              <button class="btn" data-act="kSent" data-key="${esc(t.key)}">${icon('check', 'icon-sm')} 발송 완료 처리</button>
            </div>
          </div>
          <p class="muted" style="font-size:12px;margin-top:10px">메시지를 복사해 카카오톡에서 직접 발송한 뒤 '발송 완료 처리'를 누르면 학교 진행 이력에 기록됩니다.</p>
        </div>` : '<div class="panel empty">왼쪽에서 메시지를 선택하세요.</div>'}
      </div>

      <div class="panel">
        <div class="panel-h"><h3>발송 이력</h3><span class="muted" style="font-size:12.5px">${store.history.length}건</span></div>
        ${store.history.length ? `<div class="tbl-wrap"><table class="tbl" style="min-width:600px">
          <thead><tr><th>발송일</th><th>학교</th><th>유형</th><th>내용</th></tr></thead>
          <tbody>${store.history.slice(0, 30).map((h, i) => `<tr class="click" data-act="histView" data-i="${i}">
            <td>${fmtFull(h.date)}</td><td>${esc(h.school)}</td><td><span class="badge">${TASK[h.type]?.label || esc(h.type)}</span></td>
            <td class="muted" style="max-width:420px;overflow:hidden;text-overflow:ellipsis">${esc(h.text.split('\n').slice(3).join(' ').slice(0, 70))}…</td></tr>`).join('')}</tbody>
        </table></div>` : '<div class="empty">아직 발송 완료 처리된 메시지가 없습니다.</div>'}
      </div>`;
  }

  /* ───────── Router ───────── */
  const ROUTES = {
    dashboard: { label: 'Dashboard', sub: 'BASEBALL COMBINE · 오늘의 현황', icon: 'home', view: vDashboard },
    research:  { idx: '01', label: 'Research', title: 'Research Dashboard', sub: '실제 사례 조사 및 축적 · 매시간 업데이트', icon: 'research', view: vResearch },
    proposal:  { idx: '02', label: 'Proposal', title: 'Proposal', sub: 'MARKETING · SNS 제안 · 매시간 자동 생성', icon: 'proposal', view: vProposal },
    operation: { idx: '03', label: 'Operation', title: 'Operation Manager', sub: '측정 일정 · SNS 업로드 일정 관리', icon: 'operation', view: vOperation },
    kakao:     { idx: '04', label: 'KakaoTalk', title: 'KakaoTalk Assistant', sub: '상황별 메시지 초안 및 발송 관리', icon: 'kakao', view: vKakao },
  };
  const route = () => { const r = location.hash.replace(/^#\/?/, '').split('?')[0]; return ROUTES[r] ? r : 'dashboard'; };

  function render() {
    const r = route(), R = ROUTES[r];
    const n = detectTasks().length;
    $('#nav').innerHTML = Object.entries(ROUTES).map(([k, v], i) => `
      ${i === 1 ? '<div class="nav-sec">MODULES</div>' : ''}
      <a class="nav-link ${k === r ? 'on' : ''}" href="#/${k}">
        ${v.idx ? `<span class="idx">${v.idx}</span>` : ''}${icon(v.icon)}${v.label}
        ${k === 'kakao' && n ? `<span class="num">${n}</span>` : ''}
      </a>`).join('');
    $('#crumb').textContent = R.sub;
    $('#title').textContent = R.title || 'Dashboard';
    $('#view').innerHTML = R.view();
    document.title = `${R.title || 'Dashboard'} · BASEBALL COMBINE`;
  }

  /* ───────── 자동 갱신: records.js / research.js 를 30초마다 다시 읽음 ───────── */
  let pendingRender = false;
  const busy = () => $('#modal-root').innerHTML !== '' || ['TEXTAREA', 'INPUT', 'SELECT'].includes(document.activeElement?.tagName);
  function refreshData() {
    const files = [
      ['records.js', () => REC().version, '엑셀 기록이 업데이트되어 대시보드에 반영했습니다.'],
      ['research.js', () => RES().updatedAt, '새 리서치 자료가 추가되었습니다.'],
      ['proposals.js', () => PRO().updatedAt, '새 MARKETING · SNS 제안이 추가되었습니다.'],
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

  /* ───────── Modal / Toast ───────── */
  function modal(html, wide = false) {
    $('#modal-root').innerHTML = `<div class="modal-ov" data-act="ovClose"><div class="modal ${wide ? 'wide' : ''}">${html}</div></div>`;
  }
  const closeModal = () => { $('#modal-root').innerHTML = ''; if (pendingRender) { pendingRender = false; render(); } };
  const mHead = (eyebrow, title) => `<div class="modal-h"><div><div class="eyebrow">${eyebrow}</div><h3>${title}</h3></div><button class="x" data-act="close">${icon('close')}</button></div>`;
  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400); }
  const val = id => ($('#' + id)?.value ?? '').trim();

  /* 학교 상세 */
  function openSchool(id) {
    const s = school(id);
    if (!s) return;
    const all55 = ranking('m55');
    const rows = ranking('m55', s.players);
    const noRun = s.players.filter(p => p.m55 == null);
    const nat = p => all55.find(x => x.name === p.name && x.school === p.school)?.rank;
    modal(`
      ${mHead(`${fmt(s.date)} ${esc(s.time)} · ${esc(s.status)}`, esc(s.school))}
      <div class="kv">
        <div><small>담당 지도자</small>${esc(s.contactName) || '-'}<br><span class="muted">${esc(s.contactPhone)}</span></div>
        <div><small>측정 인원</small>${s.count}명${s.note ? `<br><span class="muted">${esc(s.note)}</span>` : ''}</div>
        <div><small>물품 증정</small>${s.giftDone ? '증정 완료' : s.giftItems ? esc(cleanItems(s.giftItems).join(', ')) : '-'}</div>
      </div>
      ${s.measured && !s.giftDone ? `<div class="toolbar" style="margin-top:10px"><span class="muted" style="font-size:12.5px">물품 증정 상태${store.giftSent[s.school] ? ` · ${fmt(store.giftSent[s.school])} 처리` : ' · 증정 완료로 바꾸면 물품 발송 안내 업무가 자동으로 정리됩니다.'}</span><span class="sp"></span>
        <select class="gift-sel ${store.giftSent[s.school] ? 'ok' : 'warn'}" data-act="giftSel" data-id="${esc(s.id)}"><option value="0" ${store.giftSent[s.school] ? '' : 'selected'}>미완료</option><option value="1" ${store.giftSent[s.school] ? 'selected' : ''}>증정 완료</option></select></div>` : ''}
      ${s.count ? `
      <div class="sec" style="margin-top:16px"><b>선수 기록 (55m 순)</b>
        <div class="tbl-wrap"><table class="tbl" style="min-width:640px">
          <thead><tr><th>순위</th><th>이름</th><th>학년</th><th>포지션</th>${METRICS.map(m => `<th style="text-align:right">${m.label}</th>`).join('')}<th style="text-align:right">55m 전체순위</th></tr></thead>
          <tbody>${[...rows, ...noRun].map(p => `<tr>
            <td>${p.rank ?? '-'}</td><td><b>${esc(p.name)}</b></td><td>${p.grade ?? '-'}</td><td>${esc(p.pos)}</td>
            ${METRICS.map(m => `<td style="text-align:right">${fmtVal(m, p[m.k])}</td>`).join('')}
            <td style="text-align:right" class="muted">${nat(p) ? nat(p) + '위' : '-'}</td></tr>`).join('')}</tbody>
        </table></div>
      </div>` : ''}
      ${(() => { const ps = snsPosts().filter(x => x.school === s.school); return ps.length ? `
      <div class="sec"><b>SNS 업로드</b>
        <div class="rows">${ps.map(x => `<div class="row"><span class="muted" style="min-width:74px;font-size:12.5px">${fmt(x.date)}</span><div class="grow">${esc(x.post)}</div>
          ${x.done ? '<span class="badge b-ok">업로드 완료</span>' : `<select class="gift-sel ${x.isDone ? 'ok' : 'warn'}" data-act="snsSel" data-key="${esc(x.key)}"><option value="0" ${x.isDone ? '' : 'selected'}>업로드 전</option><option value="1" ${x.isDone ? 'selected' : ''}>업로드 완료</option></select>`}</div>`).join('')}</div>
      </div>` : ''; })()}
      <div class="sec"><b>진행 메모</b>
        <ul class="log">${[...s.memos].reverse().map(l => `<li><time>${fmt(l.date)}</time><span>${esc(l.text)}</span></li>`).join('') || '<li class="muted">메모가 없습니다.</li>'}</ul>
        <div class="toolbar" style="margin-top:10px"><input class="input" id="f_memo" placeholder="통화·후속 업무 메모 기록" style="flex:1"><button class="btn btn-ghost" data-act="addMemo" data-id="${esc(s.id)}">기록</button></div>
      </div>
      <div class="modal-f"><button class="btn" data-act="close">닫기</button></div>`, true);
  }

  /* 리서치 직접 추가 */
  function openResearchForm() {
    modal(`
      ${mHead('Research', '조사 자료 직접 추가')}
      <div class="form">
        <div class="field"><label>조사 분야</label><select class="input" id="r_cat">${CATS.map(c => `<option>${c}</option>`).join('')}</select></div>
        <div class="field"><label>우선순위</label><select class="input" id="r_prio"><option>높음</option><option selected>중간</option><option>낮음</option></select></div>
        <div class="field full"><label>제목</label><input class="input" id="r_title"></div>
        <div class="field"><label>출처</label><input class="input" id="r_src" placeholder="매체·기관명"></div>
        <div class="field"><label>원문 링크</label><input class="input" id="r_url" placeholder="https://"></div>
        <div class="field full"><label>요약</label><textarea class="input" id="r_sum"></textarea></div>
        <div class="field full"><label>핵심 인사이트</label><textarea class="input" id="r_ins" style="min-height:60px"></textarea></div>
        <div class="field full"><label>BASEBALL COMBINE 적용 방안</label><textarea class="input" id="r_apply" style="min-height:60px"></textarea></div>
      </div>
      <div class="modal-f"><button class="btn btn-ghost" data-act="close">취소</button><button class="btn" data-act="saveResearch">저장</button></div>`);
  }

  /* 기획안 편집 */
  function openProposalForm(id) {
    const p = id ? allProposals().find(x => x.id === id) : { title: '', priority: '중간', background: '', goal: '', target: '', strategy: '', actions: [], budget: [], effect: '', kpis: [] };
    modal(`
      ${mHead('Marketing Proposal', id ? '기획안 편집' : '새 기획안')}
      <div class="form">
        <div class="field full"><label>기획안 제목</label><input class="input" id="p_title" value="${esc(p.title)}"></div>
        <div class="field"><label>마케팅 목표</label><input class="input" id="p_goal" value="${esc(p.goal)}"></div>
        <div class="field"><label>타깃</label><input class="input" id="p_target" value="${esc(p.target)}"></div>
        <div class="field"><label>우선순위</label><select class="input" id="p_prio">${['높음', '중간', '낮음'].map(o => `<option ${o === p.priority ? 'selected' : ''}>${o}</option>`).join('')}</select></div>
        <div class="field"></div>
        <div class="field full"><label>배경 및 목적</label><textarea class="input" id="p_bg" style="min-height:60px">${esc(p.background)}</textarea></div>
        <div class="field full"><label>핵심 전략</label><textarea class="input" id="p_strat" style="min-height:60px">${esc(p.strategy)}</textarea></div>
        <div class="field full"><label>세부 실행 방안 (한 줄에 하나)</label><textarea class="input" id="p_actions">${esc((p.actions || []).join('\n'))}</textarea></div>
        <div class="field"><label>예상 비용 (항목 | 금액)</label><textarea class="input" id="p_budget">${esc((p.budget || []).map(b => `${b.item} | ${b.cost}`).join('\n'))}</textarea></div>
        <div class="field"><label>KPI (지표 | 목표)</label><textarea class="input" id="p_kpis">${esc((p.kpis || []).map(k => `${k.name} | ${k.target}`).join('\n'))}</textarea></div>
        <div class="field full"><label>기대 효과</label><textarea class="input" id="p_effect" style="min-height:60px">${esc(p.effect)}</textarea></div>
      </div>
      <div class="modal-f"><button class="btn btn-ghost" data-act="close">취소</button><button class="btn" data-act="saveProposal" data-id="${id || ''}">저장</button></div>`, true);
  }
  function saveProposal(id) {
    if (!val('p_title')) { toast('제목을 입력하세요.'); return; }
    const lines = s => s.split('\n').map(x => x.trim()).filter(Boolean);
    const pairs = (s, a, b) => lines(s).map(l => { const [x, ...y] = l.split('|'); return { [a]: x.trim(), [b]: y.join('|').trim() }; });
    const data = {
      title: val('p_title'), goal: val('p_goal'), target: val('p_target'), priority: val('p_prio'),
      background: val('p_bg'), strategy: val('p_strat'), actions: lines(val('p_actions')),
      budget: pairs(val('p_budget'), 'item', 'cost'), kpis: pairs(val('p_kpis'), 'name', 'target'), effect: val('p_effect'),
    };
    if (id) patchProposal(id, data);
    else { const nid = uid('np'); store.newProposals.push({ id: nid, type: 'marketing', status: '검토', research: [], created: new Date().toISOString(), updated: TODAY_ISO, ...data }); save(); ui.pSel = nid; ui.pFilter = '전체'; }
    closeModal(); render(); toast('기획안이 저장되었습니다.');
  }

  /* PPT 미리보기 */
  function slidesHtml(p) {
    const rmap = Object.fromEntries(research().map(r => [r.id, r]));
    const rs = (p.research || []).map(id => rmap[id]).filter(Boolean);
    const ul = arr => arr.length ? `<ul>${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<span>-</span>';
    const S = [
      ['cover', '', esc(p.title), `<span>SPYDER Korea · BASEBALL COMBINE 마케팅 기획안</span><span>${fmtFull(TODAY_ISO)}</span>`],
      ['', '01', '프로젝트 배경 및 목적', `<p>${esc(p.background)}</p><p><b>목표</b> ${esc(p.goal)}</p><p><b>타깃</b> ${esc(p.target)}</p>`],
      ['', '02', '시장 및 경쟁사 분석', rs.length ? ul(rs.map(r => `[${r.source}] ${r.summary}`)) : '<span>연결된 조사 자료 없음</span>'],
      ['', '03', '마케팅 인사이트', rs.length ? ul(rs.map(r => r.insight)) : '<span>-</span>'],
      ['', '04', '핵심 전략 및 아이디어', `<p>${esc(p.strategy)}</p>`],
      ['', '05', '세부 실행 방안', ul(p.actions || [])],
      ['', '06', '예상 비용 및 기대 효과', `<table class="tbl-s">${(p.budget || []).map(b => `<tr><td>${esc(b.item)}</td><td>${esc(b.cost)}</td></tr>`).join('')}</table><p style="margin-top:1.5cqw"><b>기대 효과</b> ${esc(p.effect)}</p>`],
      ['', '07', '성과 측정 지표 (KPI)', `<table class="tbl-s">${(p.kpis || []).map(k => `<tr><td>${esc(k.name)}</td><td>${esc(k.target)}</td></tr>`).join('')}</table>`],
    ];
    return S.map(([c, n, t, b]) => `<div class="slide ${c}">${n
      ? `<div class="sn"><span>${n}</span><img class="slide-logo" src="${LOGO}" alt="SPYDER"></div>`
      : `<div class="sn" style="color:rgba(255,255,255,.5)"><img class="slide-logo" src="${LOGO}" alt="SPYDER"><span>MARKETING PROPOSAL</span></div>`}<h5>${t}</h5><div class="body">${b}</div></div>`).join('');
  }
  function openSnsPreview(id) {
    const p = allProposals().find(x => x.id === id);
    const vertical = /릴스|쇼츠|스토리|틱톡/.test(`${p.format} ${p.channel}`);
    const slides = p.slides || [];
    modal(`${mHead(`${esc(p.channel)} · ${esc(p.format)} 시안`, esc(p.title))}
      <div class="ig-grid ${vertical ? 'vertical' : ''}">
        ${slides.map((s, i) => `
          <div class="ig-card ${i === 0 ? 'cover' : ''}">
            <div class="ig-top"><img src="${LOGO}" alt="SPYDER"><span>${i + 1}/${slides.length}</span></div>
            <div class="ig-head">${esc(s.heading)}</div>
            <div class="ig-body">${esc(s.body)}</div>
            <div class="ig-foot">BASEBALL COMBINE</div>
          </div>`).join('')}
      </div>
      <div class="sec" style="margin-top:18px"><b>캡션</b><div class="caption-box">${esc(p.caption)}<div class="tags">${(p.hashtags || []).map(h => esc(h)).join(' ')}</div></div></div>
      <div class="sec"><b>디자인 방향</b><p style="font-size:13px">${esc([p.design?.concept, p.design?.color, p.design?.typography].filter(Boolean).join(' · '))}</p></div>
      <div class="modal-f"><span class="muted" style="font-size:12px;margin-right:auto;align-self:center">문구 배치 확인용 와이어프레임입니다. 최종 디자인은 위 디자인 방향을 참고해 제작하세요.</span>
      <button class="btn btn-ghost" data-act="copyCaption" data-id="${p.id}">${icon('copy', 'icon-sm')} 캡션 복사</button><button class="btn" data-act="close">닫기</button></div>`, true);
  }

  function openPPT(id) {
    const p = allProposals().find(x => x.id === id);
    modal(`${mHead('PPT 기획안 · 8 slides', esc(p.title))}
      <div class="slides">${slidesHtml(p)}</div>
      <div class="modal-f"><span class="muted" style="font-size:12px;margin-right:auto;align-self:center">인쇄 대화상자에서 'PDF로 저장'을 선택하면 가로형 기획안 PDF로 저장됩니다.</span>
      <button class="btn btn-ghost" data-act="close">닫기</button><button class="btn" data-act="print" data-id="${id}">${icon('print', 'icon-sm')} PDF 저장 / 인쇄</button></div>`, true);
  }

  /* 설정 */
  function openSettings() {
    modal(`${mHead('Settings', '설정')}
      <div class="form">
        <div class="field full"><label>담당자 이름 (메시지 서명에 사용)</label><input class="input" id="st_manager" value="${esc(store.settings.manager)}"></div>
      </div>
      <div class="sec" style="margin-top:18px"><b>데이터 연동 상태</b>
        <p style="font-size:13px">엑셀: ${esc(REC().source || '없음')}<br><span class="muted">마지막 동기화 ${fmtTime(REC().syncedAt)} · 리서치 업데이트 ${fmtTime(RES().updatedAt)}</span></p>
      </div>
      <div class="sec"><b>데이터 관리</b>
        <p class="muted" style="font-size:13px;margin-bottom:10px">메모·발송 이력·기획안 수정 내용은 이 브라우저에 저장됩니다.</p>
        <div class="toolbar"><button class="btn btn-ghost" data-act="export">내 입력 데이터 내보내기 (JSON)</button><button class="btn btn-ghost" data-act="reset" style="color:var(--danger)">내 입력 데이터 초기화</button></div>
      </div>
      <div class="modal-f"><button class="btn btn-ghost" data-act="close">닫기</button><button class="btn" data-act="saveSettings">저장</button></div>`);
  }

  /* ───────── Events ───────── */
  const ACT = {
    close: closeModal,
    ovClose: (el, e) => { if (e.target === el) closeModal(); },
    settings: openSettings,
    saveSettings: () => { store.settings.manager = val('st_manager') || '담당자'; store.drafts = {}; save(); closeModal(); render(); toast('설정이 저장되었습니다.'); },
    export: () => {
      const blob = new Blob([JSON.stringify({ exported: TODAY_ISO, ...store }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `combine-backup-${TODAY_ISO}.json`; a.click();
    },
    reset: () => { if (confirm('메모, 발송 이력, 기획안 수정 등 이 브라우저에 저장된 입력 내용이 초기화됩니다. 계속할까요?')) { store = structuredClone(DEFAULT); save(); closeModal(); render(); toast('초기화되었습니다.'); } },

    goTask: el => { ui.kSel = el.dataset.key; location.hash = '#/kakao'; },
    rankK: el => { ui.rankK = el.dataset.v; render(); },

    rCat: el => { ui.rCat = el.dataset.v; render(); },
    addResearch: openResearchForm,
    saveResearch: () => {
      if (!val('r_title')) { toast('제목을 입력하세요.'); return; }
      const url = val('r_url');
      store.research.push({ id: uid('rm'), category: val('r_cat'), priority: val('r_prio'), date: TODAY_ISO, title: val('r_title'), source: val('r_src'),
        url: /^https?:\/\//.test(url) ? url : '', summary: val('r_sum'), insight: val('r_ins'), apply: val('r_apply') });
      save(); closeModal(); render(); toast('조사 자료가 추가되었습니다.');
    },
    toProposal: el => {
      const r = research().find(x => x.id === el.dataset.id);
      const nid = uid('np');
      ui.pTab = 'marketing';
      store.newProposals.push({ id: nid, type: 'marketing', title: `${r.title} – 컴바인 적용안`, status: '검토', priority: r.priority, created: new Date().toISOString(), updated: TODAY_ISO,
        background: r.summary, goal: '', target: '', strategy: r.apply, actions: [], budget: [], effect: '', kpis: [], research: [r.id] });
      save(); ui.pSel = nid; ui.pFilter = '전체'; location.hash = '#/proposal'; toast('기획안 초안이 생성되었습니다. 편집으로 내용을 채워주세요.');
    },

    pFilter: el => { ui.pFilter = el.dataset.v; ui.pSel = null; ui.pLimit = 50; render(); },
    pSel: el => { ui.pSel = el.dataset.id; render(); },
    pTab: el => { ui.pTab = el.dataset.v; ui.pSel = null; ui.pFilter = '전체'; ui.pLimit = 50; render(); },
    pMore: () => { ui.pLimit += 50; render(); },
    goProposal: el => { ui.pTab = el.dataset.type; ui.pFilter = '전체'; ui.pSel = el.dataset.id; location.hash = '#/proposal'; render(); },
    copyCaption: async el => {
      const p = allProposals().find(x => x.id === el.dataset.id);
      const text = `${p.caption}\n\n${(p.hashtags || []).join(' ')}`;
      try { await navigator.clipboard.writeText(text); toast('캡션과 해시태그를 복사했습니다.'); } catch (e) { toast('복사에 실패했습니다.'); }
    },
    snsPreview: el => openSnsPreview(el.dataset.id),
    newProposal: () => openProposalForm(null),
    editProposal: el => openProposalForm(el.dataset.id),
    saveProposal: el => saveProposal(el.dataset.id),
    ppt: el => openPPT(el.dataset.id),
    print: el => {
      const p = allProposals().find(x => x.id === el.dataset.id);
      $('#print-root').innerHTML = slidesHtml(p);
      document.body.classList.add('printing');
      window.print();
      document.body.classList.remove('printing');
    },

    oFilter: el => { ui.oFilter = el.dataset.v; render(); },
    sFilter: el => { ui.sFilter = el.dataset.v; render(); },
    opTab: el => { location.hash = `#/operation?tab=${el.dataset.v}`; },
    school: el => openSchool(el.dataset.id),
    addMemo: el => { const t = val('f_memo'); if (!t) return; addMemo(el.dataset.id, t); openSchool(el.dataset.id); toast('메모가 기록되었습니다.'); },

    kSel: el => { ui.kSel = el.dataset.key; render(); },
    kCopy: async () => {
      const text = $('#kText').value;
      try { await navigator.clipboard.writeText(text); }
      catch (e) { $('#kText').select(); document.execCommand('copy'); }
      toast('메시지가 복사되었습니다. 카카오톡에 붙여넣기 하세요.');
    },
    kReset: el => { delete store.drafts[el.dataset.key]; save(); render(); },
    kSent: el => {
      const t = detectTasks().find(x => x.key === el.dataset.key);
      if (!t) return;
      markSent(t, $('#kText').value);
      ui.kSel = null; render(); toast(`${t.school.school} · ${TASK[t.type].label} 발송 완료로 기록했습니다.`);
    },
    histView: el => {
      const h = store.history[+el.dataset.i];
      modal(`${mHead(`${fmtFull(h.date)} · ${esc(TASK[h.type]?.label || '')}`, esc(h.school))}<div class="phone"><div class="bubble">${esc(h.text)}</div></div>
        <div class="modal-f"><button class="btn" data-act="close">닫기</button></div>`);
    },
  };

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'SELECT') return;
    const fn = ACT[el.dataset.act];
    if (fn) fn(el, e);
  });
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset.act === 'giftSel') { el.blur(); setGift(el.dataset.id, el.value === '1'); return; }
    if (el.dataset.act === 'snsSel') { el.blur(); setSns(el.dataset.key, el.value === '1'); return; }
    if (el.dataset.act === 'pStatus') { patchProposal(el.dataset.id, { status: el.value }); render(); toast(`상태가 '${el.value}'(으)로 변경되었습니다.`); }
  });
  document.addEventListener('input', e => {
    if (e.target.id === 'rq') {
      ui.rQuery = e.target.value;
      const pos = e.target.selectionStart;
      render();
      const inp = $('#rq'); inp.focus(); inp.setSelectionRange(pos, pos);
    }
    if (e.target.id === 'kText') {
      store.drafts[e.target.dataset.key] = e.target.value; save();
      $('#kPreview').textContent = e.target.value;
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
