/*
  AI 제안 자동 생성 (매시간, 리서치 직후 실행)
  - 최신 리서치 자료 + 엑셀 측정 기록을 바탕으로
    MARKETING 제안 3건 이상, SNS 콘텐츠 제안 3건 이상을 생성해 combine/proposals.js 에 추가
  수동 실행: node tools/proposal-agent.js
*/
const path = require('path');
const { ROOT, logger, runClaude, readDataFile, writeDataFile, extractJson, today } = require('./claude-runner');

const OUT = path.join(ROOT, 'combine', 'proposals.js');
const log = logger('proposal');
const MAX_PER_TYPE = 1000;

const METRICS = [
  ['m55', '55m 직선주루', '초', true], ['m27', '27m 직선주루', '초', true], ['m5', '5m 스타트', '초', true],
  ['b1', '홈→1루', '초', true], ['b2', '홈→2루', '초', true], ['grip', '악력', 'kg', false],
];

function recordsSummary() {
  const rec = readDataFile(path.join(ROOT, 'combine', 'records.js'), { schedule: [], players: [] });
  const P = rec.players, S = rec.schedule;
  const t = today();
  const done = S.filter(s => s.measured), next = S.filter(s => !s.measured && s.date >= t).sort((a, b) => a.date.localeCompare(b.date));
  const lines = [
    `측정 완료 ${done.length}/${S.length}개교, 총 ${P.length}명 측정 (1학년 ${P.filter(p => p.grade === 1).length}, 2학년 ${P.filter(p => p.grade === 2).length})`,
    `최근 측정: ${done.slice(-5).map(s => `${s.school}(${s.date})`).join(', ')}`,
    `예정 일정: ${next.map(s => `${s.school}(${s.date} ${s.time})`).join(', ') || '없음'}`,
  ];
  for (const [k, name, unit, asc] of METRICS) {
    const top = P.filter(p => p[k] != null).sort((a, b) => (asc ? a[k] - b[k] : b[k] - a[k])).slice(0, 3);
    if (top.length) lines.push(`${name} TOP3: ${top.map((p, i) => `${i + 1}위 ${p.name}(${p.school} ${p.grade}학년 ${p.pos}) ${p[k]}${unit}`).join(' / ')}`);
  }
  const avg = done.map(s => {
    const v = P.filter(p => p.school === s.school && p.m55 != null).map(p => p.m55);
    return v.length ? [s.school, v.reduce((a, b) => a + b, 0) / v.length] : null;
  }).filter(Boolean).sort((a, b) => a[1] - b[1]).slice(0, 3);
  lines.push(`학교별 55m 평균 TOP3: ${avg.map(([s, v], i) => `${i + 1}위 ${s} ${v.toFixed(3)}초`).join(' / ')}`);
  return lines.join('\n');
}

function buildPrompt(data) {
  const research = readDataFile(path.join(ROOT, 'combine', 'research.js'), { items: [] }).items.slice(0, 20);
  const recentTitles = [...data.marketing.slice(0, 40), ...data.sns.slice(0, 40)].map(p => `- [${p.type}] ${p.title}`).join('\n');
  return `당신은 SPYDER Korea 스포츠마케팅팀의 마케팅·SNS 기획 담당입니다. 오늘은 ${today()}입니다.

[프로젝트] SPYDER 베이스볼 컴바인 — SPYDER가 고교 야구부를 직접 방문해 5m·27m·55m 직선주루, 홈→1루·2루 주루, 악력을 측정하고
랭킹을 공개하는 프로그램. 측정 참여 학교에는 SPYDER 의류·용품을 증정. 목표는 SPYDER 브랜드의 야구 비전 확대와 야구 카테고리 매출 증대.
SPYDER는 한화 이글스 유니폼 파트너이며 류현진 200승 기념 컬렉션 등 야구 라인을 운영 중.

[현재 컴바인 데이터]
${recordsSummary()}

[최신 리서치 자료 (id · 제목 · 적용 방안)]
${research.map(r => `- ${r.id} · ${r.title} · ${r.apply}`).join('\n')}

[최근 이미 제안한 항목 — 중복 금지, 다른 각도로]
${recentTitles || '- 없음'}

[요청]
1) MARKETING 제안 3~4건: 실제 실행 가능한 마케팅·프로모션·매출 증대 기획. 위 리서치와 데이터를 근거로.
2) SNS 콘텐츠 제안 3~4건: SPYDER 공식 SNS(인스타그램·유튜브 쇼츠 등)에 올릴 콘텐츠.
   주제, 실제 게시물에 들어갈 텍스트(장별/씬별 문구, 캡션, 해시태그), 디자인 방향성을 구체적으로.
   측정 데이터(실명 기록)를 활용할 수 있으며, 선수는 고교생이므로 학교·학생 동의를 전제로 하고 비하·비교 표현은 피하세요.
3) 모든 문구는 한국어, SPYDER 톤(프리미엄·스포티·절제된 모노크롬 감성).
4) 수치 목표는 근거가 약하면 "설정 필요"로 두세요. 사실이 아닌 내용을 사실처럼 쓰지 마세요.
5) 리서치 id(r-...)는 "research" 배열에만 넣고, 본문 텍스트에는 쓰지 마세요. 근거를 언급할 때는 매체명·사례명으로 쓰세요.

[출력 형식] 설명 없이 JSON 객체 하나만 출력:
{
 "marketing": [{
   "title": "기획안 제목", "priority": "높음|중간|낮음",
   "background": "배경 및 목적", "goal": "마케팅 목표", "target": "타깃",
   "strategy": "핵심 전략", "actions": ["실행 방안", "..."],
   "budget": [{"item": "항목", "cost": "금액 또는 협의"}],
   "effect": "기대 효과", "kpis": [{"name": "지표", "target": "목표"}],
   "research": ["근거 리서치 id"]
 }],
 "sns": [{
   "title": "콘텐츠 제목", "priority": "높음|중간|낮음",
   "channel": "인스타그램|유튜브 쇼츠|틱톡|인스타그램 스토리",
   "format": "카드뉴스|릴스|쇼츠|스토리|단일 이미지",
   "topic": "주제 설명", "goal": "콘텐츠 목적", "target": "타깃",
   "timing": "게시 시점",
   "slides": [{"heading": "장/씬 제목 또는 큰 문구", "body": "내부 텍스트 또는 장면 설명"}],
   "caption": "게시물 본문 캡션", "hashtags": ["#SPYDER", "..."],
   "design": {"concept": "콘셉트", "layout": "레이아웃", "color": "컬러", "typography": "타이포", "visual": "사진·영상·그래픽 연출"},
   "dataPoints": ["활용한 데이터"],
   "research": ["근거 리서치 id"]
 }]
}`;
}

