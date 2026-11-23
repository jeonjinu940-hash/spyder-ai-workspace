/*
  AI 리서치 자동 실행 (매시간 작업 스케줄러가 실행)
  1) Claude Code(헤드리스)에게 웹 검색으로 새 실제 사례를 찾게 함 (검색 도구만 허용)
  2) 결과(JSON)를 검증하고 url 기준 중복 제거 후 combine/research.js 에 추가
  수동 실행: node tools/research-agent.js
*/
const path = require('path');
const { ROOT, logger, runClaude, readDataFile, writeDataFile, extractJson, today } = require('./claude-runner');

const OUT = path.join(ROOT, 'combine', 'research.js');
const log = logger('research');
const CATS = ['스포츠 브랜드 마케팅', '야구 시장 동향', '프로모션 전략', 'SNS 마케팅', '경쟁사 분석', '상품 분석'];

function buildPrompt(existing) {
  const known = existing.items.slice(0, 150).map(i => `- ${i.url}`).join('\n');
  return `당신은 SPYDER Korea 스포츠마케팅팀의 리서치 담당입니다. 오늘은 ${today()}입니다.

[목표]
SPYDER가 운영하는 '베이스볼 컴바인'(고교 야구부를 방문해 5m·27m·55m 직선주루, 1루·2루 주루, 악력을 측정하고 랭킹을 공개하는 프로그램)을 통해
"SPYDER 브랜드의 야구 비전 확대"와 "야구 카테고리 매출 증대"에 적용할 수 있는 **실제 사례**를 웹 검색으로 찾으세요.

[조사 범위 예시] 국내외 스포츠 브랜드의 야구 마케팅, 아마추어·고교 야구 쇼케이스/컴바인 운영, 선수 데이터 기반 마케팅,
야구 용품·의류 시장 동향, 경쟁 브랜드(프로스펙스, 아디다스, 언더아머, 나이키, 미즈노, 데상트, 뉴발란스 등) 야구 전략,
야구 관련 SNS·숏폼 성공 사례, 팀 오더·단체 구매·쿠폰 프로모션, SPYDER 자사 야구 관련 보도.

[규칙]
1. 반드시 WebSearch(필요하면 WebFetch)로 확인한 실제 기사·보도자료·SNS 게시물만 사용하세요. URL을 추측하거나 만들지 마세요.
2. 아래 이미 수집된 URL은 제외하세요.
3. 가능하면 최근 1년 이내 자료를 우선하고, 새 사례 2~4건을 찾으세요. 적합한 새 자료가 없으면 빈 배열 []을 출력하세요.
4. 요약에는 원문에서 확인된 사실만 쓰고, 수치는 원문에 있을 때만 쓰세요.
5. apply(적용 방안)는 베이스볼 컴바인에 바로 실행할 수 있는 구체적인 액션으로 쓰세요.

[이미 수집된 URL]
${known}

[출력 형식]
설명 없이 JSON 배열 하나만 출력하세요. 각 항목:
{"category": "${CATS.join('" | "')}",
 "priority": "높음" | "중간" | "낮음",
 "title": "기사 핵심을 담은 한국어 제목",
 "source": "매체명",
 "url": "https://...",
 "published": "YYYY-MM-DD 또는 빈 문자열",
 "summary": "원문 요약 1~2문장",
 "insight": "핵심 인사이트 1문장",
 "apply": "베이스볼 컴바인 적용 방안 1~2문장"}`;
}

const normUrl = u => String(u || '').trim().replace(/\/+$/, '').replace(/^http:/, 'https:');

(async () => {
  const data = readDataFile(OUT, { updatedAt: '', items: [] });
  log(`리서치 시작 (기존 ${data.items.length}건)`);
  let text;
  try { text = await runClaude(buildPrompt(data), ['WebSearch', 'WebFetch']); }
  catch (e) { log('실패: ' + e.message); process.exit(1); }

  const seen = new Set(data.items.map(i => normUrl(i.url)));
  const iso = today(), ymd = iso.replace(/-/g, '');
  const added = [];
  for (const r of extractJson(text, '[', ']') || []) {
    const url = normUrl(r.url);
    if (!/^https:\/\/[^\s]+$/.test(url) || seen.has(url) || !r.title) continue;
    seen.add(url);
    added.push({
      id: `r-${ymd}-${Date.now().toString(36)}${added.length}`,
      category: CATS.includes(r.category) ? r.category : CATS[0],
      date: iso,
      published: /^\d{4}-\d{2}-\d{2}$/.test(r.published || '') ? r.published : '',
      priority: ['높음', '중간', '낮음'].includes(r.priority) ? r.priority : '중간',
      title: String(r.title).slice(0, 200), source: String(r.source || '').slice(0, 80), url,
      summary: String(r.summary || ''), insight: String(r.insight || ''), apply: String(r.apply || ''),
    });
  }
  data.items = [...added, ...data.items];
  data.updatedAt = new Date().toISOString();
  writeDataFile(OUT, 'COMBINE_RESEARCH', data, 'AI 리서치 자료 — tools/research-agent.js 가 매시간 새 사례를 추가합니다. (url 기준 중복 제거)');
  log(`완료: 신규 ${added.length}건 추가 (총 ${data.items.length}건)`);
})();
