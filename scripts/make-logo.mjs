// KEBA 엠블럼 SVG 생성기 (월계관 잎 좌표를 계산해 정적 SVG로 출력)
import { writeFileSync, mkdirSync } from 'node:fs'

const CX = 200, CY = 200
const GREEN = '#2b6b38'
const GOLD = '#c9a227'
const CREAM = '#f4f2e7'

const rad = (d) => (d * Math.PI) / 180

// 잎 하나: 중심에서 바깥으로 뻗는 형태
function leaf(angleDeg, radius, scale, flip) {
  const x = CX + Math.cos(rad(angleDeg)) * radius
  const y = CY + Math.sin(rad(angleDeg)) * radius
  const tilt = angleDeg + (flip ? -118 : 118)
  return `    <use href="#leaf" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${tilt.toFixed(1)}) scale(${scale.toFixed(2)})"/>`
}

// 왼쪽 가지: 위(-105°)에서 아래(75°)까지, 오른쪽은 대칭
const leaves = []
const steps = 11
for (let i = 0; i < steps; i++) {
  const t = i / (steps - 1)
  const scale = 0.72 + 0.5 * Math.sin(Math.PI * (0.18 + 0.72 * t))
  const aL = -108 + t * 186   // 왼쪽 아래방향(시계 반대) 진행
  leaves.push(leaf(180 - aL + 180, 158, scale, false)) // 오른쪽 가지
  leaves.push(leaf(aL + 180, 158, scale, true))        // 왼쪽 가지
}

// 안쪽 작은 잎(겹침 표현)
const innerLeaves = []
for (let i = 0; i < 9; i++) {
  const t = i / 8
  const scale = 0.42 + 0.24 * Math.sin(Math.PI * (0.2 + 0.7 * t))
  const aL = -96 + t * 168
  innerLeaves.push(leaf(180 - aL + 180, 136, scale, false))
  innerLeaves.push(leaf(aL + 180, 136, scale, true))
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img" aria-label="한국학원경영아카데미 KEBA 엠블럼">
  <defs>
    <linearGradient id="ring" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f3dd9a"/>
      <stop offset="35%" stop-color="${GOLD}"/>
      <stop offset="60%" stop-color="#8f6f1c"/>
      <stop offset="100%" stop-color="#e8cf82"/>
    </linearGradient>
    <path id="leaf" d="M0 0 C 9 -13 27 -17 40 -9 C 28 5 9 8 0 0 Z"/>
    <clipPath id="innerClip"><circle cx="${CX}" cy="${CY}" r="118"/></clipPath>
  </defs>

  <circle cx="${CX}" cy="${CY}" r="196" fill="url(#ring)"/>
  <circle cx="${CX}" cy="${CY}" r="184" fill="${CREAM}"/>
  <circle cx="${CX}" cy="${CY}" r="178" fill="none" stroke="${GOLD}" stroke-width="2" opacity=".55"/>

  <g fill="${GREEN}">
${leaves.join('\n')}
  </g>
  <g fill="#3f8248">
${innerLeaves.join('\n')}
  </g>
  <!-- 아래쪽 줄기 교차 -->
  <g stroke="${GREEN}" stroke-width="5" fill="none" stroke-linecap="round">
    <path d="M170 336 C 186 348 214 348 232 334"/>
    <path d="M232 336 C 214 348 186 348 168 334"/>
  </g>

  <g clip-path="url(#innerClip)">
    <!-- 하단 그린 밴드 -->
    <path d="M60 232 C 120 214 280 214 340 232 L340 340 L60 340 Z" fill="${GREEN}"/>
    <!-- 신전 건물 -->
    <g fill="${GREEN}">
      <path d="M200 92 L288 132 L112 132 Z"/>
      <rect x="112" y="136" width="176" height="12"/>
      <rect x="126" y="152" width="22" height="56" rx="3"/>
      <rect x="166" y="152" width="22" height="56" rx="3"/>
      <rect x="212" y="152" width="22" height="56" rx="3"/>
      <rect x="252" y="152" width="22" height="56" rx="3"/>
      <rect x="112" y="210" width="176" height="12"/>
      <rect x="100" y="224" width="200" height="10"/>
    </g>
  </g>

  <text x="${CX}" y="298" text-anchor="middle" fill="#ffffff"
        font-family="Georgia, 'Times New Roman', serif" font-size="58" font-weight="700"
        letter-spacing="4">KEBA</text>
</svg>
`

mkdirSync('public/cards/assets', { recursive: true })
writeFileSync('public/cards/assets/keba-logo.svg', svg)
console.log('wrote public/cards/assets/keba-logo.svg')
