/*
 * 저장소 — 받은 파일을 브라우저가 아니라 프로젝트 폴더에 쌓는다.
 *
 * 브라우저(IndexedDB) 안에 두면 클로드코드가 못 읽어서 리포트를 만들 수 없다.
 *
 *   vault/{학교명}_{공시연도}/
 *     raw/    공시 원문
 *     data/   openapi.json, 졸업생진로 csv      ← api/collect.js 가 쓴다
 *     out/    완성된 PDF, 제작메모.md           ← 클로드코드가 넣는다
 *     meta.json
 *
 *   GET    /api/vault                        전체 목록 { root, schools, count, bytes } 최근 갱신 순
 *   GET    /api/vault?id=..                  한 학교 상세
 *   POST   /api/vault?id=..&kind=raw&name=..&act=..&label=..&year=..   파일 저장 (본문 = 바이트)
 *   POST   /api/vault?id=..&meta=1           meta 병합 (본문 = JSON)
 *   POST   /api/vault?id=..&reveal=1[&file=raw/..]   탐색기로 열기 (__root__ 면 vault/ 자체)
 *   DELETE /api/vault?id=..                  폴더 통째로 삭제
 *   DELETE /api/vault?id=..&file=raw/..      파일 하나 삭제
 *
 * 폴더 이름과 파일명 정리는 api/collect.js 의 folderId · safeName 을 가져다 쓴다.
 * 따로 만들면 collect 가 쓴 폴더와 어긋나 웹이 쓴 곳과 클로드코드가 읽는 곳이 갈린다.
 *
 * meta 를 믿지 않고 디스크를 믿는다 — 상세를 물어볼 때마다 raw·data·out 을 실제로 훑어
 * 목록을 다시 맞춘다. 사람이 파일을 지우거나 클로드코드가 out/ 에 PDF 를 넣어도 바로 알아본다.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const collect = require('./collect.js');

/* 따로 만들지 않는다 — collect 가 쓴 규칙 그대로 */
const { folderId, safeName } = collect;

const ROOT = path.join(__dirname, '..', 'vault');
const KINDS = ['out', 'raw', 'data'];        // 화면에 깔리는 순서

/* 문서는 둘. meta 의 어느 자리에 적는지와, out/ 에서 PDF 를 어떤 앞머리로 가르는지. */
const DOCS = {
  full:  { meta: 'report', prefix: '분석리포트', label: '종합 리포트' },
  brief: { meta: 'brief',  prefix: '브리프',     label: '학교 브리프' },
};

/** doc 이 없거나 모르는 값이면 full 이다. */
function docOf(doc) {
  return Object.prototype.hasOwnProperty.call(DOCS, doc) ? doc : 'full';
}

/** vault/ 밖으로 나가는 경로는 던진다. */
function resolveIn(...parts) {
  const full = path.resolve(ROOT, ...parts);
  const base = path.resolve(ROOT);
  if (full !== base && !full.startsWith(base + path.sep)) throw fail(400, '잘못된 경로입니다.');
  return full;
}

const fail = (status, message) => Object.assign(new Error(message), { status });

/* 파일명은 학교가 준 이름을 그대로 살린다 — 이름이 곧 자료의 정체다.
   경로 구분자와 .. 만 막는다. */
function keepName(name) {
  const base = String(name || '').replace(/[\\/]/g, '_').replace(/^\.+/, '_').trim();
  if (!base || base === '.' || base === '..') throw fail(400, '파일 이름이 필요합니다.');
  return base.slice(0, 180);
}

function readMeta(id) {
  try {
    return JSON.parse(fs.readFileSync(resolveIn(id, 'meta.json'), 'utf8'));
  } catch {
    return null;
  }
}

