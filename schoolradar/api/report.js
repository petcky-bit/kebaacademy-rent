/*
 * 리포트 실행기 — 저장소에 모인 자료로 클로드코드를 띄워 PDF 를 만든다.
 *
 *   POST   /api/report?id=..&doc=full|brief   시작 (이미 돌고 있으면 그 작업을 그대로)
 *                                             본문(JSON, 선택) { sections:[{t,pg,on}] }
 *   GET    /api/report?id=..&doc=..           상태와 로그 꼬리
 *   DELETE /api/report?id=..&doc=..           중단
 *
 * 문서는 둘이고 따로 돈다 — 종합이 도는 중에 브리프를 뽑을 수 있다.
 * 작업은 메모리에 "id::doc" 키로 들고, meta 에는 api/vault.js 의 DOCS 가 정한 자리에 적는다.
 *
 * 반드시 지키는 것 네 가지
 *   1. 구독으로만 돌린다 — 자식에게 ANTHROPIC_* 를 넘기지 않는다. 넘어가면 조용히 API 과금이 된다.
 *   2. 끊기면 이어서 한다 — 세션 id 를 우리가 정해 meta 에 남기고, 네트워크 오류일 때만 --resume.
 *   3. 결과물을 믿는다 — 종료코드가 1 이어도 out/ 에 PDF 가 있으면 성공이다.
 *   4. 서버가 다시 뜨면 running 을 정리한다 — 진행 상태는 메모리에만 있다.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');
const vault = require('./vault.js');

const { ROOT, DOCS, docOf, readMeta, writeMeta, detail, safeName, resolveIn } = vault;

const PROJECT = path.join(__dirname, '..');
const PROMPTS = path.join(PROJECT, 'prompts');

const RETRY_MAX = 3;
const RETRY_WAIT = 20000;
const LOG_TAIL = 400;

/* 학교급 코드 → 프롬프트 파일과 이름. 모르면 고등학교다. */
const KINDS = {
  '02': { file: '분석리포트-생성-초.md', name: '초등학교' },
  '03': { file: '분석리포트-생성-중.md', name: '중학교' },
  '04': { file: '분석리포트-생성-고.md', name: '고등학교' },
};
const kindOf = k => KINDS[String(k)] || KINDS['04'];

/* 네트워크로 끊긴 것만 다시 시도한다. 자료가 모자라 못 만드는 건 몇 번을 돌려도 같은 자리에서 죽는다. */
const NET = [
  'enotfound', 'eai_again', 'econnreset', 'econnrefused', 'etimedout', 'epipe',
  'socket hang up', 'network', "can't reach the api server", 'connection error',
  'fetch failed', '502', '503', '504', 'overloaded_error', 'internal server error', 'rate limit',
];
function looksNetwork(lines) {
  const tail = lines.slice(-40).join('\n').toLowerCase();
  return NET.some(s => tail.includes(s));
}

const RESUME_NOTE = `이전 실행이 네트워크 문제로 중간에 끊겼다. 처음부터 다시 하지 마라.
1. .scratch/ 안의 이 작업 폴더를 먼저 열어 어디까지 했는지 확인해라 — 추출해 둔 텍스트, 중간 스크립트, report.html 조각이 그대로 남아 있다.
2. 이미 만들어 둔 것은 다시 만들지 말고 그대로 쓴다.
3. 남은 단계부터 이어서 끝내라 — 최종 산출물은 vault 의 out/ 에 PDF 와 제작메모.md 다.`;

const NO_PICK = '따로 고르지 않았다. 폴더에 있는 자료로 만들 수 있는 절을 전부 만들어라.';

/* ── 작업 ───────────────────────────────────────────────── */

const jobs = new Map();                       // "id::doc" -> job
const keyOf = (id, doc) => id + '::' + doc;

function fail(status, message) {
  return Object.assign(new Error(message), { status });
}

function pdfIn(id, doc) {
  try {
    const want = DOCS[doc].prefix;
    const hit = fs.readdirSync(resolveIn(id, 'out'))
      .filter(n => !n.startsWith('.') && n.toLowerCase().endsWith('.pdf') && n.startsWith(want))
      .sort();
    return hit.length ? 'out/' + hit[hit.length - 1] : null;
  } catch {
    return null;
  }
}

