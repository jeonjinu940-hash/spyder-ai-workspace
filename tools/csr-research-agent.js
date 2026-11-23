/*
  CSR 사례 리서치 자동 실행 (매시간, run-research.vbs 가 실행)
  - 종목·국내외·구단·협회·비스포츠 분야 상관없이 실제 CSR 사례를 웹 검색으로 찾아
    인천유나이티드 적용 방안과 매출(관중·티켓·MD·스폰서) 연결 포인트를 붙여 csr/research.js 에 추가
  수동 실행: node tools/csr-research-agent.js
*/
const path = require('path');
const { ROOT, logger, runClaude, readDataFile, writeDataFile, extractJson, today } = require('./claude-runner');

const OUT = path.join(ROOT, 'csr', 'research.js');
const log = logger('csr-research');
const CATS = ['해외 스포츠 구단', '국내 스포츠 구단', '리그·협회', '기업·비스포츠', '공공·지역 협력', '친환경·ESG'];
const REV = ['티켓·관중', 'MD·상품', '스폰서·파트너십', '멤버십·팬덤', '브랜드 가치'];

function incheonSummary() {
  const a = readDataFile(path.join(ROOT, 'csr', 'activities.js'), { items: [] });
  return a.items.map(x => `- [${x.area}] ${x.name}: ${x.result}`).join('\n');
}

function buildPrompt(existing) {
  const known = existing.items.slice(0, 200).map(i => `- ${i.url}`).join('\n');
  const recentOrgs = [...new Set(existing.items.slice(0, 30).map(i => i.org).filter(Boolean))].join(', ');
  return `당신은 인천유나이티드(K리그1 시민구단) 마케팅팀의 CSR 리서치 담당입니다. 오늘은 ${today()}입니다.

[목표]
타 기관의 CSR(사회공헌) 사례를 찾아, 인천유나이티드에 접목할 수 있는 방안을 도출합니다.
궁극적인 목적은 CSR을 통한 구단 매출 증대(관중·티켓 판매, MD, 스폰서십, 멤버십)입니다.

[조사 범위] 종목·국내외·분야 제한 없음
- 해외 축구·야구·농구 등 프로구단의 커뮤니티 재단(Foundation/Community Trust) 사례
- 국내 K리그·KBO·KBL·V리그 구단의 사회공헌, 리그·협회(K리그 사랑나눔상 등) 사례
- 스포츠가 아닌 기업·브랜드·지자체·공공기관의 CSR/ESG 마케팅 중 구단에 응용 가능한 것
- 특히 CSR이 관중 증가, 티켓·상품 판매, 스폰서 유치, 팬 충성도로 이어진 성과가 확인된 사례를 우선

[인천유나이티드가 이미 하고 있는 2026 활동 — 그대로 반복하는 사례보다 새로운 각도 우선]
${incheonSummary()}

[규칙]
1. 반드시 WebSearch(필요하면 WebFetch)로 확인한 실제 기사·보도자료·공식 페이지·SNS 게시물만 사용하세요. URL을 추측하거나 만들지 마세요.
2. 아래 이미 수집된 URL은 제외하세요. 최근 많이 다룬 기관(${recentOrgs || '없음'})보다 다른 기관을 우선하세요.
3. 가능하면 최근 2년 이내 자료를 우선하고, 새 사례 2~4건을 찾으세요. 적합한 새 자료가 없으면 빈 배열 []을 출력하세요.
4. summary·result에는 원문에서 확인된 사실만 쓰고, 수치는 원문에 있을 때만 쓰세요.
5. apply는 인천유나이티드가 실제로 실행할 수 있는 구체적인 액션으로, revenueLink는 그 액션이 어떤 매출로 이어지는지 쓰세요.

[이미 수집된 URL]
${known || '- 없음'}

[출력 형식]
설명 없이 JSON 배열 하나만 출력하세요. 각 항목:
{"category": "${CATS.join('" | "')}",
 "priority": "높음" | "중간" | "낮음",
 "org": "기관·구단명",
 "region": "국내" | "해외",
 "title": "사례 핵심을 담은 한국어 제목",
 "source": "매체명",
 "url": "https://...",
 "published": "YYYY-MM-DD 또는 빈 문자열",
 "summary": "사례 요약 1~2문장",
 "result": "원문에서 확인된 성과 (없으면 빈 문자열)",
 "insight": "핵심 인사이트 1문장",
 "apply": "인천유나이티드 적용 방안 1~2문장",
 "revenue": ["${REV.join('", "')}" 중 해당 항목],
 "revenueLink": "매출 연결 포인트 1문장"}`;
}

const normUrl = u => String(u || '').trim().replace(/\/+$/, '').replace(/^http:/, 'https:');
const s = (v, n = 1500) => String(v ?? '').slice(0, n);

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
      id: `c-${ymd}-${Date.now().toString(36)}${added.length}`,
      category: CATS.includes(r.category) ? r.category : CATS[0],
      region: r.region === '해외' ? '해외' : '국내',
      date: iso,
      published: /^\d{4}-\d{2}-\d{2}$/.test(r.published || '') ? r.published : '',
      priority: ['높음', '중간', '낮음'].includes(r.priority) ? r.priority : '중간',
      org: s(r.org, 80), title: s(r.title, 200), source: s(r.source, 80), url,
      summary: s(r.summary), result: s(r.result), insight: s(r.insight), apply: s(r.apply),
      revenue: (Array.isArray(r.revenue) ? r.revenue : []).filter(x => REV.includes(x)),
      revenueLink: s(r.revenueLink),
    });
  }
  data.items = [...added, ...data.items];
  data.updatedAt = new Date().toISOString();
  writeDataFile(OUT, 'CSR_RESEARCH', data, 'AI CSR 사례 리서치 — tools/csr-research-agent.js 가 매시간 새 사례를 추가합니다. (url 기준 중복 제거)');
  log(`완료: 신규 ${added.length}건 추가 (총 ${data.items.length}건)`);
})();
