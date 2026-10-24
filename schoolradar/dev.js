// 스쿨레이더 로컬 개발 서버
//
// Node 내장 http 만 쓴다. 의존성 없음.
//   /api/<이름>  ->  api/<이름>.js 를 require 해서 (req, res) 로 넘긴다
//   /vault/...   ->  vault/ 서빙 (여기에만 Content-Disposition)
//   그 밖        ->  public/ 정적 서빙
//
// 로컬 전용. 인증·로그인 없음.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const VAULT_DIR = path.join(ROOT, 'vault');
const API_DIR = path.join(ROOT, 'api');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
  '.csv': 'text/csv; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

// vault 에서 브라우저 안에 바로 띄울 확장자. 나머지는 내려받기.
const INLINE = new Set(['.pdf', '.png', '.svg', '.txt', '.md', '.csv', '.json', '.html']);

function mimeOf(p) {
  return MIME[path.extname(p).toLowerCase()] || 'application/octet-stream';
}

// 핸들러가 쓸 res.status / res.json / res.send
function decorate(res) {
  res.status = (n) => { res.statusCode = n; return res; };
  res.json = (o) => {
    if (!res.headersSent) res.setHeader('Content-Type', MIME['.json']);
    res.end(JSON.stringify(o));
    return res;
  };
  res.send = (b) => {
    res.end(Buffer.isBuffer(b) ? b : String(b));
    return res;
  };
  return res;
}

// 폴더 밖으로 나가는 경로는 null. (.. 가 섞인 요청 -> 403)
function safeJoin(dir, rel) {
  const full = path.resolve(dir, '.' + path.posix.normalize('/' + rel));
  if (full !== dir && !full.startsWith(dir + path.sep)) return null;
  return full;
}

function collectBody(req, cb) {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('error', () => cb(Buffer.alloc(0)));
  req.on('end', () => {
    const buf = Buffer.concat(chunks);
    const ct = String(req.headers['content-type'] || '').toLowerCase();
    // 텍스트로 다룰 것만 문자열. 나머지는 Buffer 그대로 — 파일이 지나가기 때문이다.
    const asText =
      ct.startsWith('application/json') ||
      ct.startsWith('text/') ||
      ct.startsWith('application/x-www-form-urlencoded');
    cb(asText ? buf.toString('utf8') : buf);
  });
}

function sendFile(req, res, full, { disposition } = {}) {
  let st;
  try {
    st = fs.statSync(full);
  } catch {
    return res.status(404).json({ error: 'not found' });
  }
  if (st.isDirectory()) return res.status(404).json({ error: 'not found' });

  res.statusCode = 200;
  res.setHeader('Content-Type', mimeOf(full));
  res.setHeader('Content-Length', st.size);
  if (disposition) res.setHeader('Content-Disposition', disposition);

  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(full).on('error', () => res.destroy()).pipe(res);
}

// 한글 파일명을 살린다
function contentDisposition(kind, name) {
  return `${kind}; filename*=UTF-8''${encodeURIComponent(name)}`;
}

const server = http.createServer((req, res) => {
  decorate(res);
  res.setHeader('Cache-Control', 'no-store');

  let url;
  try {
    url = new URL(req.url, 'http://localhost');
  } catch {
    return res.status(400).json({ error: 'bad request' });
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return res.status(400).json({ error: 'bad path' });
  }

  // 폴더 밖으로 나가려는 요청.
  // new URL 이 .. 를 먼저 접어 버리므로 정규화 전의 원본 경로를 본다.
  let rawPath;
  try {
    rawPath = decodeURIComponent(req.url.split(/[?#]/)[0]);
  } catch {
    return res.status(400).json({ error: 'bad path' });
  }
  if (rawPath.split(/[/\\]/).includes('..')) {
    return res.status(403).json({ error: 'forbidden' });
  }

  req.query = Object.fromEntries(url.searchParams);

  // ── /api/<이름> ──────────────────────────────────────────────
  // 이름을 목록으로 박지 않는다 — api 파일은 뒤에서 계속 늘어난다.
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    const name = pathname.slice('/api/'.length);
    if (!/^[A-Za-z0-9_-]+$/.test(name)) {
      return res.status(404).json({ error: `no such api: ${name}` });
    }
    const modPath = path.join(API_DIR, name + '.js');
    if (!fs.existsSync(modPath)) {
      return res.status(404).json({ error: `no such api: ${name}` });
    }

    const fail = (err) => {
      const msg = (err && err.message) || String(err);
      if (res.headersSent) return res.destroy();
      res.status(500).json({ error: msg });
    };

    const run = () => {
      let handler;
      try {
        handler = require(modPath);
        if (typeof handler !== 'function' && handler && typeof handler.default === 'function') {
          handler = handler.default;
        }
        if (typeof handler !== 'function') throw new Error(`api/${name}.js does not export a function`);
      } catch (err) {
        return fail(err);
      }
      try {
        const out = handler(req, res);
        if (out && typeof out.then === 'function') out.then(undefined, fail);
      } catch (err) {
        fail(err);
      }
    };

    if (req.method === 'GET' || req.method === 'HEAD') {
      req.body = undefined;
      return run();
    }
    return collectBody(req, (body) => {
      req.body = body;
      run();
    });
  }

  // ── /vault/... ───────────────────────────────────────────────
  // Content-Disposition 은 이쪽에만 붙인다.
  if (pathname === '/vault' || pathname.startsWith('/vault/')) {
    const rel = pathname.slice('/vault'.length) || '/';
    const full = safeJoin(VAULT_DIR, rel);
    if (!full) return res.status(403).json({ error: 'forbidden' });

    const ext = path.extname(full).toLowerCase();
    const forced = 'dl' in req.query;            // ?dl -> 무조건 내려받기
    const kind = !forced && INLINE.has(ext) ? 'inline' : 'attachment';
    return sendFile(req, res, full, {
      disposition: contentDisposition(kind, path.basename(full)),
    });
  }

  // ── public/ 정적 ─────────────────────────────────────────────
  // 여기엔 Content-Disposition 을 붙이지 않는다 — 브라우저가 style.css 를 내려받으려 한다.
  const rel = pathname === '/' ? '/index.html' : pathname;
  let full = safeJoin(PUBLIC_DIR, rel);
  if (!full) return res.status(403).json({ error: 'forbidden' });
  if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
    full = path.join(full, 'index.html');
  }
  return sendFile(req, res, full);
});

server.listen(PORT, () => {
  console.log(`스쿨레이더  http://localhost:${PORT}`);
  console.log(`vault       ${VAULT_DIR}`);
});
