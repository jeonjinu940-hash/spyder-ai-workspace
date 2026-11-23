/* BASEBALL COMBINE 측정 데이터 요약 — 제안·원고 작성 AI 에 근거 수치로 제공 (proposal-agent / combine-develop-agent / deck-agent) */
const path = require('path');
const { ROOT, readDataFile, today } = require('./claude-runner');

const METRICS = [
  ['m55', '55m 직선주루', '초', true], ['m27', '27m 직선주루', '초', true], ['m5', '5m 스타트', '초', true],
  ['b1', '홈→1루', '초', true], ['b2', '홈→2루', '초', true], ['grip', '악력', 'kg', false],
];

function recordsSummary() {
  const rec = readDataFile(path.join(ROOT, 'combine', 'records.js'), { schedule: [], players: [], sns: [] });
  const P = rec.players || [], S = rec.schedule || [], N = rec.sns || [];
  const t = today();
  const done = S.filter(s => s.measured), next = S.filter(s => !s.measured && s.date >= t).sort((a, b) => a.date.localeCompare(b.date));
  const lines = [
    `측정 완료 ${done.length}/${S.length}개교, 총 ${P.length}명 측정 (1학년 ${P.filter(p => p.grade === 1).length}, 2학년 ${P.filter(p => p.grade === 2).length}), 학교당 평균 ${done.length ? Math.round(P.length / done.length) : 0}명`,
    `물품 증정 완료 ${S.filter(s => s.giftDone).length}개교 / 미완료 ${S.filter(s => !s.giftDone).length}개교`,
    `SNS 게시물 계획 ${N.length}건 (업로드 완료 ${N.filter(x => x.done).length}건)`,
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

module.exports = { recordsSummary, METRICS };
