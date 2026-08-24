// 무대(커튼/배너/골드리본) 배경 SVG 생성기 — viewBox 1600x920
import { writeFileSync, mkdirSync } from 'node:fs'

const GOLD_STOPS = `
      <stop offset="0%" stop-color="#8a6a17"/>
      <stop offset="18%" stop-color="#e7cd80"/>
      <stop offset="38%" stop-color="#f7ecc0"/>
      <stop offset="58%" stop-color="#c9a227"/>
      <stop offset="80%" stop-color="#f0dc9c"/>
      <stop offset="100%" stop-color="#8a6a17"/>`

// 커튼 주름: 좌→우로 어둡고 밝은 띠가 반복되도록 stop 생성
function foldStops(reverse) {
  const tones = ['#08170d', '#123019', '#1f4a27', '#0e2715', '#050f08', '#1a4022', '#0a1f11', '#20492a', '#071409', '#143318', '#040c06']
  const list = reverse ? [...tones].reverse() : tones
  return list
    .map((c, i) => `      <stop offset="${((i / (list.length - 1)) * 100).toFixed(1)}%" stop-color="${c}"/>`)
    .join('\n')
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 920" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="78%">
      <stop offset="0%" stop-color="#585858"/>
      <stop offset="38%" stop-color="#3d3d3d"/>
      <stop offset="72%" stop-color="#1d1d1d"/>
      <stop offset="100%" stop-color="#000000"/>
    </radialGradient>
    <linearGradient id="topGreen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1d4324"/>
      <stop offset="55%" stop-color="#2a5c32"/>
      <stop offset="100%" stop-color="#173a1d"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">${GOLD_STOPS}
    </linearGradient>
    <linearGradient id="goldH" x1="0" y1="0" x2="1" y2="0">${GOLD_STOPS}
    </linearGradient>
    <linearGradient id="curtainL" x1="0" y1="0" x2="1" y2="0">
${foldStops(false)}
    </linearGradient>
    <linearGradient id="curtainR" x1="0" y1="0" x2="1" y2="0">
${foldStops(true)}
    </linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#111111"/>
      <stop offset="100%" stop-color="#000000"/>
    </linearGradient>
  </defs>

  <!-- 무대 배경 -->
  <rect width="1600" height="920" fill="url(#bg)"/>

  <!-- 상단 그린 배너 (가운데가 내려온 V자) -->
  <path d="M0 0 H1600 V150 L800 330 L0 150 Z" fill="url(#topGreen)"/>
  <!-- 배너 아래 골드 라인 -->
  <path d="M-10 150 L800 330 L1610 150" fill="none" stroke="url(#goldH)" stroke-width="16"/>
  <path d="M-10 108 L800 288 L1610 108" fill="none" stroke="url(#goldH)" stroke-width="6" opacity=".9"/>
  <path d="M-10 76 L800 256 L1610 76" fill="none" stroke="url(#goldH)" stroke-width="3" opacity=".65"/>

  <!-- 왼쪽 커튼 -->
  <g>
    <path d="M0 0 H248 C228 152 262 252 234 374 C208 488 254 562 218 670 C186 764 228 844 196 920 H0 Z" fill="url(#curtainL)"/>
    <path d="M248 0 C228 152 262 252 234 374 C208 488 254 562 218 670 C186 764 228 844 196 920" fill="none" stroke="#0a1a0f" stroke-width="6" opacity=".65"/>
    <path d="M254 4 C234 154 268 254 240 376 C214 490 260 564 224 672 C192 766 234 846 202 918" fill="none" stroke="url(#gold)" stroke-width="5" opacity=".55"/>
  </g>

  <!-- 오른쪽 커튼 -->
  <g transform="translate(1600 0) scale(-1 1)">
    <path d="M0 0 H248 C228 152 262 252 234 374 C208 488 254 562 218 670 C186 764 228 844 196 920 H0 Z" fill="url(#curtainR)"/>
    <path d="M248 0 C228 152 262 252 234 374 C208 488 254 562 218 670 C186 764 228 844 196 920" fill="none" stroke="#0a1a0f" stroke-width="6" opacity=".65"/>
    <path d="M254 4 C234 154 268 254 240 376 C214 490 260 564 224 672 C192 766 234 846 202 918" fill="none" stroke="url(#gold)" stroke-width="5" opacity=".55"/>
  </g>

  <!-- 바닥 어두운 곡면 -->
  <path d="M0 706 C 460 660 1020 806 1600 652 L1600 920 L0 920 Z" fill="url(#floor)"/>
  <!-- 골드 리본 -->
  <path d="M0 716 C 460 670 1020 816 1600 662 L1600 706 C 1020 860 460 714 0 760 Z" fill="url(#goldH)"/>
  <path d="M0 792 C 500 748 1040 884 1600 736 L1600 758 C 1040 906 500 770 0 814 Z" fill="url(#goldH)" opacity=".55"/>
  <!-- 최하단 블랙 -->
  <path d="M0 826 C 500 782 1040 918 1600 770 L1600 920 L0 920 Z" fill="#000000"/>
</svg>
`

mkdirSync('public/cards/assets', { recursive: true })
writeFileSync('public/cards/assets/stage.svg', svg)
console.log('wrote public/cards/assets/stage.svg')
