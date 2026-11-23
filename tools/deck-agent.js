/*
  PPT 원고(deck) 보충 — 원고가 없는 기존 기획안에 제안서 템플릿 v2.1 원고를 작성 (매시간, 업무별 최신순 BATCH 건)
  - BASEBALL COMBINE: combine/proposals.js 의 marketing
  - CSR: csr/proposals.js
  쓰기 직전 다시 읽어 deck 만 추가 (다른 에이전트가 쓴 내용 보존)
  수동 실행: node tools/deck-agent.js
*/
const path = require('path');
const { ROOT, logger, runClaude, readDataFile, writeDataFile, extractJson } = require('./claude-runner');
const { DECK_SCHEMA, DECK_RULES, cleanDeck } = require('./deck-spec');
const { readProposals, patchDecks } = require('./csr-common');

const log = logger('deck');
const BATCH = 4;
const STRIP = ['deck', 'status', 'created', 'updated', 'ai', 'type', 'origin', 'fromRequest', 'linked', 'priority'];

function prompt(label, items, research) {
  const rmap = Object.fromEntries(research.map(r => [r.id, r]));
  return `당신은 ${label} 기획안을 PPT 제안서로 옮기는 에디터입니다.
아래 기획안 ${items.length}건 각각에 대해 PPT 원고(deck)를 작성하세요. 새 내용을 지어내지 말고, 기획안과 근거 자료에 있는 내용만 칸 길이에 맞게 다시 쓰세요.

${items.map((p, i) => `### 기획안 ${i + 1} (id: ${p.id})
${JSON.stringify(Object.fromEntries(Object.entries(p).filter(([k]) => !STRIP.includes(k))))}
근거 자료: ${(p.research || []).map(id => rmap[id]).filter(Boolean).map(r => JSON.stringify({ source: r.source || r.org, title: r.title, summary: r.summary, result: r.result, insight: r.insight })).join(' / ') || '없음'}`).join('\n\n')}

${DECK_RULES}

[출력 형식] 설명 없이 JSON 객체 하나만 출력. 키는 기획안 id, 값은 deck 객체:
{ "<id>": { "cover": {...}, "background": {...}, "market": [...], "insight": {...}, "strategy": {...}, "execution": {...}, "schedule": {...}, "budget": {...}, "kpi": {...}, "closing": {...} } }

각 deck 객체의 상세 형식:
{ ${DECK_SCHEMA} }`;
}

async function fill(label, items, research, save) {
  if (!items.length) return;
  let text;
  try { text = await runClaude(prompt(label, items, research), [], 15); }
  catch (e) { log(`${label} 실패: ${e.message}`); return; }
  const out = extractJson(text) || {};
  const decks = {};
  for (const p of items) { const d = cleanDeck(out[p.id] && (out[p.id].deck || out[p.id])); if (d) decks[p.id] = d; }
  const n = save(decks);
  log(`${label}: ${Object.keys(decks).length}/${items.length}건 원고 작성, ${n}건 저장`);
}

(async () => {
  // BASEBALL COMBINE
  const CF = path.join(ROOT, 'combine', 'proposals.js');
  const cRes = readDataFile(path.join(ROOT, 'combine', 'research.js'), { items: [] }).items;
  const cTodo = readDataFile(CF, { marketing: [] }).marketing.filter(p => !p.deck).slice(0, BATCH);
  await fill('SPYDER 베이스볼 컴바인 마케팅', cTodo, cRes, decks => {
    const data = readDataFile(CF, null);
    if (!data) return 0;
    let n = 0;
    for (const p of data.marketing) if (decks[p.id] && !p.deck) { p.deck = decks[p.id]; n++; }
    if (n) writeDataFile(CF, 'COMBINE_PROPOSALS', data, 'AI 제안 — tools/proposal-agent.js 가 매시간 MARKETING·SNS 제안을 추가합니다.');
    return n;
  });

  // CSR
  const sRes = readDataFile(path.join(ROOT, 'csr', 'research.js'), { items: [] }).items;
  const sTodo = readProposals().items.filter(p => !p.deck).slice(0, BATCH);
  await fill('인천유나이티드 CSR', sTodo, sRes, patchDecks);
})();
