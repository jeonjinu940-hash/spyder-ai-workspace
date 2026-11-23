/*
  GitHub Actions 에서 매시간 실행 (.github/workflows/hourly.yml)
  --check : 최근 PC 실행 기록이 있으면(PC 켜져 있음) 건너뜀 → GITHUB_OUTPUT 에 run=true|false
  --run   : 암호화 데이터 복호화 → 4개 에이전트 실행 → 최신 저장소와 병합 → 재암호화·웹 빌드 → 커밋·푸시
*/
const fs = require('fs');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');
const C = require('./cloud-common');

const ROOT = path.resolve(__dirname, '..');
const log = m => console.log(`[${new Date().toISOString()}] ${m}`);
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
const gitTry = (...a) => spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' });

if (process.argv.includes('--check')) {
  const pc = C.readJson(path.join(ROOT, C.PC_MARK), null);
  const age = pc ? (Date.now() - Date.parse(pc.at)) / 60000 : Infinity;
  const run = process.env.FORCE === 'true' || age > C.CONFIG.pcFreshMinutes;
  log(pc ? `PC 마지막 실행: ${Math.round(age)}분 전` : 'PC 실행 기록 없음');
  log(run ? '→ 클라우드에서 실행' : '→ PC가 실행 중이므로 건너뜀');
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `run=${run}\n`);
  process.exit(0);
}

const pw = process.env.WEB_PASSWORD;
if (!pw) { log('WEB_PASSWORD 없음'); process.exit(1); }

// 1) 복호화 → 평문 데이터 파일 (gitignore 대상)
const { bundle } = C.readEnc(path.join(ROOT, C.ENC_FILE), pw);
for (const [rel, f] of Object.entries((bundle && bundle.files) || {})) C.writeJsFile(path.join(ROOT, rel), f);
log(`데이터 복호화 완료 (${Object.keys((bundle && bundle.files) || {}).length}개 파일)`);

// 2) 에이전트 실행
const results = [];
for (const f of ['research-agent.js', 'proposal-agent.js', 'csr-research-agent.js', 'csr-proposal-agent.js']) {
  const t = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { cwd: ROOT, stdio: 'inherit', timeout: 20 * 60 * 1000 });
  results.push(`${f} ${r.status === 0 ? '성공' : '실패(' + r.status + ')'} ${Math.round((Date.now() - t) / 1000)}초`);
  log(results[results.length - 1]);
}
const mine = C.collect(ROOT);

// 3) 최신 저장소와 병합 후 푸시 (그 사이 PC가 올린 내용 보존)
git('config', 'user.name', 'spyder-ai-bot');
git('config', 'user.email', 'spyder-ai-bot@users.noreply.github.com');
for (let i = 1; i <= 4; i++) {
  git('fetch', 'origin', 'main');
  git('reset', '--hard', 'origin/main');
  const { enc: prev, bundle: remote } = C.readEnc(path.join(ROOT, C.ENC_FILE), pw);
  const files = {};
  for (const rel of C.DATA_FILES) {
    const r = remote && remote.files[rel];
    const m = mine[rel];
    files[rel] = rel === 'combine/records.js' || rel === 'csr/activities.js' ? (r || m) : C.mergeData(rel, r, m);   // 같은 항목은 PC(원격) 우선
    if (!files[rel]) delete files[rel];
  }
  const enc = C.encryptBundle({ files }, pw, prev);
  if (prev && enc === prev) { log('변경 없음'); break; }
  C.buildWeb(ROOT, path.join(ROOT, 'docs'), enc);
  fs.mkdirSync(path.join(ROOT, 'state'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, C.CLOUD_MARK), JSON.stringify({ at: new Date().toISOString(), results }, null, 1));
  git('add', '-A');
  if (gitTry('diff', '--cached', '--quiet').status === 0) { log('변경 없음'); break; }
  git('commit', '-m', `cloud: 매시간 AI 업데이트 ${new Date().toISOString().slice(0, 16)}`);
  if (gitTry('push', 'origin', 'HEAD:main').status === 0) { log('푸시 완료'); break; }
  log(`푸시 충돌 — 재시도 ${i}`);
}
