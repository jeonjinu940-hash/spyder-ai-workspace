/*
  클라우드(GitHub) 연동 공통 모듈 — PC(cloud-sync.js)와 GitHub Actions(cloud-run.js)가 함께 사용
  - 데이터 파일(리서치·제안·CSR·측정 기록)은 비밀번호로 암호화해 docs/data.enc.json 한 파일로만 저장 (공개 저장소에 평문 없음)
  - 측정 기록은 선수 이름 마스킹(김○○)·연락처 제거 후에만 올림
  - 웹 버전(docs/)은 비밀번호 입력 화면(web-gate.js)을 거쳐 복호화한 데이터로 기존 화면을 그대로 띄움
*/
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CONFIG = require('./cloud-config.json');   // { repo: "owner/name", pagesUrl }

/* 암호화해서 올리는 데이터 파일 */
const DATA_FILES = ['combine/records.js', 'combine/research.js', 'combine/proposals.js', 'csr/activities.js', 'csr/research.js', 'csr/proposals.js'];
/* 웹 화면 파일 (OneDrive → 저장소 → docs/) */
const SITE_FILES = ['index.html', 'projects.js', 'combine/index.html', 'combine/app.js', 'combine/app.css', 'csr/index.html', 'csr/app.js', 'csr/app.css'];
const SITE_DIRS = ['assets'];
/* 클라우드에서 실행할 코드 */
const CODE_FILES = ['tools/claude-runner.js', 'tools/research-agent.js', 'tools/proposal-agent.js', 'tools/csr-common.js',
  'tools/csr-research-agent.js', 'tools/csr-proposal-agent.js', 'tools/cloud-common.js', 'tools/cloud-config.json', 'tools/cloud-run.js', 'tools/web-gate.js'];
/* [원본 경로(tools/cloud/...), 저장소 경로] */
const MAPPED_FILES = [['tools/cloud/hourly.yml', '.github/workflows/hourly.yml'], ['tools/cloud/gitignore.txt', '.gitignore'], ['tools/cloud/README.md', 'README.md']];

const PC_MARK = 'state/pc-last-run.json';
const CLOUD_MARK = 'state/cloud-last-run.json';
const ENC_FILE = 'docs/data.enc.json';
const ITER = 150000;

/* ───── window.X = {...}; 데이터 파일 ───── */
function readJsFile(file) {
  if (!fs.existsSync(file)) return null;
  const t = fs.readFileSync(file, 'utf8');
  const g = /window\.(\w+)\s*=/.exec(t);
  if (!g) return null;
  const s = t.indexOf('{', g.index), e = t.lastIndexOf('}');
  return { header: t.slice(0, g.index), global: g[1], data: JSON.parse(t.slice(s, e + 1)) };
}
function writeJsFile(file, f) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const txt = `${f.header || ''}window.${f.global} = ${JSON.stringify(f.data, null, 1)};\n`;
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === txt) return false;
  fs.writeFileSync(file, txt, 'utf8');
  return true;
}

/* ───── 병합 (a 우선, b 에만 있는 항목 추가) — 항목 삭제는 없음 ───── */
const normUrl = u => String(u || '').trim().replace(/\/+$/, '').replace(/^http:/, 'https:');
function union(a = [], b = [], key) {
  const seen = new Set(a.map(key));
  return [...a, ...b.filter(x => { const k = key(x); if (seen.has(k)) return false; seen.add(k); return true; })];
}
const byDesc = k => (x, y) => String(y[k] || '').localeCompare(String(x[k] || ''));
const maxStr = (x, y) => (String(x || '') > String(y || '') ? x : y);

function mergeData(rel, a, b) {
  if (!b) return a;
  if (!a) return b;
  const d = { ...a.data, updatedAt: maxStr(a.data.updatedAt, b.data.updatedAt) };
  if (/research\.js$/.test(rel)) {
    d.items = union(a.data.items, b.data.items, i => normUrl(i.url)).sort(byDesc('date'));
  } else if (rel === 'combine/proposals.js') {
    for (const k of ['marketing', 'sns']) d[k] = union(a.data[k], b.data[k], p => p.id).sort(byDesc('created')).slice(0, 1000);
  } else if (rel === 'csr/proposals.js') {
    d.items = union(a.data.items, b.data.items, p => p.id).sort(byDesc('created')).slice(0, 1000);
  } else return a;
  return { ...a, data: d };
}