/** meta 의 이 문서 자리를 갈아 끼운다. */
function patchDoc(id, doc, patch) {
  const slot = DOCS[doc].meta;
  const meta = readMeta(id) || { files: {}, created: new Date().toISOString() };
  meta[slot] = Object.assign({}, meta[slot], patch);
  writeMeta(id, meta);
  return meta[slot];
}

/* ── 목차를 프롬프트에 넣을 모양으로 ────────────────────── */

const clean = (s, n) => String(s == null ? '' : s)
  .replace(/[\u0000-\u001f`]/g, ' ').trim().slice(0, n);

function sectionsText(sections) {
  if (!Array.isArray(sections) || !sections.length) return NO_PICK;
  const rows = sections.slice(0, 60);
  const on = rows.filter(s => s && s.on).length;
  if (!on) return NO_PICK;
  const lines = rows.map(s => {
    const t = clean(s && s.t, 120);
    const pg = clean(s && s.pg, 24);
    return `- [${s && s.on ? 'x' : ' '}] ${t}${pg ? ` (${pg})` : ''}`;
  });
  return `사람이 웹 화면에서 고른 목차다. ☑ 표시된 ${on}개만 만들어라 —
☐ 는 자료가 없거나 사람이 일부러 뺀 것이니 만들지 마라.

${lines.join('\n')}`;
}

/* ── 프롬프트 채우기 ────────────────────────────────────── */

function buildPrompt(id, doc, d, sections) {
  const file = doc === 'brief' ? '브리프-생성.md' : kindOf(d.school && d.school.kind).file;
  const p = path.join(PROMPTS, file);
  if (!fs.existsSync(p)) throw fail(500, `프롬프트가 없습니다: prompts/${file}`);

  const kind = String((d.school && d.school.kind) || '04');
  const files = d.files.map(f => f.path).sort((a, b) => a.localeCompare(b, 'ko'));

  const fill = {
    '{{VAULT_ID}}': id,
    '{{SCHOOL}}': (d.school && d.school.nm) || id,
    '{{YEAR}}': String(d.year || ''),
    '{{FILES}}': files.length ? files.map(f => ' - ' + f).join('\n') : ' (없음)',
    '{{KIND}}': KINDS[kind] ? kind : '04',
    '{{KIND_NAME}}': kindOf(kind).name,
    '{{SECTIONS}}': doc === 'brief' ? NO_PICK : sectionsText(sections),
  };

  let text = fs.readFileSync(p, 'utf8');
  for (const [k, v] of Object.entries(fill)) text = text.split(k).join(v);
  return text;
}

/* ── stream-json 한 줄 → 사람이 읽는 진행 줄 ────────────── */

function humanize(line) {
  let j;
  try { j = JSON.parse(line); } catch { return line; }     // 모르는 형태는 원문을 남긴다

  if (j.type === 'system' && j.subtype === 'init') {
    return '· 시작 — ' + (j.model || '모델 미상');
  }

  if (j.type === 'assistant' && j.message && Array.isArray(j.message.content)) {
    const out = [];
    for (const c of j.message.content) {
      if (c.type === 'text' && c.text) {
        const first = String(c.text).split('\n').find(x => x.trim());
        if (first) out.push(first.trim().slice(0, 200));
      } else if (c.type === 'tool_use') {
        const i = c.input || {};
        const what = i.file_path || i.path || i.command || i.pattern || i.url || '';
        out.push('▸ ' + (c.name || '도구') + (what ? ' ' + String(what).replace(/\s+/g, ' ').slice(0, 140) : ''));
      }
    }
    return out.join('\n');
  }

  if (j.type === 'user' && j.message && Array.isArray(j.message.content)) {
    /* 성공한 결과 본문은 길기만 하니 버리고 실패만 남긴다 */
    const bad = j.message.content.some(c => c.type === 'tool_result' && c.is_error);
    return bad ? '  ✗ 실패' : '';
  }

  if (j.type === 'result') {
    const head = j.is_error || j.subtype !== 'success' ? '· 중단 — ' : '· 끝 — ';
    let s = head + (j.subtype || '');
    /* 구독으로 돌아도 찍히는 환산값이다. 청구액으로 읽히지 않게 이 말투를 지킨다. */
    if (typeof j.total_cost_usd === 'number') s += ' · 사용량 $' + j.total_cost_usd.toFixed(3) + ' 어치';
    return s;
  }

  return '';
}

/* ── 자식 띄우기 ────────────────────────────────────────── */

const ARGS = ['-p', '--output-format', 'stream-json', '--verbose',
              '--permission-mode', 'acceptEdits',
              '--allowedTools', 'Read,Write,Edit,Glob,Grep,Bash'];

/** 구독으로만 돌린다 — 이 값들이 있으면 claude.ai 로그인 대신 그쪽을 먼저 쓴다. */
function cleanEnv() {
  const env = Object.assign({}, process.env);
  for (const k of ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL',
                   'ANTHROPIC_API_URL', 'ANTHROPIC_CUSTOM_HEADERS']) delete env[k];
  return env;
}

function spawnClaude(job, prompt, resume) {
  const bin = process.env.SR_CLAUDE_BIN || 'claude';
  const args = ARGS.concat(resume ? ['--resume', job.sessionId] : ['--session-id', job.sessionId]);
  const win = process.platform === 'win32';

  let child;
  try {
    child = spawn(bin, args, {
      cwd: PROJECT,
      env: cleanEnv(),
      shell: win,                 // 윈도에서 claude 는 .cmd 라 셸을 거쳐야 뜬다
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (e) {
    job.push('! 실행 실패: ' + e.message +
             ' (claude 명령을 찾지 못했다면 SR_CLAUDE_BIN 으로 경로를 지정하세요)');
    return null;
  }

  child.on('error', e => {
    job.push('! 실행 실패: ' + e.message +
             ' (claude 명령을 찾지 못했다면 SR_CLAUDE_BIN 으로 경로를 지정하세요)');
  });

  let buf = '';
  child.stdout.on('data', d => {
    buf += d.toString('utf8');                 // 줄이 청크 경계에서 잘려 올 수 있다
    const parts = buf.split('\n');
    buf = parts.pop();
    for (const line of parts) {
      const t = line.trim();
      if (!t) continue;
      const out = humanize(t);
      if (out) job.push(out);
    }
  });

  let ebuf = '';
  child.stderr.on('data', d => {
    ebuf += d.toString('utf8');
    const parts = ebuf.split('\n');
    ebuf = parts.pop();
    for (const line of parts) if (line.trim()) job.push('! ' + line.trim());
  });

  try { child.stdin.write(prompt); child.stdin.end(); } catch {}
  return child;
}

/* ── 한 건 돌리기 ───────────────────────────────────────── */

async function run(job, prompt) {
  for (;;) {
    const resume = job.attempt > 1;
    const child = spawnClaude(job, resume ? RESUME_NOTE : prompt, resume);
    job.child = child;

    const code = child
      ? await new Promise(res => child.on('close', c => res(c == null ? 1 : c)))
      : 1;
    job.child = null;

    const pdf = pdfIn(job.id, job.doc);        // 결과물을 믿는다 — 종료코드가 1 이어도 PDF 가 있으면 성공
    if (pdf) return finish(job, 'done', { pdf, exitCode: code, error: null });
    if (job.stopped) return finish(job, 'failed', { pdf: null, exitCode: code, error: '중단됨' });

    if (job.attempt < RETRY_MAX && looksNetwork(job.lines)) {
      job.push('! 네트워크로 끊긴 것으로 보입니다 — 20초 뒤 이어서 계속합니다.');
      await new Promise(r => setTimeout(r, RETRY_WAIT));
      if (job.stopped) return finish(job, 'failed', { pdf: null, exitCode: code, error: '중단됨' });
      job.attempt++;
      patchDoc(job.id, job.doc, { attempt: job.attempt });
      job.push(`· 이어서 다시 시도 ${job.attempt - 1}/${RETRY_MAX} — 같은 세션에 이어붙입니다`);
      continue;
    }

    return finish(job, 'failed', {
      pdf: null, exitCode: code,
      error: `PDF 가 생성되지 않았습니다 (${job.attempt}번 시도, 종료코드 ${code})`,
    });
  }
}

function finish(job, status, extra) {
  job.status = status;
  job.endedAt = new Date().toISOString();
  patchDoc(job.id, job.doc, Object.assign({
    status, endedAt: job.endedAt, attempt: job.attempt, sessionId: job.sessionId,
  }, extra));
  return status;
}

/* ── 서버가 다시 뜨면 running 을 정리한다 ───────────────── */
(function sweep() {
  let ids = [];
  try { ids = fs.readdirSync(ROOT); } catch { return; }
  for (const id of ids) {
    const meta = readMeta(id);
    if (!meta) continue;
    let touched = false;
    for (const doc of Object.keys(DOCS)) {
      const slot = DOCS[doc].meta;
      if (!meta[slot] || meta[slot].status !== 'running') continue;
      const pdf = pdfIn(id, doc);
      meta[slot] = Object.assign({}, meta[slot], pdf
        ? { status: 'done', pdf, endedAt: new Date().toISOString() }
        : { status: 'failed', endedAt: new Date().toISOString(),
            error: '서버가 다시 시작되어 진행 상태를 잃었습니다. 다시 만들어 주세요.' });
      touched = true;
    }
    if (touched) { try { writeMeta(id, meta); } catch {} }
  }
})();

/* ── 핸들러 ─────────────────────────────────────────────── */

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const q = req.query || {};
  const id = safeName(q.id || '');
  const doc = docOf(q.doc);

  try {
    if (!id) throw fail(400, 'id 가 필요합니다.');
    const job = jobs.get(keyOf(id, doc));

    /* ── GET ── */
    if (req.method === 'GET') {
      let d = null;
      try { d = detail(id); } catch {}
      const saved = (d && d.docs && d.docs[doc]) || {};
      if (!job) {
        res.json({ doc, status: saved.status || 'none', report: saved, log: '' });
        return;
      }
      res.json({
        doc,
        status: job.status,
        startedAt: job.startedAt,
        endedAt: job.endedAt,
        code: job.exitCode,
        attempt: job.attempt,
        retryMax: RETRY_MAX,
        report: saved,
        log: job.lines.slice(-LOG_TAIL).join('\n'),
      });
      return;
    }

    /* ── DELETE ── */
    if (req.method === 'DELETE') {
      if (!job || job.status !== 'running') { res.json({ ok: true, doc, status: job ? job.status : 'none' }); return; }
      job.stopped = true;                      // 중단 표시를 먼저 세운다 —
      job.push('! 사용자가 중단했습니다.');     // 반대면 재시도 루프가 죽은 자식을 끊긴 것으로 보고 되살린다
      if (job.child) { try { job.child.kill(); } catch {} }
      res.json({ ok: true, doc, status: 'stopping' });
      return;
    }

    /* ── POST ── */
    if (req.method !== 'POST') throw fail(405, `${req.method} 는 받지 않습니다.`);

    if (job && job.status === 'running') {
      res.json({ ok: true, doc, status: 'running', startedAt: job.startedAt,
                 log: job.lines.slice(-LOG_TAIL).join('\n') });
      return;
    }

    let d;
    try { d = detail(id); } catch { throw fail(404, '그런 폴더가 없습니다.'); }
    if (!d.count) throw fail(400, '저장소에 자료가 없습니다 — 먼저 파일을 받아 주세요.');

    let sections = null;
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      if (Array.isArray(body.sections)) sections = body.sections;
    } catch { /* 깨졌으면 옛 문장으로 돈다. 시작을 막지는 않는다. */ }

    const prompt = buildPrompt(id, doc, d, sections);

    /* meta 에 이미 세션 id 가 있으면 그걸 다시 쓴다 */
    const prev = (readMeta(id) || {})[DOCS[doc].meta] || {};
    const sessionId = prev.sessionId || crypto.randomUUID();
    const startedAt = new Date().toISOString();

    const fresh = {
      id, doc, sessionId, startedAt, endedAt: null,
      status: 'running', attempt: 1, stopped: false, child: null,
      lines: [],
      exitCode: null,
      push(line) { String(line).split('\n').forEach(x => { if (x) this.lines.push(x); }); },
    };
    jobs.set(keyOf(id, doc), fresh);

    patchDoc(id, doc, {
      status: 'running', startedAt, sessionId, pdf: null, error: null,
      attempt: 1, endedAt: null,
      sections: sections ? sections.filter(s => s && s.on).map(s => clean(s.t, 120)) : null,
    });

    run(fresh, prompt).catch(e => {
      fresh.push('! ' + e.message);
      finish(fresh, 'failed', { pdf: null, exitCode: 1, error: e.message });
    });

    res.json({ ok: true, doc, status: 'running', startedAt, log: '' });
    return;
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: e.message });
  }
};

module.exports.sectionsText = sectionsText;
module.exports.buildPrompt = buildPrompt;
module.exports.humanize = humanize;
module.exports.cleanEnv = cleanEnv;
module.exports.ARGS = ARGS;