function writeMeta(id, meta) {
  const dir = resolveIn(id);
  fs.mkdirSync(dir, { recursive: true });
  meta.updated = new Date().toISOString();
  fs.writeFileSync(resolveIn(id, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');
  return meta;
}

/** 얕게 합치되 files 와 report 는 안쪽까지. created 는 처음 값을 지킨다. */
function mergeMeta(base, patch) {
  const created = (base && base.created) || (patch && patch.created) || new Date().toISOString();
  const out = Object.assign({}, base, patch);
  out.files = Object.assign({}, (base && base.files) || {}, (patch && patch.files) || {});
  for (const k of ['report', 'brief']) {
    const a = base && base[k];
    const b = patch && patch[k];
    if (a && b && typeof a === 'object' && typeof b === 'object') out[k] = Object.assign({}, a, b);
  }
  out.created = created;
  return out;
}

/* ── 디스크 훑기 ────────────────────────────────────────────── */

function scanKind(id, kind) {
  let names;
  try {
    names = fs.readdirSync(resolveIn(id, kind));
  } catch {
    return [];
  }
  const rows = [];
  for (const name of names) {
    if (name.startsWith('.')) continue;                 // 점으로 시작하는 파일은 뺀다
    let st;
    try { st = fs.statSync(resolveIn(id, kind, name)); } catch { continue; }
    if (!st.isFile()) continue;
    rows.push({
      path: `${kind}/${name}`,
      kind,
      name,
      ext: path.extname(name).replace('.', '').toLowerCase(),
      size: st.size,                                    // 크기와 시각은 디스크 값
      at: st.mtime.toISOString(),
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  return rows;
}

/** out/ 안에서 이 문서의 PDF 를 찾는다 — 파일명 앞머리로 가른다. */
function pdfOf(files, doc) {
  const want = DOCS[doc].prefix;
  const hit = files.find(f => f.kind === 'out' && f.ext === 'pdf' && f.name.startsWith(want));
  return hit ? hit.path : null;
}

/**
 * 한 학교 상세. meta 가 아니라 디스크가 정본이다.
 * act 와 label 만 meta 에서 가져온다 — 디스크는 그걸 모른다.
 */
function detail(id) {
  const dir = resolveIn(id);
  if (!fs.existsSync(dir)) throw fail(404, '그런 폴더가 없습니다.');

  const meta = readMeta(id) || {};
  const known = meta.files || {};
  const files = [];
  for (const kind of KINDS) {
    for (const f of scanKind(id, kind)) {
      const k = known[f.path] || {};
      files.push(Object.assign({ act: k.act || null, label: k.label || null }, f));
    }
  }

  const docs = {};
  for (const doc of Object.keys(DOCS)) {
    const saved = meta[DOCS[doc].meta] || { status: 'none' };
    const pdf = pdfOf(files, doc);
    const state = Object.assign({}, saved, { label: DOCS[doc].label, pdf });
    /* PDF 가 디스크에 있으면 경로는 상태와 무관하게 늘 알려 주고,
       running 이 아닐 때만 done 으로 올린다.
       (running 일 때 감추면 서버가 중간에 죽었을 때 다 만든 리포트를 영영 못 연다) */
    if (pdf && state.status !== 'running') state.status = 'done';
    docs[doc] = state;
  }

  let st = null;
  try { st = fs.statSync(dir); } catch {}

  return {
    id,
    path: dir,
    school: meta.school || null,
    year: meta.year || null,
    created: meta.created || null,
    updated: meta.updated || (st ? st.mtime.toISOString() : null),
    files,
    count: files.length,
    bytes: files.reduce((n, f) => n + f.size, 0),
    docs,
    report: docs.full,                                   // 옛 자리
  };
}

function listAll() {
  let ids = [];
  try {
    ids = fs.readdirSync(ROOT).filter(n => {
      if (n.startsWith('.')) return false;
      try { return fs.statSync(path.join(ROOT, n)).isDirectory(); } catch { return false; }
    });
  } catch {}

  const schools = [];
  for (const id of ids) {
    try { schools.push(detail(id)); } catch {}
  }
  schools.sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || '')));

  return {
    root: path.resolve(ROOT),
    schools,
    count: schools.length,
    bytes: schools.reduce((n, s) => n + s.bytes, 0),
  };
}

/* ── 탐색기로 열기 ──────────────────────────────────────────── */

function reveal(target, isFile) {
  const p = process.platform;
  let cmd, args;
  if (p === 'win32') {
    cmd = 'explorer.exe';
    args = isFile ? ['/select,' + target] : [target];
  } else if (p === 'darwin') {
    cmd = 'open';
    args = isFile ? ['-R', target] : [target];
  } else {
    cmd = 'xdg-open';
    args = [isFile ? path.dirname(target) : target];
  }
  try {
    /* explorer 는 성공해도 종료코드 1 이다. 결과를 보지 말고 띄우기만 한다. */
    spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  } catch (e) {
    throw fail(500, '탐색기를 열지 못했습니다: ' + e.message);
  }
}

/* ── 핸들러 ─────────────────────────────────────────────────── */

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const q = req.query || {};

  try {
    /* ── GET ── */
    if (req.method === 'GET') {
      /* 폴더 id 를 물어본다. 브라우저는 collect.js 를 require 할 수 없어서
         규칙을 옮겨 적으면 반드시 어긋난다 — 여기서 진짜 folderId 로 답한다. */
      if (q.resolve) {
        if (!q.nm) throw fail(400, 'nm 이 필요합니다.');
        res.json({ ok: true, id: folderId(q.nm, q.year) });
        return;
      }
      if (!q.id) { res.json(listAll()); return; }
      res.json(detail(safeName(q.id)));
      return;
    }

    /* ── POST ── */
    if (req.method === 'POST') {
      const id = safeName(q.id || '');

      /* 탐색기로 열기 */
      if (q.reveal) {
        if (q.id === '__root__') {
          fs.mkdirSync(ROOT, { recursive: true });
          reveal(path.resolve(ROOT), false);
          res.json({ ok: true, path: path.resolve(ROOT) });
          return;
        }
        if (!id) throw fail(400, 'id 가 필요합니다.');
        const target = q.file ? resolveIn(id, ...String(q.file).split('/').map(keepName))
                              : resolveIn(id);
        if (!fs.existsSync(target)) throw fail(404, '그 자리에 파일이 없습니다.');
        reveal(target, !!q.file);
        res.json({ ok: true, path: target });
        return;
      }

      if (!id) throw fail(400, 'id 가 필요합니다.');

      /* meta 병합 */
      if (q.meta) {
        let patch;
        try {
          patch = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
        } catch {
          throw fail(400, 'meta 본문이 JSON 이 아닙니다.');
        }
        const merged = mergeMeta(readMeta(id) || {
          school: null, year: null, created: new Date().toISOString(),
          updated: null, files: {}, report: { status: 'none' },
        }, patch);
        if (patch.year != null) merged.year = String(patch.year);
        writeMeta(id, merged);
        res.json({ ok: true, id, meta: merged });
        return;
      }

      /* 파일 저장 */
      const kind = String(q.kind || 'raw');
      if (!KINDS.includes(kind)) throw fail(400, `kind 는 ${KINDS.join(' · ')} 중 하나입니다.`);

      const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body || ''), 'utf8');
      if (!body.length) throw fail(400, '빈 파일은 저장하지 않습니다.');

      const name = keepName(q.name);
      fs.mkdirSync(resolveIn(id, kind), { recursive: true });
      fs.writeFileSync(resolveIn(id, kind, name), body);

      const rel = `${kind}/${name}`;
      const meta = readMeta(id) || {
        school: null, year: null, created: new Date().toISOString(),
        updated: null, files: {}, report: { status: 'none' },
      };
      meta.files = meta.files || {};
      /* '저장됨' 판정을 act 와 label 로 한다(catalog.js 의 doneKeys) */
      meta.files[rel] = {
        act: q.act || null,
        label: q.label || null,
        size: body.length,
        at: new Date().toISOString(),
      };
      if (q.year) meta.year = String(q.year);
      writeMeta(id, meta);

      res.json({ ok: true, id, path: rel, size: body.length });
      return;
    }

    /* ── DELETE ── */
    if (req.method === 'DELETE') {
      const id = safeName(q.id || '');
      if (!id) throw fail(400, 'id 가 필요합니다.');

      if (q.file) {
        const rel = String(q.file).split('/').map(keepName);
        const target = resolveIn(id, ...rel);
        if (!fs.existsSync(target)) throw fail(404, '그 자리에 파일이 없습니다.');
        fs.rmSync(target);
        const meta = readMeta(id);
        if (meta && meta.files) { delete meta.files[rel.join('/')]; writeMeta(id, meta); }
        res.json({ ok: true, id, removed: rel.join('/') });
        return;
      }

      const dir = resolveIn(id);
      if (!fs.existsSync(dir)) throw fail(404, '그런 폴더가 없습니다.');
      fs.rmSync(dir, { recursive: true, force: true });
      res.json({ ok: true, id, removed: id });
      return;
    }

    throw fail(405, `${req.method} 는 받지 않습니다.`);
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: e.message });
  }
};

/* report.js 가 가져다 쓴다 */
module.exports.ROOT = ROOT;
module.exports.DOCS = DOCS;
module.exports.docOf = docOf;
module.exports.folderId = folderId;
module.exports.safeName = safeName;
module.exports.readMeta = readMeta;
module.exports.writeMeta = writeMeta;
module.exports.mergeMeta = mergeMeta;
module.exports.detail = detail;
module.exports.listAll = listAll;
module.exports.resolveIn = resolveIn;