/* ───── 측정 기록 개인정보 제거 ───── */
const maskName = n => (n ? n[0] + '○'.repeat(Math.max(1, [...n].length - 1)) : n);
function maskRecords(f) {
  if (!f) return f;
  const d = f.data;
  return {
    ...f,
    data: {
      ...d,
      players: (d.players || []).map(p => ({ ...p, name: maskName(p.name) })),
      schedule: (d.schedule || []).map(s => ({ ...s, contactName: '', contactPhone: '' })),
    },
  };
}

/* ───── 암호화 (Node ↔ 브라우저 WebCrypto 호환: PBKDF2-SHA256 + AES-256-GCM, 태그는 암호문 끝) ───── */
function encryptBundle(bundle, pw, prev) {
  const pt = Buffer.from(JSON.stringify(bundle), 'utf8');
  const h = crypto.createHmac('sha256', pw).update(pt).digest('hex').slice(0, 24);
  if (prev && prev.h === h) return prev;                 // 내용이 같으면 기존 파일 그대로 (불필요한 커밋 방지)
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(pw, salt, ITER, 32, 'sha256');
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(pt), c.final(), c.getAuthTag()]);
  return { v: 1, h, at: new Date().toISOString(), iter: ITER, salt: salt.toString('base64'), iv: iv.toString('base64'), ct: ct.toString('base64') };
}
function decryptBundle(enc, pw) {
  const key = crypto.pbkdf2Sync(pw, Buffer.from(enc.salt, 'base64'), enc.iter, 32, 'sha256');
  const buf = Buffer.from(enc.ct, 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(enc.iv, 'base64'));
  d.setAuthTag(buf.subarray(buf.length - 16));
  return JSON.parse(Buffer.concat([d.update(buf.subarray(0, buf.length - 16)), d.final()]).toString('utf8'));
}
function readEnc(file, pw) {
  if (!fs.existsSync(file)) return { enc: null, bundle: null };
  const enc = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { enc, bundle: decryptBundle(enc, pw) };
}

/* 폴더의 데이터 파일 → bundle { files: { rel: {header, global, data} } } */
function collect(root) {
  const files = {};
  for (const rel of DATA_FILES) { const f = readJsFile(path.join(root, rel)); if (f) files[rel] = f; }
  return files;
}

/* ───── 웹 버전 빌드 ───── */
function copyFile(src, dst) { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); }
function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    e.isDirectory() ? copyDir(s, d) : copyFile(s, d);
  }
}

/* 데이터 <script> 를 비밀번호 화면(web-gate.js)으로 바꾸고, 그 뒤 스크립트는 복호화 후 실행되도록 대기시킴 */
function gateHtml(html, rel) {
  const dir = path.posix.dirname(rel), up = dir === '.' ? '' : '../';
  let seen = false;
  return html.replace(/<script([^>]*)>/g, (m, attrs) => {
    const src = /\bsrc="([^"?]+)/.exec(attrs);
    if (src) {
      const p = path.posix.normalize(path.posix.join(dir, src[1]));
      if (DATA_FILES.includes(p)) {
        const first = !seen; seen = true;
        return first ? `<script src="${up}assets/web-gate.js">` : '<script type="text/x-spyder-skip">';
      }
    }
    return seen ? `<script type="text/x-spyder-wait"${attrs}>` : m;
  });
}

function buildWeb(srcRoot, outDir, enc) {
  fs.rmSync(outDir, { recursive: true, force: true });
  for (const d of SITE_DIRS) copyDir(path.join(srcRoot, d), path.join(outDir, d));
  for (const rel of SITE_FILES) {
    const src = path.join(srcRoot, rel);
    if (!fs.existsSync(src)) continue;
    if (rel.endsWith('.html')) {
      fs.mkdirSync(path.dirname(path.join(outDir, rel)), { recursive: true });
      fs.writeFileSync(path.join(outDir, rel), gateHtml(fs.readFileSync(src, 'utf8'), rel), 'utf8');
    } else copyFile(src, path.join(outDir, rel));
  }
  copyFile(path.join(srcRoot, 'tools', 'web-gate.js'), path.join(outDir, 'assets', 'web-gate.js'));
  fs.writeFileSync(path.join(outDir, 'data.enc.json'), JSON.stringify(enc), 'utf8');
  fs.writeFileSync(path.join(outDir, '.nojekyll'), '');
}

const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };

module.exports = {
  CONFIG, DATA_FILES, SITE_FILES, SITE_DIRS, CODE_FILES, MAPPED_FILES, PC_MARK, CLOUD_MARK, ENC_FILE,
  readJsFile, writeJsFile, mergeData, maskRecords, encryptBundle, decryptBundle, readEnc, collect,
  copyFile, copyDir, buildWeb, readJson,
};
