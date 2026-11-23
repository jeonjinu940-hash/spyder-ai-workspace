/*
  PPT 원고(deck) 보충·갱신 — 원고가 없거나 이전 버전(DECK_VERSION 미만)인 기획안에 제안서 템플릿 v2.1 원고를 작성
  매시간 업무별 최신순 BATCH 건. 같은 호출에서 기획안 본문 KPI("설정 필요")도 데이터 기반 예상 수치로 교체.
  - BASEBALL COMBINE: combine/proposals.js 의 marketing
  - CSR: csr/proposals.js
  쓰기 직전 다시 읽어 deck·kpis 만 바꿈 (다른 에이전트가 쓴 내용 보존)
  수동 실행: node tools/deck-agent.js
*/
const path = require('path');
const { ROOT, logger, runClaude, readDataFile, writeDataFile, extractJson } = require('./claude-runner');
const { DECK_VERSION, DECK_SCHEMA, DECK_RULES, cleanDeck, cleanKpis } = require('./deck-spec');
const { readProposals, patchDecks, incheon } = require('./csr-common');
const { recordsSummary } = require('./combine-data');

const log = logger('deck');
const BATCH = 4;
const STRIP = ['deck', 'status', 'created', 'updated', 'ai', 'type', 'origin', 'fromRequest', 'replaces', 'linked', 'priority'];
const needs = p => !p.deck || (p.deck.v || 1) < DECK_VERSION;
const vague = list => !list || !list.length || list.some(k => /설정 필요/.test(k.target || ''));

function prompt(label, context, items, research) {
  const rmap = Object.fromEntries(research.map(r => [r.id, r]));
  return `당신은 ${label} 기획안을 PPT 제안서로 옮기는 에디터 겸 성과 분석가입니다.
아래 기획안 ${items.length}건 각각에 대해 (1) PPT 원고(deck)와 (2) 데이터 기반 예상 KPI(kpis)를 작성하세요.
새 내용을 지어내지 말고 기획안·근거 자료·아래 데이터에 있는 내용만 쓰되, KPI 는 데이터를 근거로 예상 수치를 산출합니다.

[참고 데이터 — KPI 예상치 산출 근거]
${context}

${items.map((p, i) => `### 기획안 ${i + 1} (id: ${p.id})
${JSON.stringify(Object.fromEntries(Object.entries(p).filter(([k]) => !STRIP.includes(k))))}
근거 자료: ${(p.research || []).map(id => rmap[id]).filter(Boolean).map(r => JSON.stringify({ source: r.source || r.org, title: r.title, summary: r.summary, result: r.result, insight: r.insight })).join(' / ') || '없음'}`).join('\n\n')}

${DECK_RULES}

[출력 형식] 설명 없이 JSON 객체 하나만 출력. 키는 기획안 id:
{ "<id>": { "kpis": [{ "name": "지표명", "target": "예상 수치+단위 (산출 근거)" }], "deck": { "cover": {...}, "background": {...}, "market": [...], "insight": {...}, "strategy": {...}, "execution": {...}, "schedule": {...}, "budget": {...}, "kpi": {...}, "closing": {...} } } }
kpis 는 기획안의 기존 KPI 지표를 유지하면서 target 만 예상 수치로 바꾸세요(지표가 없으면 3~4개 새로).

deck 객체의 상세 형식:
{ ${DECK_SCHEMA} }`;
}

async function fill(label, context, items, research, save) {
  if (!items.length) return;
  let text;
  try { text = await runClaude(prompt(label, context, items, research), [], 15); }
  catch (e) { log(`${label} 실패: ${e.message}`); return; }
  const out = extractJson(text) || {};
  const res = {};
  for (const p of items) {
    const o = out[p.id] || {};
    const deck = cleanDeck(o.deck || (o.cover ? o : null)), kpis = cleanKpis(o.kpis);
    if (deck) res[p.id] = { deck, kpis: kpis.length ? kpis : null };
  }
  const n = save(res);
  log(`${label}: ${Object.keys(res).length}/${items.length}건 원고·KPI 작성, ${n}건 저장`);
}

/* 기획안 하나에 결과 적용: 원고 교체, KPI 는 "설정 필요"가 있을 때만 교체 */
const apply = (p, r) => {
  if (!r || !needs(p)) return false;
  p.deck = r.deck;
  if (r.kpis && vague(p.kpis)) p.kpis = r.kpis;
  return true;
};

(async () => {
  // BASEBALL COMBINE
  const CF = path.join(ROOT, 'combine', 'proposals.js');
  const cRes = readDataFile(path.join(ROOT, 'combine', 'research.js'), { items: [] }).items;
  const cTodo = readDataFile(CF, { marketing: [] }).marketing.filter(needs).slice(0, BATCH);
  await fill('SPYDER 베이스볼 컴바인 마케팅', recordsSummary(), cTodo, cRes, res => {
    const data = readDataFile(CF, null);
    if (!data) return 0;
    let n = 0;
    for (const p of data.marketing) if (apply(p, res[p.id])) n++;
    if (n) writeDataFile(CF, 'COMBINE_PROPOSALS', data, 'AI 제안 — tools/proposal-agent.js 가 매시간 MARKETING·SNS 제안을 추가합니다.');
    return n;
  });

  // CSR
  const sRes = readDataFile(path.join(ROOT, 'csr', 'research.js'), { items: [] }).items;
  const sTodo = readProposals().items.filter(needs).slice(0, BATCH);
  await fill('인천유나이티드 CSR', `[인천유나이티드 2026 활동 현황]\n${incheon()}`, sTodo, sRes, res => patchDecks(res, apply));
})();
