# 한국학원경영아카데미 - 대관신청 사이트

## 프로젝트 개요
- **이름**: 한국학원경영아카데미 대관신청 시스템
- **목표**: 교육시설 대관 신청을 위한 웹 기반 플랫폼
- **주요 기능**: 
  - 온라인 대관신청 폼
  - 자동 메일 발송 시스템
  - 시설 정보 및 위치 안내
  - 반응형 웹 디자인

## URL
- **개발 환경**: https://3000-inh5yfam55ap7uzyn3fbg-6532622b.e2b.dev
- **API 엔드포인트**: `/api/application` (POST)

## 현재 완성된 기능
1. ✅ **대관신청 폼**
   - 신청자 정보 입력 (이름, 연락처, 이메일)
   - 사용 일정 선택 (날짜, 시작/종료 시간)
   - 사용 목적 및 예상 인원 입력
   - 추가 요청사항 입력

2. ✅ **폼 유효성 검증**
   - 필수 항목 체크
   - 시간 논리 검증 (종료시간 > 시작시간)
   - 날짜 최소값 설정 (오늘 이후)

3. ✅ **시설 정보 제공**
   - 교육시설 사진 표시
   - 연락처 정보 (전화, 이메일, 주소)
   - 시설 운영 정보

4. ✅ **구글지도 연동**
   - 주소: 경기도 광명시 일직로 43, GIDC C동 1705호
   - 대중교통 안내 (KTX광명역 도보 5분)

5. ✅ **API 엔드포인트**
   - POST `/api/application`: 대관신청 접수
   - 자동 응답 메시지 생성

## 데이터 구조
- **신청서 데이터**: 
  ```json
  {
    "name": "신청자명",
    "phone": "연락처",
    "email": "이메일",
    "date": "사용일자",
    "startTime": "시작시간",
    "endTime": "종료시간",
    "purpose": "사용목적",
    "participants": "예상인원",
    "notes": "추가요청사항"
  }
  ```

## 연락처 정보
- **전화**: 010-8394-0484
- **이메일**: petcky@gmail.com
- **주소**: 경기도 광명시 일직로 43, GIDC C동 1705호

## 사용자 가이드
1. 웹사이트 접속
2. 대관신청서 작성 (모든 필수 항목 입력)
3. 신청하기 버튼 클릭
4. 확인 메시지 및 자동 응답 메일 수신
5. 담당자 연락 대기

## 아직 구현되지 않은 기능
1. ❌ **실제 메일 발송 시스템**
   - 현재는 콘솔 로그로만 확인 가능
   - Cloudflare Email API 또는 외부 메일 서비스 연동 필요

2. ❌ **관리자 페이지**
   - 신청 내역 조회 및 관리
   - 승인/거부 처리

3. ❌ **데이터베이스 연동**
   - 신청 데이터 영구 저장
   - Cloudflare D1 데이터베이스 활용

4. ❌ **예약 캘린더**
   - 기 예약된 시간 확인
   - 실시간 예약 현황

## 권장 다음 개발 단계
1. **실제 메일 발송 구현** (우선순위 높음)
2. **Cloudflare D1 데이터베이스 연동**
3. **관리자 대시보드 구축**
4. **예약 캘린더 시스템**
5. **SMS 알림 시스템**

## 배포
- **플랫폼**: Cloudflare Pages (준비됨)
- **상태**: ✅ 개발 환경 활성화
- **기술 스택**: Hono + TypeScript + TailwindCSS + FontAwesome
- **마지막 업데이트**: 2024-08-17

## 개발 환경 실행
```bash
# 의존성 설치
npm install

# 빌드
npm run build

# PM2로 개발 서버 실행
pm2 start ecosystem.config.cjs

# 서비스 테스트
curl http://localhost:3000
```

## 배포 명령어
```bash
# Cloudflare Pages 배포
npm run build
wrangler pages deploy dist --project-name webapp
```
## 배포 시간: Sun Aug 17 10:18:12 UTC 2025

---

## 원장님 소개 카드 (HTML)

첨부 이미지와 동일한 무대 디자인을 HTML/CSS/SVG로 재현한 소개 카드입니다.
이미지 파일이 아니라 순수 HTML이므로 이름·학원만 바꾸면 인원수만큼 자동 생성됩니다.

### 구성
- `data/members.csv` — 원본 명단 (`기수,이름,학원`)
- `scripts/make-logo.mjs` — KEBA 엠블럼 SVG 생성
- `scripts/make-stage.mjs` — 무대(커튼·배너·골드리본) 배경 SVG 생성
- `scripts/build-cards.mjs` — CSV → 카드 HTML 생성
- `public/cards/index.html` — 전체 목록(검색 + 카드 클릭 시 개별 페이지로 이동)
- `public/cards/card-001.html …` — 1인 1페이지 (이전/다음 화살표로 연결)
- `public/cards/import.html` — 구글시트에서 명단을 불러와 `members.csv`를 만드는 도구

### 접속 경로
- 목록: `/cards/` (메인 페이지 상단 “원장님 소개 카드 보기” 버튼)
- 개별: `/cards/card-001.html`
- 불러오기 도구: `/cards/import.html`

### 명단 갱신 방법
1. 브라우저에서 `/cards/import.html` 접속
2. 구글시트 주소를 넣고 **시트 불러오기** (시트는 “링크가 있는 모든 사용자 - 뷰어” 공유 필요)
   - 불러오기가 막히면 시트에서 표를 복사해 붙여넣기 칸에 그대로 붙여넣습니다
3. **members.csv 내려받기** → 프로젝트의 `data/members.csv` 에 덮어쓰기
4. 터미널에서 재생성

```bash
npm run cards
```

명단이 6명이면 `card-001.html ~ card-006.html` 이 만들어지고
목록 페이지와 이전/다음 링크가 모두 자동으로 연결됩니다.

### 글꼴
제목은 Google Fonts의 `Black Han Sans`(대체: Jua → 맑은 고딕)를 사용합니다.
이름이나 학원명이 길면 글자 크기가 자동으로 줄어듭니다.
