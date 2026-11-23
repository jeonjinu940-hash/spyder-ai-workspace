/*
  CSR 기획안 자동 생성 (매시간, CSR 리서치 직후 실행)
  - 최신 CSR 사례 + 인천유나이티드 2026 활동 현황을 바탕으로
    "CSR을 통한 구단 매출 증대" 기획안 3건 이상을 생성해 csr/proposals.js 에 추가
  수동 실행: node tools/csr-proposal-agent.js
*/
const path = require('path');
const { ROOT, logger, runClaude, readDataFile, extractJson, today } = require('./claude-runner');
const { incheon, PROPOSAL_SCHEMA, DECK_RULES, normalize, arr, readProposals, addProposals } = require('./csr-common');

const log = logger('csr-proposal');

function buildPrompt(data) {
  const research = readDataFile(path.join(ROOT, 'csr', 'research.js'), { items: [] }).items.slice(0, 20);
  const recent = data.items.slice(0, 60).map(p => `- ${p.title}`).join('\n');
  return `당신은 인천유나이티드(K리그1 시민구단, 홈구장 인천축구전용경기장) 마케팅팀의 CSR 기획 담당입니다. 오늘은 ${today()}입니다.

[업무 목적]
타 기관의 CSR 사례를 인천유나이티드에 접목하여, 궁극적으로 CSR을 통한 구단 매출 증대(관중·티켓, MD, 스폰서십, 멤버십)를 달성합니다.
사회적 가치와 매출이 함께 커지는 구조(예: 참여 → 관람 전환, CSR 파트너 → 스폰서 전환, 임팩트 지표 → 스폰서 판매)를 설계하세요.

[인천유나이티드 2026 CSR·마케팅 활동 현황 (id · 영역 · 활동 · 성과)]
${incheon()}

[최신 타 기관 CSR 사례 (id · 기관 · 제목 · 적용 방안)]
${research.map(r => `- ${r.id} · ${r.org} · ${r.title} · ${r.apply}`).join('\n') || '- 없음'}

[최근 이미 제안한 항목 — 중복 금지, 다른 각도로]
${recent || '- 없음'}

[요청]
1) CSR 기획안 3~4건을 제안하세요. 각 기획안은 위 사례 중 최소 1건을 근거로 하고, 가능하면 기존 인천 활동(id)을 발전·연결하세요.
2) 매출 연결 구조(revenueModel)를 반드시 구체적으로: 누가 → 어떤 경험 → 어떤 구매(티켓·MD·스폰서·멤버십)로 이어지는지.
3) 모든 문구는 한국어. 실행 주체·협력 기관·시점이 드러나게.
4) 수치 목표는 근거가 약하면 "설정 필요"로 두세요. 사실이 아닌 내용을 사실처럼 쓰지 마세요.
5) 사례 id(c-...)와 활동 id(a..)는 "research"·"linked" 배열에만 넣고, 본문 텍스트에는 쓰지 마세요. 근거를 언급할 때는 기관명·사례명으로 쓰세요.
6) 각 기획안에 PPT 원고 "deck" 을 함께 작성하세요. (cover.title 은 기획안 제목을 22자 이내로 압축)

${DECK_RULES}

[출력 형식] 설명 없이 JSON 배열 하나만 출력:
[${PROPOSAL_SCHEMA}]`;
}

(async () => {
  const data = readProposals();
  log(`제안 생성 시작 (기존 ${data.items.length}건)`);
  let text;
  try { text = await runClaude(buildPrompt(data), [], 15); }
  catch (e) { log('실패: ' + e.message); process.exit(1); }
  const out = extractJson(text, '[', ']');
  if (!out) { log('실패: JSON 파싱 불가'); process.exit(1); }

  const now = new Date().toISOString(), date = today(), stamp = Date.now().toString(36);
  const titles = new Set(readProposals().items.map(p => p.title));
  const added = arr(out).filter(p => p && p.title && !titles.has(p.title))
    .map((p, i) => normalize(p, { id: `cp-${stamp}${i}`, status: '신규 제안', created: now, updated: date, ai: true }));
  const total = addProposals(added);
  log(`완료: ${added.length}건 추가 (총 ${total}건)`);
})();
