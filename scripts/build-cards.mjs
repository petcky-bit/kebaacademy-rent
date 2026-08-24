#!/usr/bin/env node
/**
 * data/members.csv → public/cards/*.html 정적 페이지 생성
 *
 *   node scripts/build-cards.mjs [csv 또는 xlsx 경로]
 *
 * data/members.xlsx 가 있으면 우선 사용하고, 없으면 data/members.csv 를 씁니다.
 * 헤더는 기수,이름,학원 (또는 cohort,name,academy) 을 인식합니다.
 */
import { readFileSync, writeFileSync, readdirSync, unlinkSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { readXlsx } from './read-xlsx.mjs'

// 인자 > data/members.xlsx > data/members.csv 순으로 사용
const CSV_PATH =
  process.argv[2] ||
  (existsSync('data/members.xlsx') ? 'data/members.xlsx' : 'data/members.csv')
const OUT_DIR = 'public/cards'

/* ── CSV 파서 (따옴표/줄바꿈 포함 지원) ───────────── */
function parseCsv(text) {
  const rows = []
  let row = [], field = '', inQuotes = false
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ } else { inQuotes = false }
      } else field += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else field += ch
  }
  row.push(field)
  rows.push(row)
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

const HEADERS = {
  cohort: ['기수', '기수명', 'cohort', 'term', '과정', '차수'],
  name: ['이름', '성명', 'name', '수강생', '원장', '원장명'],
  academy: ['학원', '학원명', 'academy', 'school', '소속', '기관'],
}

function pickColumns(header) {
  const norm = header.map((h) => h.trim().toLowerCase())
  const find = (keys) => norm.findIndex((h) => keys.some((k) => h === k.toLowerCase() || h.includes(k.toLowerCase())))
  return {
    cohort: find(HEADERS.cohort),
    name: find(HEADERS.name),
    academy: find(HEADERS.academy),
  }
}

function loadMembers(path) {
  const rows = /\.xlsx$/i.test(path)
    ? readXlsx(path).map((r) => r.map((c) => String(c ?? '')))
    : parseCsv(readFileSync(path, 'utf8'))
  if (rows.length === 0) return []
  const idx = pickColumns(rows[0])
  const hasHeader = idx.name !== -1 || idx.academy !== -1
  const body = hasHeader ? rows.slice(1) : rows
  const col = hasHeader ? idx : { cohort: 0, name: 1, academy: 2 }
  return body
    .map((r) => ({
      cohort: (col.cohort > -1 ? r[col.cohort] : '')?.trim() || '',
      name: (col.name > -1 ? r[col.name] : '')?.trim() || '',
      academy: (col.academy > -1 ? r[col.academy] : '')?.trim() || '',
    }))
    .filter((m) => m.name || m.academy)
}

/* ── 유틸 ────────────────────────────────────── */
const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const pad = (n) => String(n).padStart(3, '0')
const fileOf = (i) => `card-${pad(i + 1)}.html`

/** 글자 수에 따라 자동 축소 클래스 */
function sizeClass(text, base, long, xlong) {
  const len = [...text].length
  if (len > xlong) return ' is-xlong'
  if (len > long) return ' is-long'
  return ''
}

const HEAD = (title, desc) => `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<link rel="icon" href="assets/keba-logo.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Jua&family=Noto+Sans+KR:wght@400;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/card.css">`

/* ── 무대 카드 마크업 ────────────────────────── */
function stageMarkup(m, { logo = true } = {}) {
  const title = [m.cohort, m.name].filter(Boolean).join(' ')
  return `<div class="stage">
      <img class="stage__bg" src="assets/stage.svg" alt="">
      <div class="stage__inner">
        ${logo ? `<img class="stage__logo" src="assets/keba-logo.svg" alt="한국학원경영아카데미 KEBA 엠블럼">` : ''}
        <h1 class="stage__title${sizeClass(title, 9, 9, 14)}">${esc(title)}</h1>
        <p class="stage__subtitle${sizeClass(m.academy, 8, 8, 13)}">${esc(m.academy)}</p>
      </div>
    </div>`
}

