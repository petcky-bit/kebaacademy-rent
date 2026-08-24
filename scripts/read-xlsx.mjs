/**
 * 의존성 없는 최소 XLSX 리더.
 * zip(저장/deflate) 해제 → sharedStrings.xml + 첫 시트 → 문자열 2차원 배열.
 */
import { readFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'

/* ── ZIP 해제 ──────────────────────────────── */
function unzip(buf) {
  // End of Central Directory 찾기
  let eocd = -1
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('XLSX 파일이 아닙니다 (ZIP 구조를 찾을 수 없음)')

  const count = buf.readUInt16LE(eocd + 10)
  let off = buf.readUInt32LE(eocd + 16)
  const files = new Map()

  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break
    const method = buf.readUInt16LE(off + 10)
    const compSize = buf.readUInt32LE(off + 20)
    const nameLen = buf.readUInt16LE(off + 28)
    const extraLen = buf.readUInt16LE(off + 30)
    const commentLen = buf.readUInt16LE(off + 32)
    const localOff = buf.readUInt32LE(off + 42)
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen)

    // local header 에서 실제 데이터 시작 위치 계산
    const lNameLen = buf.readUInt16LE(localOff + 26)
    const lExtraLen = buf.readUInt16LE(localOff + 28)
    const start = localOff + 30 + lNameLen + lExtraLen
    const raw = buf.subarray(start, start + compSize)

    files.set(name, method === 0 ? raw : inflateRawSync(raw))
    off += 46 + nameLen + extraLen + commentLen
  }
  return files
}

/* ── XML 도우미 ────────────────────────────── */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
function decode(s) {
  return s.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(parseInt(e[1] === 'x' ? e.slice(2) : e.slice(1), e[1] === 'x' ? 16 : 10))
    return ENT[e] ?? m
  })
}

/** <t> 요소들의 텍스트를 이어붙임 */
function textOf(xml) {
  const out = []
  const re = /<t[^>]*\/>|<t[^>]*>([\s\S]*?)<\/t>/g
  let m
  while ((m = re.exec(xml))) out.push(decode(m[1] ?? ''))
  return out.join('')
}

function colIndex(ref) {
  const letters = (ref.match(/^[A-Z]+/) || ['A'])[0]
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

/* ── 메인 ─────────────────────────────────── */
export function readXlsx(path, sheetIndex = 0) {
  const files = unzip(readFileSync(path))

  // 공유 문자열
  const shared = []
  const ss = files.get('xl/sharedStrings.xml')
  if (ss) {
    const xml = ss.toString('utf8')
    const re = /<si>([\s\S]*?)<\/si>/g
    let m
    while ((m = re.exec(xml))) shared.push(textOf(m[1]))
  }

  // 시트 선택 (workbook.xml 순서 우선, 없으면 sheet1.xml)
  const sheetNames = [...files.keys()].filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
  const target = sheetNames[sheetIndex] || sheetNames[0]
  if (!target) throw new Error('워크시트를 찾을 수 없습니다')

  const xml = files.get(target).toString('utf8')
  const rows = []
  const rowRe = /<row[^>]*>([\s\S]*?)<\/row>|<row[^>]*\/>/g
  let rm
  while ((rm = rowRe.exec(xml))) {
    const body = rm[1] || ''
    const cells = []
    const cellRe = /<c([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g
    let cm
    while ((cm = cellRe.exec(body))) {
      const attrs = cm[1] || ''
      const inner = cm[2] || ''
      const ref = (attrs.match(/r="([A-Z]+\d+)"/) || [])[1]
      const type = (attrs.match(/t="([^"]+)"/) || [])[1]
      let value = ''
      if (type === 's') {
        const v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1]
        value = v != null ? (shared[Number(v)] ?? '') : ''
      } else if (type === 'inlineStr') {
        value = textOf(inner)
      } else if (type === 'str') {
        value = decode((inner.match(/<v>([\s\S]*?)<\/v>/) || [, ''])[1])
      } else {
        value = decode((inner.match(/<v>([\s\S]*?)<\/v>/) || [, ''])[1])
      }
      const i = ref ? colIndex(ref) : cells.length
      while (cells.length < i) cells.push('')
      cells[i] = value
    }
    rows.push(cells)
  }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''))
}

export default readXlsx
