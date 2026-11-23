/* 헤드리스 Claude Code 실행 공통 모듈 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const LOG_DIR = path.join(__dirname, 'logs');
fs.mkdirSync(LOG_DIR, { recursive: true });

const logger = name => msg => {
  fs.appendFileSync(path.join(LOG_DIR, `${name}.log`), `[${new Date().toLocaleString('ko-KR')}] ${msg}\n`, 'utf8');
  if (process.env.GITHUB_ACTIONS) console.log(`[${name}] ${msg}`);   // 클라우드 실행 시 Actions 로그에도 표시
};

function findClaude() {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;           // 클라우드(GitHub Actions): PATH 의 claude
  const home = os.homedir();
  const cands = [];
  for (const base of ['.antigravity-ide', '.vscode', '.vscode-insiders', '.cursor', '.windsurf']) {
    const dir = path.join(home, base, 'extensions');
    if (!fs.existsSync(dir)) continue;
    for (const d of fs.readdirSync(dir)) {
      const exe = path.join(dir, d, 'resources', 'native-binary', 'claude.exe');
      if (d.startsWith('anthropic.claude-code') && fs.existsSync(exe)) {
        const v = (/(\d+)\.(\d+)\.(\d+)/.exec(d) || [0, 0, 0, 0]).slice(1).map(Number);
        cands.push({ exe, v: v[0] * 1e8 + v[1] * 1e4 + v[2] });
      }
    }
  }
  for (const p of [path.join(home, '.local', 'bin', 'claude.exe'), path.join(process.env.APPDATA || '', 'npm', 'claude.cmd')]) {
    if (fs.existsSync(p)) cands.push({ exe: p, v: 0 });
  }
  cands.sort((a, b) => b.v - a.v);
  return cands[0] && cands[0].exe;
}

/* allowed: 허용할 도구 목록 (예: ['WebSearch','WebFetch']). 파일 수정·명령 실행 도구는 항상 차단 */
/* 일시적 실패(인증 갱신 등)는 1분 뒤 한 번 더 시도 */
async function runClaude(prompt, allowed = [], timeoutMin = 15) {
  try { return await runOnce(prompt, allowed, timeoutMin); }
  catch (e) {
    if (/시간 초과|찾지 못했/.test(e.message)) throw e;
    await new Promise(r => setTimeout(r, 60 * 1000));
    try { return await runOnce(prompt, allowed, timeoutMin); }
    catch (e2) { throw new Error(`재시도 후 실패 — ${e2.message}`); }
  }
}

function runOnce(prompt, allowed, timeoutMin) {
  const exe = findClaude();
  if (!exe) return Promise.reject(new Error('claude 실행 파일을 찾지 못했습니다.'));
  return new Promise((resolve, reject) => {
    const args = ['-p'];
    if (allowed.length) args.push('--allowedTools', ...allowed);
    args.push('--disallowedTools', 'Bash', 'PowerShell', 'Edit', 'Write', 'NotebookEdit', ...(allowed.length ? [] : ['WebSearch', 'WebFetch']));
    args.push('--output-format', 'text');
    const child = spawn(exe, args, { cwd: ROOT, windowsHide: true, shell: exe.endsWith('.cmd') });
    let out = '', err = '';
    child.stdout.on('data', d => (out += d.toString('utf8')));
    child.stderr.on('data', d => (err += d.toString('utf8')));
    const timer = setTimeout(() => { child.kill(); reject(new Error(`시간 초과(${timeoutMin}분)`)); }, timeoutMin * 60 * 1000);
    child.on('close', code => { clearTimeout(timer); code === 0 ? resolve(out) : reject(new Error(`종료 코드 ${code}: ${(err + ' ' + out).replace(/\s+/g, ' ').slice(0, 600)}`)); });
    child.stdin.write(prompt, 'utf8');
    child.stdin.end();
  });
}

/* window.X = {...}; 형태의 데이터 파일 읽기/쓰기 */
function readDataFile(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  const t = fs.readFileSync(file, 'utf8');
  return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
}
function writeDataFile(file, globalName, data, comment) {
  fs.writeFileSync(file, `/* ${comment} */\nwindow.${globalName} = ${JSON.stringify(data, null, 1)};\n`, 'utf8');
}

function extractJson(text, open = '{', close = '}') {
  const s = text.indexOf(open), e = text.lastIndexOf(close);
  if (s < 0 || e < s) return null;
  try { return JSON.parse(text.slice(s, e + 1)); } catch { return null; }
}

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

module.exports = { ROOT, logger, findClaude, runClaude, readDataFile, writeDataFile, extractJson, today };