/* ── 개별 카드 페이지 ────────────────────────── */
function cardPage(m, i, all) {
  const prev = i > 0 ? fileOf(i - 1) : null
  const next = i < all.length - 1 ? fileOf(i + 1) : null
  const title = [m.cohort, m.name].filter(Boolean).join(' ')
  return `<!doctype html>
<html lang="ko">
<head>
${HEAD(`${title}${m.academy ? ' · ' + m.academy : ''} | 한국학원경영아카데미`, `${title} / ${m.academy}`)}
</head>
<body>
<div class="page">
  <div class="topbar">
    <a class="brand" href="index.html">
      <img src="assets/keba-logo.svg" alt=""><span>한국학원경영아카데미</span>
    </a>
    <a class="btn" href="index.html">← 전체 목록</a>
  </div>

  ${stageMarkup(m)}

  <nav class="cardnav">
    <a class="btn" href="${prev || '#'}"${prev ? '' : ' aria-disabled="true"'}>← 이전</a>
    <span class="cardnav__count">${i + 1} / ${all.length}</span>
    <a class="btn" href="${next || '#'}"${next ? '' : ' aria-disabled="true"'}>다음 →</a>
  </nav>

  <div class="foot">
    한국학원경영아카데미 · 경기도 광명시 일직로 43, GIDC C동 1705호<br>
    문의 010-8394-0484 · <a href="mailto:petcky@gmail.com">petcky@gmail.com</a>
  </div>
</div>
<script>
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft' && ${prev ? `'${prev}'` : 'null'}) location.href = ${prev ? `'${prev}'` : 'location.href'};
    if (e.key === 'ArrowRight' && ${next ? `'${next}'` : 'null'}) location.href = ${next ? `'${next}'` : 'location.href'};
  });
</script>
</body>
</html>
`
}

/* ── 목록 페이지 ────────────────────────────── */
function indexPage(members) {
  const items = members
    .map((m, i) => {
      const title = [m.cohort, m.name].filter(Boolean).join(' ')
      return `      <li class="grid__item" data-search="${esc((m.name + ' ' + m.academy + ' ' + m.cohort).toLowerCase())}">
        <a href="${fileOf(i)}">
          ${stageMarkup(m)}
          <div class="grid__meta">
            <div class="grid__name">${esc(m.name || '—')}</div>
            <div class="grid__academy">${esc(m.academy || '')}</div>
            <div class="grid__cohort">${esc(m.cohort || '')}</div>
          </div>
        </a>
      </li>`
    })
    .join('\n')

  return `<!doctype html>
<html lang="ko">
<head>
${HEAD('한국학원경영아카데미 소개 카드', '한국학원경영아카데미 원장님 소개 카드 모음')}
</head>
<body>
<div class="page">
  <div class="list">
    <div class="list__head">
      <img src="assets/keba-logo.svg" alt="한국학원경영아카데미 KEBA 엠블럼">
      <h1>한국학원경영아카데미</h1>
      <p>원장님 소개 카드 · 총 <strong id="total">${members.length}</strong>명</p>
      <input class="search" id="q" type="search" placeholder="이름 · 학원 · 기수로 검색" autocomplete="off">
      <p style="margin-top:14px"><a class="btn" href="import.html">구글시트에서 명단 불러오기</a></p>
    </div>

    <ul class="grid" id="grid">
${items}
    </ul>
    <p class="empty" id="empty" hidden>검색 결과가 없습니다.</p>

    <div class="foot">
      한국학원경영아카데미 · 경기도 광명시 일직로 43, GIDC C동 1705호<br>
      문의 010-8394-0484 · <a href="mailto:petcky@gmail.com">petcky@gmail.com</a>
    </div>
  </div>
</div>
<script>
  var q = document.getElementById('q');
  var items = Array.prototype.slice.call(document.querySelectorAll('.grid__item'));
  var empty = document.getElementById('empty');
  q.addEventListener('input', function () {
    var v = q.value.trim().toLowerCase();
    var shown = 0;
    items.forEach(function (li) {
      var hit = !v || li.dataset.search.indexOf(v) !== -1;
      li.hidden = !hit;
      if (hit) shown++;
    });
    empty.hidden = shown !== 0;
  });
</script>
</body>
</html>
`
}

/* ── 실행 ───────────────────────────────────── */
const members = loadMembers(CSV_PATH)
if (members.length === 0) {
  console.error(`[build-cards] ${CSV_PATH} 에 데이터가 없습니다.`)
  process.exit(1)
}

mkdirSync(OUT_DIR, { recursive: true })
for (const f of readdirSync(OUT_DIR)) {
  if (/^card-\d+\.html$/.test(f)) unlinkSync(join(OUT_DIR, f))
}

members.forEach((m, i) => writeFileSync(join(OUT_DIR, fileOf(i)), cardPage(m, i, members)))
writeFileSync(join(OUT_DIR, 'index.html'), indexPage(members))

console.log(`[build-cards] ${members.length}명 · ${OUT_DIR}/index.html + card-001..${pad(members.length)}.html 생성 완료`)