const s = (v, n = 2000) => String(v ?? '').slice(0, n);
const arr = v => (Array.isArray(v) ? v : []);
const prio = v => (['높음', '중간', '낮음'].includes(v) ? v : '중간');

(async () => {
  const data = readDataFile(OUT, { updatedAt: '', marketing: [], sns: [] });
  log(`제안 생성 시작 (MARKETING ${data.marketing.length} / SNS ${data.sns.length})`);
  let text;
  try { text = await runClaude(buildPrompt(data), [], 15); }
  catch (e) { log('실패: ' + e.message); process.exit(1); }
  const out = extractJson(text);
  if (!out) { log('실패: JSON 파싱 불가'); process.exit(1); }

  const now = new Date().toISOString(), date = today();
  const stamp = Date.now().toString(36);
  const titles = new Set([...data.marketing, ...data.sns].map(p => p.title));
  const mk = arr(out.marketing).filter(p => p && p.title && !titles.has(p.title)).map((p, i) => ({
    id: `pm-${stamp}${i}`, type: 'marketing', status: '신규 제안', created: now, updated: date, ai: true,
    title: s(p.title, 200), priority: prio(p.priority), background: s(p.background), goal: s(p.goal), target: s(p.target),
    strategy: s(p.strategy), actions: arr(p.actions).map(x => s(x, 500)),
    budget: arr(p.budget).map(b => ({ item: s(b.item, 100), cost: s(b.cost, 100) })),
    effect: s(p.effect), kpis: arr(p.kpis).map(k => ({ name: s(k.name, 100), target: s(k.target, 100) })),
    research: arr(p.research).map(x => s(x, 60)),
  }));
  const sn = arr(out.sns).filter(p => p && p.title && !titles.has(p.title)).map((p, i) => ({
    id: `ps-${stamp}${i}`, type: 'sns', status: '신규 제안', created: now, updated: date, ai: true,
    title: s(p.title, 200), priority: prio(p.priority), channel: s(p.channel, 40), format: s(p.format, 40),
    topic: s(p.topic), goal: s(p.goal), target: s(p.target), timing: s(p.timing, 200),
    slides: arr(p.slides).map(x => ({ heading: s(x && x.heading, 200), body: s(x && x.body, 600) })),
    caption: s(p.caption, 2200), hashtags: arr(p.hashtags).map(h => s(h, 50)),
    design: Object.fromEntries(['concept', 'layout', 'color', 'typography', 'visual'].map(k => [k, s(p.design && p.design[k], 400)])),
    dataPoints: arr(p.dataPoints).map(x => s(x, 200)), research: arr(p.research).map(x => s(x, 60)),
  }));

  data.marketing = [...mk, ...data.marketing].slice(0, MAX_PER_TYPE);
  data.sns = [...sn, ...data.sns].slice(0, MAX_PER_TYPE);
  data.updatedAt = now;
  writeDataFile(OUT, 'COMBINE_PROPOSALS', data, 'AI 제안 — tools/proposal-agent.js 가 매시간 MARKETING·SNS 제안을 추가합니다.');
  log(`완료: MARKETING ${mk.length}건, SNS ${sn.length}건 추가`);
})();
