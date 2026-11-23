/* CSR 에이전트 공통 — 인천 활동 컨텍스트, 기획안 정규화, proposals.js 안전 병합 */
const path = require('path');
const { ROOT, readDataFile, writeDataFile } = require('./claude-runner');
const { DECK_SCHEMA, DECK_RULES, cleanDeck } = require('./deck-spec');

const OUT = path.join(ROOT, 'csr', 'proposals.js');
const MAX = 1000;

function incheon() {
  const a = readDataFile(path.join(ROOT, 'csr', 'activities.js'), { items: [], diagnosis: { strengths: [], gaps: [] } });
  return [
    ...a.items.map(x => `- ${x.id} [${x.area}] ${x.name} (${x.period}): ${x.content} → ${x.result}`),
    '', '강점:', ...a.diagnosis.strengths.map(x => `- ${x}`),
    '', '매출 연결 공백:', ...a.diagnosis.gaps.map(x => `- ${x}`),
  ].join('\n');
}

const PROPOSAL_SCHEMA = `{
  "title": "기획안 제목", "priority": "높음|중간|낮음",
  "area": "나눔·기부|사회통합|유소년·교육|관람 접근성|지역상생|공익 캠페인|친환경|팬 경험·프로모션",
  "revenue": ["티켓·관중", "MD·상품", "스폰서·파트너십", "멤버십·팬덤", "브랜드 가치" 중 해당],
  "background": "배경 및 목적", "goal": "목표", "target": "타깃(수혜자·참여자)",
  "strategy": "핵심 전략", "partners": ["협력 기관·파트너 후보"],
  "actions": ["실행 방안", "..."],
  "revenueModel": "매출 연결 구조",
  "timeline": "실행 시점·기간",
  "budget": [{"item": "항목", "cost": "금액 또는 협의"}],
  "effect": "기대 효과(사회적 가치 + 매출)",
  "kpis": [{"name": "지표", "target": "목표"}],
  "research": ["근거 사례 id"], "linked": ["연계할 인천 활동 id"],
  ${DECK_SCHEMA.replace(/\n/g, '\n  ')}
}`;

const s = (v, n = 2000) => String(v ?? '').slice(0, n);
const arr = v => (Array.isArray(v) ? v : []);
const prio = v => (['높음', '중간', '낮음'].includes(v) ? v : '중간');

function normalize(p, extra) {
  return {
    ...extra,
    title: s(p.title, 200), priority: prio(p.priority), area: s(p.area, 40),
    revenue: arr(p.revenue).map(x => s(x, 30)),
    background: s(p.background), goal: s(p.goal), target: s(p.target), strategy: s(p.strategy),
    partners: arr(p.partners).map(x => s(x, 100)), actions: arr(p.actions).map(x => s(x, 500)),
    revenueModel: s(p.revenueModel), timeline: s(p.timeline, 300),
    budget: arr(p.budget).map(b => ({ item: s(b && b.item, 100), cost: s(b && b.cost, 100) })),
    effect: s(p.effect), kpis: arr(p.kpis).map(k => ({ name: s(k && k.name, 100), target: s(k && k.target, 100) })),
    research: arr(p.research).map(x => s(x, 60)), linked: arr(p.linked).map(x => s(x, 10)),
    deck: cleanDeck(p.deck),
  };
}

const readProposals = () => readDataFile(OUT, { updatedAt: '', items: [] });

/* AI 실행(수 분) 동안 다른 에이전트가 쓴 내용을 덮어쓰지 않도록, 쓰기 직전에 다시 읽어 병합 */
function addProposals(added) {
  const data = readProposals();
  data.items = [...added, ...data.items].slice(0, MAX);
  data.updatedAt = new Date().toISOString();
  writeDataFile(OUT, 'CSR_PROPOSALS', data, 'AI CSR 제안 — tools/csr-proposal-agent.js(매시간)·csr-develop-agent.js(사례 발전 요청)가 기획안을 추가합니다.');
  return data.items.length;
}

/* deck-agent: 기존 기획안에 PPT 원고만 추가 (쓰기 직전 다시 읽어 병합) */
function patchDecks(decks) {
  const data = readProposals();
  let n = 0;
  for (const p of data.items) if (decks[p.id] && !p.deck) { p.deck = decks[p.id]; n++; }
  if (n) writeDataFile(OUT, 'CSR_PROPOSALS', data, 'AI CSR 제안 — tools/csr-proposal-agent.js(매시간)·csr-develop-agent.js(사례 발전 요청)가 기획안을 추가합니다.');
  return n;
}

module.exports = { OUT, incheon, PROPOSAL_SCHEMA, DECK_RULES, normalize, arr, readProposals, addProposals, patchDecks };
