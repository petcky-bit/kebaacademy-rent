import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

const app = new Hono()

let applications: any[] = []
let applicationIdCounter = 1

const ADMIN_PASSWORD = 'admin123'

app.use('/api/*', cors())
app.use('/static/*', serveStatic({ root: './public' }))

// ─── APIs ────────────────────────────────────────────────────────────────────

app.post('/api/application', async (c) => {
  try {
    const formData = await c.req.json()
    const application = {
      id: applicationIdCounter++,
      ...formData,
      status: 'pending',
      submittedAt: new Date().toISOString(),
    }
    applications.push(application)
    return c.json({ success: true, message: '대관신청이 성공적으로 접수되었습니다.', applicationId: application.id })
  } catch {
    return c.json({ success: false, message: '신청 처리 중 오류가 발생했습니다.' }, 500)
  }
})

app.post('/api/admin/login', async (c) => {
  try {
    const { password } = await c.req.json()
    if (password === ADMIN_PASSWORD) return c.json({ success: true })
    return c.json({ success: false, message: '비밀번호가 틀렸습니다.' }, 401)
  } catch {
    return c.json({ success: false, message: '로그인 처리 중 오류가 발생했습니다.' }, 500)
  }
})

app.get('/api/admin/applications', async (c) => {
  const password = c.req.header('Authorization')?.replace('Bearer ', '')
  if (password !== ADMIN_PASSWORD) return c.json({ success: false, message: '인증이 필요합니다.' }, 401)
  return c.json({ success: true, applications: applications.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()) })
})

app.put('/api/admin/applications/:id/status', async (c) => {
  const password = c.req.header('Authorization')?.replace('Bearer ', '')
  if (password !== ADMIN_PASSWORD) return c.json({ success: false, message: '인증이 필요합니다.' }, 401)
  try {
    const id = parseInt(c.req.param('id'))
    const { status, notes } = await c.req.json()
    const idx = applications.findIndex(a => a.id === id)
    if (idx === -1) return c.json({ success: false, message: '신청을 찾을 수 없습니다.' }, 404)
    applications[idx] = { ...applications[idx], status, adminNotes: notes, updatedAt: new Date().toISOString() }
    return c.json({ success: true, application: applications[idx] })
  } catch {
    return c.json({ success: false, message: '상태 업데이트 중 오류가 발생했습니다.' }, 500)
  }
})

// 학교알리미 API
const NEIS_API_KEY = '1aeafbe191b946558d453d9e357f284a'
const NEIS_BASE = 'https://open.neis.go.kr/hub'

app.get('/api/school/search', async (c) => {
  const name = c.req.query('name') || ''
  const region = c.req.query('region') || ''
  const page = c.req.query('page') || '1'
  if (!name) return c.json({ success: false, message: '학교명을 입력해주세요.' }, 400)
  try {
    const params = new URLSearchParams({ KEY: NEIS_API_KEY, Type: 'json', pIndex: page, pSize: '20', SCHUL_NM: name })
    if (region) params.set('ATPT_OFCDC_SC_CODE', region)
    const res = await fetch(`${NEIS_BASE}/schoolInfo?${params}`)
    const data: any = await res.json()
    if (data.RESULT?.CODE === 'INFO-200') return c.json({ success: true, schools: [], total: 0 })
    if (!data.schoolInfo) return c.json({ success: false, message: '조회 결과가 없습니다.' }, 404)
    return c.json({ success: true, schools: data.schoolInfo[1].row, total: data.schoolInfo[0].head[0].list_total_count })
  } catch {
    return c.json({ success: false, message: 'API 호출 중 오류가 발생했습니다.' }, 500)
  }
})

app.get('/api/school/detail', async (c) => {
  const sdCode = c.req.query('sdCode') || ''
  const schulCode = c.req.query('schulCode') || ''
  if (!sdCode || !schulCode) return c.json({ success: false, message: '학교 코드가 필요합니다.' }, 400)
  try {
    const params = new URLSearchParams({ KEY: NEIS_API_KEY, Type: 'json', pIndex: '1', pSize: '1', ATPT_OFCDC_SC_CODE: sdCode, SD_SCHUL_CODE: schulCode })
    const res = await fetch(`${NEIS_BASE}/schoolInfo?${params}`)
    const data: any = await res.json()
    if (!data.schoolInfo) return c.json({ success: false, message: '학교 정보를 찾을 수 없습니다.' }, 404)
    return c.json({ success: true, school: data.schoolInfo[1].row[0] })
  } catch {
    return c.json({ success: false, message: 'API 호출 중 오류가 발생했습니다.' }, 500)
  }
})

// ─── 공통 CSS / 레이아웃 ──────────────────────────────────────────────────────

const COMMON_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Pretendard:wght@300;400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif; background: #f8f9fc; color: #1a1d27; }

  :root {
    --primary: #3b5bdb;
    --primary-dark: #2f4ac7;
    --primary-light: #eef2ff;
    --accent: #5c7cfa;
    --success: #2f9e44;
    --warning: #e67700;
    --danger: #c92a2a;
    --gray-50: #f8f9fa;
    --gray-100: #f1f3f5;
    --gray-200: #e9ecef;
    --gray-300: #dee2e6;
    --gray-400: #ced4da;
    --gray-500: #adb5bd;
    --gray-600: #868e96;
    --gray-700: #495057;
    --gray-800: #343a40;
    --gray-900: #212529;
    --radius: 12px;
    --radius-sm: 8px;
    --shadow-sm: 0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
    --shadow: 0 4px 12px rgba(0,0,0,.07), 0 1px 3px rgba(0,0,0,.04);
    --shadow-lg: 0 12px 32px rgba(0,0,0,.1), 0 4px 8px rgba(0,0,0,.05);
  }

  a { color: inherit; text-decoration: none; }

  /* NAV */
  .nav {
    position: sticky; top: 0; z-index: 100;
    background: rgba(255,255,255,.92);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--gray-200);
    padding: 0 2rem;
    height: 64px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .nav-brand { display: flex; align-items: center; gap: .6rem; font-size: 1.05rem; font-weight: 700; color: var(--primary); }
  .nav-brand svg { width: 28px; height: 28px; }
  .nav-links { display: flex; gap: .25rem; }
  .nav-link {
    padding: .45rem .9rem; border-radius: var(--radius-sm);
    font-size: .875rem; font-weight: 500; color: var(--gray-700);
    transition: background .15s, color .15s;
  }
  .nav-link:hover { background: var(--primary-light); color: var(--primary); }
  .nav-link.active { background: var(--primary-light); color: var(--primary); }
  .nav-link.btn-primary {
    background: var(--primary); color: #fff;
  }
  .nav-link.btn-primary:hover { background: var(--primary-dark); }

  /* HERO */
  .hero {
    background: linear-gradient(135deg, #1e3a8a 0%, #3b5bdb 50%, #5c7cfa 100%);
    color: #fff;
    padding: 5rem 2rem 4rem;
    text-align: center;
    position: relative;
    overflow: hidden;
  }
  .hero::before {
    content: '';
    position: absolute; inset: 0;
    background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  }
  .hero-badge {
    display: inline-flex; align-items: center; gap: .4rem;
    background: rgba(255,255,255,.15); border: 1px solid rgba(255,255,255,.25);
    border-radius: 999px; padding: .3rem .9rem;
    font-size: .8rem; font-weight: 500; margin-bottom: 1.5rem;
    backdrop-filter: blur(8px);
  }
  .hero h1 { font-size: clamp(1.8rem, 4vw, 3rem); font-weight: 700; line-height: 1.2; margin-bottom: 1rem; }
  .hero p { font-size: 1.05rem; color: rgba(255,255,255,.8); max-width: 560px; margin: 0 auto 2.5rem; line-height: 1.7; }
  .hero-actions { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
  .btn { display: inline-flex; align-items: center; gap: .4rem; padding: .7rem 1.5rem; border-radius: var(--radius-sm); font-size: .9rem; font-weight: 600; cursor: pointer; transition: all .18s; border: none; }
  .btn-white { background: #fff; color: var(--primary); }
  .btn-white:hover { background: var(--primary-light); transform: translateY(-1px); box-shadow: var(--shadow); }
  .btn-outline-white { background: transparent; color: #fff; border: 1.5px solid rgba(255,255,255,.6); }
  .btn-outline-white:hover { background: rgba(255,255,255,.1); }

  /* CARDS */
  .card { background: #fff; border-radius: var(--radius); box-shadow: var(--shadow); }
  .section { max-width: 1100px; margin: 0 auto; padding: 3.5rem 2rem; }
  .section-title { font-size: 1.5rem; font-weight: 700; color: var(--gray-900); margin-bottom: .5rem; }
  .section-sub { color: var(--gray-600); font-size: .95rem; margin-bottom: 2rem; }

  /* FORM */
  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  .form-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; }
  @media(max-width: 640px) { .form-grid, .form-grid-3 { grid-template-columns: 1fr; } }
  .form-field { display: flex; flex-direction: column; gap: .4rem; }
  .form-field label { font-size: .82rem; font-weight: 600; color: var(--gray-700); letter-spacing: .01em; }
  .form-field input, .form-field select, .form-field textarea {
    padding: .65rem .9rem; border: 1.5px solid var(--gray-200);
    border-radius: var(--radius-sm); font-size: .9rem; font-family: inherit;
    color: var(--gray-900); background: var(--gray-50);
    transition: border-color .15s, background .15s, box-shadow .15s;
    outline: none;
  }
  .form-field input:focus, .form-field select:focus, .form-field textarea:focus {
    border-color: var(--primary); background: #fff;
    box-shadow: 0 0 0 3px rgba(59,91,219,.1);
  }
  .form-field textarea { resize: vertical; min-height: 100px; }
  .btn-primary { background: var(--primary); color: #fff; width: 100%; justify-content: center; padding: .85rem; font-size: .95rem; border-radius: var(--radius-sm); }
  .btn-primary:hover { background: var(--primary-dark); transform: translateY(-1px); box-shadow: 0 4px 14px rgba(59,91,219,.35); }
  .btn-primary:disabled { opacity: .6; transform: none; box-shadow: none; cursor: not-allowed; }

  /* INFO CARDS */
  .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
  .info-item { display: flex; align-items: flex-start; gap: .75rem; padding: 1.1rem; background: var(--gray-50); border-radius: var(--radius-sm); border: 1px solid var(--gray-200); }
  .info-icon { width: 36px; height: 36px; background: var(--primary-light); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--primary); flex-shrink: 0; }
  .info-icon svg { width: 18px; height: 18px; }
  .info-label { font-size: .75rem; color: var(--gray-500); font-weight: 500; margin-bottom: .15rem; }
  .info-value { font-size: .9rem; font-weight: 600; color: var(--gray-800); }

  /* DIVIDER */
  .divider { height: 1px; background: var(--gray-200); margin: 0; }

  /* FOOTER */
  footer { background: var(--gray-900); color: var(--gray-400); padding: 2.5rem 2rem; text-align: center; }
  footer strong { color: #fff; }
  footer p { font-size: .85rem; line-height: 1.8; }

  /* TOAST */
  #toast {
    position: fixed; bottom: 2rem; right: 2rem; z-index: 9999;
    background: var(--gray-900); color: #fff;
    padding: .8rem 1.4rem; border-radius: var(--radius-sm);
    font-size: .875rem; font-weight: 500;
    box-shadow: var(--shadow-lg);
    transform: translateY(8px); opacity: 0;
    transition: all .25s; pointer-events: none;
  }
  #toast.show { transform: translateY(0); opacity: 1; }
  #toast.success { background: #1b4332; border-left: 3px solid #40c057; }
  #toast.error { background: #3b0f0f; border-left: 3px solid #f03e3e; }
`

const NAV_HTML = (active: string) => `
  <nav class="nav">
    <a href="/" class="nav-brand">
      <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="28" height="28" rx="7" fill="#3b5bdb"/>
        <path d="M5 20L14 8L23 20H5Z" fill="white" opacity=".9"/>
        <rect x="11" y="15" width="6" height="5" rx="1" fill="white"/>
      </svg>
      한국학원경영아카데미
    </a>
    <div class="nav-links">
      <a href="/" class="nav-link ${active === 'home' ? 'active' : ''}">대관신청</a>
      <a href="/school" class="nav-link ${active === 'school' ? 'active' : ''}">학교 조회</a>
      <a href="/admin" class="nav-link btn-primary">관리자</a>
    </div>
  </nav>
`

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>한국학원경영아카데미 — 교육시설 대관신청</title>
  <style>${COMMON_CSS}
    .layout { display: grid; grid-template-columns: 1fr 380px; gap: 2rem; align-items: start; }
    @media(max-width: 900px) { .layout { grid-template-columns: 1fr; } }
    .step-header { display: flex; align-items: center; gap: .6rem; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--gray-100); }
    .step-num { width: 28px; height: 28px; background: var(--primary); color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: .8rem; font-weight: 700; flex-shrink: 0; }
    .step-title { font-size: 1rem; font-weight: 700; color: var(--gray-800); }
    .map-container { border-radius: var(--radius-sm); overflow: hidden; height: 220px; background: var(--gray-100); }
    .map-container iframe { width: 100%; height: 100%; border: 0; display: block; }
    .feature-row { display: flex; gap: .5rem; flex-wrap: wrap; margin-top: .75rem; }
    .feature-tag { font-size: .75rem; padding: .3rem .7rem; background: var(--primary-light); color: var(--primary); border-radius: 999px; font-weight: 500; }
  </style>
</head>
<body>
  ${NAV_HTML('home')}

  <div class="hero">
    <div class="hero-badge">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><circle cx="6" cy="6" r="5"/></svg>
      교육시설 대관 서비스
    </div>
    <h1>전문 교육공간을<br>합리적으로 이용하세요</h1>
    <p>최신 AV 장비와 쾌적한 환경을 갖춘<br>한국학원경영아카데미 교육시설을 대관하실 수 있습니다.</p>
    <div class="hero-actions">
      <a href="#form" class="btn btn-white">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h12M2 12h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        바로 신청하기
      </a>
      <a href="#info" class="btn btn-outline-white">시설 안내 보기</a>
    </div>
  </div>

  <div class="section">
    <div class="layout">
      <!-- 신청 폼 -->
      <div>
        <div id="form" class="card" style="padding: 2rem;">
          <div class="step-header">
            <div class="step-num">1</div>
            <span class="step-title">대관신청서 작성</span>
          </div>

          <form id="applicationForm" style="display:flex; flex-direction:column; gap:1rem;">
            <div class="form-grid">
              <div class="form-field">
                <label>신청자명 <span style="color:var(--primary)">*</span></label>
                <input type="text" name="name" placeholder="홍길동" required>
              </div>
              <div class="form-field">
                <label>연락처 <span style="color:var(--primary)">*</span></label>
                <input type="tel" name="phone" placeholder="010-0000-0000" required>
              </div>
            </div>

            <div class="form-field">
              <label>이메일 <span style="color:var(--primary)">*</span></label>
              <input type="email" name="email" placeholder="example@email.com" required>
            </div>

            <div class="form-grid-3">
              <div class="form-field">
                <label>사용일자 <span style="color:var(--primary)">*</span></label>
                <input type="date" name="date" required>
              </div>
              <div class="form-field">
                <label>시작시간 <span style="color:var(--primary)">*</span></label>
                <input type="time" name="startTime" required>
              </div>
              <div class="form-field">
                <label>종료시간 <span style="color:var(--primary)">*</span></label>
                <input type="time" name="endTime" required>
              </div>
            </div>

            <div class="form-grid">
              <div class="form-field">
                <label>사용목적 <span style="color:var(--primary)">*</span></label>
                <select name="purpose" required>
                  <option value="">선택하세요</option>
                  <option>교육/세미나</option>
                  <option>회의</option>
                  <option>워크샵</option>
                  <option>강연</option>
                  <option>기타</option>
                </select>
              </div>
              <div class="form-field">
                <label>예상 인원 <span style="color:var(--primary)">*</span></label>
                <input type="number" name="participants" placeholder="예: 30" min="1" max="100" required>
              </div>
            </div>

            <div class="form-field">
              <label>추가 요청사항</label>
              <textarea name="notes" placeholder="기자재 요청, 특별 요구사항 등을 자유롭게 작성해주세요."></textarea>
            </div>

            <button type="submit" class="btn btn-primary" id="submitBtn" style="margin-top:.5rem;">
              신청서 제출하기
            </button>
          </form>
        </div>
      </div>

      <!-- 사이드 정보 -->
      <div style="display:flex; flex-direction:column; gap:1.25rem;" id="info">
        <div class="card" style="padding:1.5rem;">
          <p style="font-size:.8rem; font-weight:700; color:var(--gray-500); text-transform:uppercase; letter-spacing:.06em; margin-bottom:1rem;">시설 정보</p>
          <div style="display:flex; flex-direction:column; gap:.75rem;">
            <div class="info-item">
              <div class="info-icon">
                <svg viewBox="0 0 20 20" fill="none"><path d="M10 2C7.24 2 5 4.24 5 7c0 3.75 5 11 5 11s5-7.25 5-11c0-2.76-2.24-5-5-5zm0 6.5A1.5 1.5 0 1110 5a1.5 1.5 0 010 3.5z" fill="currentColor"/></svg>
              </div>
              <div>
                <div class="info-label">주소</div>
                <div class="info-value" style="font-size:.82rem; line-height:1.5;">경기도 광명시 일직로 43<br>GIDC C동 1705호</div>
              </div>
            </div>
            <div class="info-item">
              <div class="info-icon">
                <svg viewBox="0 0 20 20" fill="none"><path d="M2 3h4l2 5-2.5 1.5a11 11 0 005 5L12 12l5 2v4a2 2 0 01-2 2C6.48 20 0 13.52 0 5a2 2 0 012-2z" fill="currentColor"/></svg>
              </div>
              <div>
                <div class="info-label">전화</div>
                <div class="info-value">010-8394-0484</div>
              </div>
            </div>
            <div class="info-item">
              <div class="info-icon">
                <svg viewBox="0 0 20 20" fill="none"><path d="M18 4H2a1 1 0 00-1 1v10a1 1 0 001 1h16a1 1 0 001-1V5a1 1 0 00-1-1zm-1 10H3V7.23l7 4.08 7-4.08V14zm-7-5.08L3.5 5h13L10 8.92z" fill="currentColor"/></svg>
              </div>
              <div>
                <div class="info-label">이메일</div>
                <div class="info-value" style="font-size:.82rem;">petcky@gmail.com</div>
              </div>
            </div>
            <div class="info-item">
              <div class="info-icon">
                <svg viewBox="0 0 20 20" fill="none"><path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm1 11H9V9h2v4zm0-6H9V5h2v2z" fill="currentColor"/></svg>
              </div>
              <div>
                <div class="info-label">운영시간 / 최대수용</div>
                <div class="info-value">09:00 – 22:00 / 100명</div>
              </div>
            </div>
          </div>
          <div class="feature-row">
            <span class="feature-tag">빔프로젝터</span>
            <span class="feature-tag">화이트보드</span>
            <span class="feature-tag">마이크</span>
            <span class="feature-tag">Wi-Fi</span>
            <span class="feature-tag">주차 가능</span>
          </div>
        </div>

        <div class="card" style="padding:1.5rem;">
          <p style="font-size:.8rem; font-weight:700; color:var(--gray-500); text-transform:uppercase; letter-spacing:.06em; margin-bottom:1rem;">찾아오시는 길</p>
          <div class="map-container">
            <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3167.568!2d126.8845!3d37.4185!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x357b7bb8b1f8d7b1%3A0x1234567890abcdef!2z6rK96riw64-EIOq0keuqheyLnCDsnbzspIHroZwgNDMsIEdJREMg7KeA2Y7rgrDsl4XshLzthLAg7JeQmMW7Y2Qz64-E!5e0!3m2!1sko!2skr!4v1692123456789" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
          </div>
          <p style="font-size:.8rem; color:var(--gray-500); margin-top:.75rem; line-height:1.6;">
            🚆 KTX광명역에서 도보 5분<br>
            🚗 건물 내 주차장 이용 가능
          </p>
        </div>
      </div>
    </div>
  </div>

  <footer>
    <p><strong>한국학원경영아카데미</strong></p>
    <p>경기도 광명시 일직로 43, GIDC C동 1705호 · 010-8394-0484 · petcky@gmail.com</p>
    <p style="margin-top:.5rem; color:var(--gray-600); font-size:.8rem;">© 2024 한국학원경영아카데미. All rights reserved.</p>
  </footer>

  <div id="toast"></div>

  <script>
    document.querySelector('input[name="date"]').min = new Date().toISOString().split('T')[0];

    function showToast(msg, type='success') {
      const t = document.getElementById('toast');
      t.textContent = msg; t.className = 'show ' + type;
      setTimeout(() => { t.className = ''; }, 3500);
    }

    document.getElementById('applicationForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target).entries());
      if (data.startTime >= data.endTime) { showToast('종료시간은 시작시간보다 늦어야 합니다.', 'error'); return; }
      const btn = document.getElementById('submitBtn');
      btn.disabled = true; btn.textContent = '제출 중...';
      try {
        const res = await fetch('/api/application', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
        const json = await res.json();
        if (json.success) { showToast('대관신청이 접수되었습니다!', 'success'); e.target.reset(); }
        else showToast(json.message || '오류가 발생했습니다.', 'error');
      } catch { showToast('네트워크 오류가 발생했습니다.', 'error'); }
      finally { btn.disabled = false; btn.textContent = '신청서 제출하기'; }
    });
  </script>
</body>
</html>`)
})

// ─── 학교 조회 페이지 ─────────────────────────────────────────────────────────

app.get('/school', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>학교 정보 조회 — 한국학원경영아카데미</title>
  <style>${COMMON_CSS}
    .search-bar { display: flex; gap: .75rem; align-items: flex-end; flex-wrap: wrap; }
    .search-bar .form-field { flex: 1; min-width: 200px; }
    .search-bar .form-field.w-select { flex: 0 0 170px; }
    .btn-search { background: var(--primary); color: #fff; border: none; padding: .65rem 1.4rem; border-radius: var(--radius-sm); font-size: .9rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: .4rem; white-space: nowrap; transition: background .15s; height: 42px; }
    .btn-search:hover { background: var(--primary-dark); }

    table { width: 100%; border-collapse: collapse; font-size: .875rem; }
    thead { background: var(--gray-50); border-bottom: 2px solid var(--gray-200); }
    th { padding: .85rem 1rem; text-align: left; font-size: .75rem; font-weight: 700; color: var(--gray-500); text-transform: uppercase; letter-spacing: .05em; white-space: nowrap; }
    td { padding: .85rem 1rem; border-bottom: 1px solid var(--gray-100); vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tbody tr { transition: background .1s; }
    tbody tr:hover { background: var(--primary-light); cursor: pointer; }
    .school-name { font-weight: 600; color: var(--primary); }

    .badge { display: inline-flex; align-items: center; padding: .2rem .65rem; border-radius: 999px; font-size: .72rem; font-weight: 600; white-space: nowrap; }
    .badge-elem { background: #dbeafe; color: #1d4ed8; }
    .badge-middle { background: #dcfce7; color: #15803d; }
    .badge-high { background: #fef9c3; color: #854d0e; }
    .badge-special { background: #ede9fe; color: #6d28d9; }
    .badge-etc { background: var(--gray-100); color: var(--gray-600); }

    .fond-public { background: #e0f2fe; color: #0369a1; }
    .fond-private { background: #fce7f3; color: #9d174d; }

    .pagination { display: flex; gap: .35rem; align-items: center; justify-content: center; }
    .page-btn { width: 36px; height: 36px; border: 1.5px solid var(--gray-200); border-radius: var(--radius-sm); background: #fff; font-size: .85rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .12s; color: var(--gray-700); }
    .page-btn:hover { border-color: var(--primary); color: var(--primary); }
    .page-btn.active { background: var(--primary); border-color: var(--primary); color: #fff; font-weight: 700; }
    .page-btn.text { width: auto; padding: 0 .7rem; }

    .empty { text-align: center; padding: 5rem 2rem; color: var(--gray-400); }
    .empty svg { width: 56px; height: 56px; margin: 0 auto 1rem; display: block; }
    .empty p { font-size: 1rem; }

    .modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 200; display: none; align-items: center; justify-content: center; padding: 1rem; backdrop-filter: blur(4px); }
    .modal-bg.open { display: flex; }
    .modal { background: #fff; border-radius: var(--radius); width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto; box-shadow: var(--shadow-lg); animation: slideUp .2s ease; }
    @keyframes slideUp { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    .modal-header { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--gray-200); display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; background: #fff; z-index: 1; }
    .modal-header h3 { font-size: 1.05rem; font-weight: 700; }
    .modal-close { background: none; border: none; cursor: pointer; color: var(--gray-400); padding: .25rem; border-radius: 6px; transition: color .12s; }
    .modal-close:hover { color: var(--gray-800); }
    .modal-body { padding: 1.5rem; }
    .detail-grid { display: grid; grid-template-columns: 120px 1fr; gap: .5rem 1rem; }
    .detail-label { font-size: .8rem; color: var(--gray-500); font-weight: 500; padding: .4rem 0; }
    .detail-value { font-size: .875rem; color: var(--gray-800); padding: .4rem 0; border-bottom: 1px solid var(--gray-100); font-weight: 500; }
    .detail-value a { color: var(--primary); text-decoration: underline; }
  </style>
</head>
<body>
  ${NAV_HTML('school')}

  <div class="hero" style="padding: 3rem 2rem 2.5rem;">
    <div class="hero-badge">학교알리미 Open API</div>
    <h1 style="font-size: clamp(1.5rem, 3vw, 2.2rem);">학교 정보 조회</h1>
    <p style="font-size:.95rem; margin-bottom:0;">전국 학교 정보를 검색하고 학원 영업에 활용하세요</p>
  </div>

  <div class="section">
    <!-- 검색 영역 -->
    <div class="card" style="padding:1.5rem; margin-bottom:1.5rem;">
      <div class="search-bar">
        <div class="form-field">
          <label>학교명</label>
          <input id="schoolName" type="text" placeholder="예: 광명초등학교" style="height:42px;">
        </div>
        <div class="form-field w-select">
          <label>시도교육청</label>
          <select id="region" style="height:42px;">
            <option value="">전체</option>
            <option value="B10">서울</option>
            <option value="C10">부산</option>
            <option value="D10">대구</option>
            <option value="E10">인천</option>
            <option value="F10">광주</option>
            <option value="G10">대전</option>
            <option value="H10">울산</option>
            <option value="I10">세종</option>
            <option value="J10">경기</option>
            <option value="K10">강원</option>
            <option value="M10">충북</option>
            <option value="N10">충남</option>
            <option value="P10">전북</option>
            <option value="Q10">전남</option>
            <option value="R10">경북</option>
            <option value="S10">경남</option>
            <option value="T10">제주</option>
          </select>
        </div>
        <button class="btn-search" onclick="searchSchools(1)">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.8"/><path d="M11 11l3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          검색
        </button>
      </div>
      <p style="font-size:.78rem; color:var(--gray-400); margin-top:.75rem;">* 학교명 일부만 입력해도 검색됩니다. 학교명을 클릭하면 상세 정보를 확인할 수 있습니다.</p>
    </div>

    <!-- 결과 -->
    <div id="resultWrap">
      <div class="empty" id="emptyState">
        <svg viewBox="0 0 56 56" fill="none"><circle cx="28" cy="28" r="27" stroke="var(--gray-200)" stroke-width="2"/><path d="M20 36l16-16M20 20l16 16" stroke="var(--gray-300)" stroke-width="2" stroke-linecap="round" style="display:none"/><path d="M18 38l5-5M28 18a10 10 0 110 20 10 10 0 010-20z" stroke="var(--gray-300)" stroke-width="2" stroke-linecap="round"/></svg>
        <p>학교명을 입력하고 검색해보세요</p>
      </div>

      <div id="loadingState" style="display:none;" class="empty">
        <svg viewBox="0 0 56 56" fill="none" style="animation:spin 1s linear infinite;"><circle cx="28" cy="28" r="24" stroke="var(--gray-200)" stroke-width="4"/><path d="M28 4a24 24 0 0124 24" stroke="var(--primary)" stroke-width="4" stroke-linecap="round"/></svg>
        <p style="color:var(--gray-500);">검색 중...</p>
      </div>

      <div id="resultContent" style="display:none;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:.75rem;">
          <span id="resultCount" style="font-size:.875rem; font-weight:600; color:var(--gray-700);"></span>
        </div>
        <div class="card" style="overflow:hidden; margin-bottom:1.25rem;">
          <div style="overflow-x:auto;">
            <table>
              <thead>
                <tr>
                  <th>학교명</th>
                  <th>종류</th>
                  <th>설립</th>
                  <th>주소</th>
                  <th>전화번호</th>
                  <th>홈페이지</th>
                </tr>
              </thead>
              <tbody id="resultTable"></tbody>
            </table>
          </div>
        </div>
        <div class="pagination" id="pagination"></div>
      </div>
    </div>
  </div>

  <!-- 상세 모달 -->
  <div class="modal-bg" id="detailModal">
    <div class="modal">
      <div class="modal-header">
        <h3 id="modalTitle">학교 상세 정보</h3>
        <button class="modal-close" onclick="closeModal()">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="modal-body" id="modalBody">
        <div class="empty"><svg viewBox="0 0 56 56" fill="none" style="animation:spin 1s linear infinite;"><circle cx="28" cy="28" r="24" stroke="var(--gray-200)" stroke-width="4"/><path d="M28 4a24 24 0 0124 24" stroke="var(--primary)" stroke-width="4" stroke-linecap="round"/></svg></div>
      </div>
    </div>
  </div>

  <footer>
    <p><strong>한국학원경영아카데미</strong></p>
    <p>경기도 광명시 일직로 43, GIDC C동 1705호 · 010-8394-0484 · petcky@gmail.com</p>
    <p style="margin-top:.5rem; color:var(--gray-600); font-size:.8rem;">© 2024 한국학원경영아카데미. All rights reserved.</p>
  </footer>

  <style>@keyframes spin { to { transform: rotate(360deg); } }</style>

  <script>
    let currentPage = 1;

    document.getElementById('schoolName').addEventListener('keydown', e => {
      if (e.key === 'Enter') searchSchools(1);
    });

    function typeBadge(t) {
      const map = { '초등학교': ['badge-elem','초등'], '중학교': ['badge-middle','중학'], '고등학교': ['badge-high','고등'], '특수학교': ['badge-special','특수'] };
      const [cls, label] = map[t] || ['badge-etc', t];
      return \`<span class="badge \${cls}">\${label}</span>\`;
    }
    function fondBadge(f) {
      const cls = f?.includes('공립') ? 'fond-public' : f?.includes('사립') ? 'fond-private' : 'badge-etc';
      return \`<span class="badge \${cls}">\${f || '-'}</span>\`;
    }

    async function searchSchools(page) {
      const name = document.getElementById('schoolName').value.trim();
      const region = document.getElementById('region').value;
      if (!name) { document.getElementById('schoolName').focus(); return; }
      currentPage = page;

      document.getElementById('emptyState').style.display = 'none';
      document.getElementById('resultContent').style.display = 'none';
      document.getElementById('loadingState').style.display = 'block';

      try {
        const params = new URLSearchParams({ name, page });
        if (region) params.set('region', region);
        const res = await fetch('/api/school/search?' + params);
        const data = await res.json();
        document.getElementById('loadingState').style.display = 'none';

        if (!data.success || data.total === 0) {
          document.getElementById('emptyState').style.display = 'block';
          document.getElementById('emptyState').querySelector('p').textContent = '검색 결과가 없습니다.';
          return;
        }
        renderResults(data.schools, data.total);
      } catch {
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('emptyState').style.display = 'block';
        document.getElementById('emptyState').querySelector('p').textContent = 'API 오류가 발생했습니다.';
      }
    }

    function renderResults(schools, total) {
      document.getElementById('resultCount').textContent = \`총 \${total.toLocaleString()}개 학교\`;
      const tbody = document.getElementById('resultTable');
      tbody.innerHTML = schools.map(s => \`
        <tr onclick="showDetail('\${s.ATPT_OFCDC_SC_CODE}','\${s.SD_SCHUL_CODE}',\\\`\${s.SCHUL_NM.replace(/\`/g,"'")}\\\`)">
          <td class="school-name">\${s.SCHUL_NM}</td>
          <td>\${typeBadge(s.SCHUL_KND_SC_NM)}</td>
          <td>\${fondBadge(s.FOND_SC_NM)}</td>
          <td style="color:var(--gray-600); font-size:.82rem; max-width:220px;">\${s.ORG_RDNMA || '-'}</td>
          <td style="color:var(--gray-600); font-size:.82rem; white-space:nowrap;">\${s.ORG_TELNO || '-'}</td>
          <td>\${s.HMPG_ADRES ? \`<a href="\${s.HMPG_ADRES}" target="_blank" onclick="event.stopPropagation()" style="color:var(--primary); font-size:.8rem;">바로가기 ↗</a>\` : '-'}</td>
        </tr>
      \`).join('');

      renderPagination(total);
      document.getElementById('resultContent').style.display = 'block';
    }

    function renderPagination(total) {
      const totalPages = Math.ceil(total / 20);
      const pg = document.getElementById('pagination');
      if (totalPages <= 1) { pg.innerHTML = ''; return; }

      const start = Math.max(1, currentPage - 4);
      const end = Math.min(totalPages, start + 9);
      let html = '';

      if (currentPage > 1)
        html += \`<button class="page-btn text" onclick="searchSchools(\${currentPage-1})">← 이전</button>\`;
      for (let i = start; i <= end; i++)
        html += \`<button class="page-btn \${i===currentPage?'active':''}" onclick="searchSchools(\${i})">\${i}</button>\`;
      if (currentPage < totalPages)
        html += \`<button class="page-btn text" onclick="searchSchools(\${currentPage+1})">다음 →</button>\`;

      pg.innerHTML = html;
    }

    async function showDetail(sdCode, schulCode, name) {
      document.getElementById('modalTitle').textContent = name;
      document.getElementById('modalBody').innerHTML = '<div class="empty" style="padding:3rem;"><svg viewBox="0 0 56 56" fill="none" style="animation:spin 1s linear infinite; width:48px; height:48px; display:block; margin:0 auto 1rem;"><circle cx="28" cy="28" r="24" stroke="#e9ecef" stroke-width="4"/><path d="M28 4a24 24 0 0124 24" stroke="#3b5bdb" stroke-width="4" stroke-linecap="round"/></svg><p style="color:#adb5bd;">불러오는 중...</p></div>';
      document.getElementById('detailModal').classList.add('open');

      try {
        const res = await fetch(\`/api/school/detail?sdCode=\${sdCode}&schulCode=\${schulCode}\`);
        const data = await res.json();
        if (!data.success) throw new Error();
        const s = data.school;
        const fields = [
          ['학교명', s.SCHUL_NM], ['영문명', s.ENG_SCHUL_NM],
          ['학교종류', s.SCHUL_KND_SC_NM], ['설립구분', s.FOND_SC_NM],
          ['설립일', s.FOND_YMD], ['시도교육청', s.ATPT_OFCDC_SC_NM],
          ['교육지원청', s.JU_ORG_NM], ['주소', s.ORG_RDNMA],
          ['상세주소', s.ORG_RDNDA], ['전화번호', s.ORG_TELNO],
          ['팩스번호', s.ORG_FAXNO], ['홈페이지', s.HMPG_ADRES ? \`<a href="\${s.HMPG_ADRES}" target="_blank">\${s.HMPG_ADRES}</a>\` : null],
          ['남녀공학', s.COEDU_SC_NM], ['급식유형', s.MLSV_TYPE_NM],
          ['고등학교구분', s.HS_SC_NM],
        ].filter(([,v]) => v);

        document.getElementById('modalBody').innerHTML = \`
          <div class="detail-grid">
            \${fields.map(([l,v]) => \`<div class="detail-label">\${l}</div><div class="detail-value">\${v}</div>\`).join('')}
          </div>
        \`;
      } catch {
        document.getElementById('modalBody').innerHTML = '<p style="text-align:center; color:var(--danger); padding:2rem;">상세 정보를 불러올 수 없습니다.</p>';
      }
    }

    function closeModal() { document.getElementById('detailModal').classList.remove('open'); }
    document.getElementById('detailModal').addEventListener('click', e => { if(e.target === e.currentTarget) closeModal(); });
  </script>
</body>
</html>`)
})

// ─── 관리자 페이지 ────────────────────────────────────────────────────────────

app.get('/admin', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>관리자 — 한국학원경영아카데미</title>
  <style>${COMMON_CSS}
    .login-wrap { min-height: calc(100vh - 64px); display: flex; align-items: center; justify-content: center; padding: 2rem; }
    .login-card { background: #fff; border-radius: var(--radius); box-shadow: var(--shadow-lg); padding: 2.5rem; width: 100%; max-width: 380px; }
    .login-card h2 { font-size: 1.3rem; font-weight: 700; margin-bottom: .4rem; }
    .login-card p { color: var(--gray-500); font-size: .875rem; margin-bottom: 2rem; }

    .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem; }
    @media(max-width:700px) { .stat-grid { grid-template-columns: 1fr 1fr; } }
    .stat-card { background: #fff; border-radius: var(--radius); padding: 1.25rem 1.5rem; box-shadow: var(--shadow); display: flex; align-items: center; gap: 1rem; }
    .stat-icon { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .stat-icon svg { width: 22px; height: 22px; }
    .stat-label { font-size: .78rem; color: var(--gray-500); font-weight: 500; }
    .stat-value { font-size: 1.6rem; font-weight: 700; line-height: 1.2; }

    table { width: 100%; border-collapse: collapse; font-size: .875rem; }
    thead { background: var(--gray-50); }
    th { padding: .85rem 1rem; text-align: left; font-size: .72rem; font-weight: 700; color: var(--gray-500); text-transform: uppercase; letter-spacing: .05em; white-space: nowrap; }
    td { padding: .85rem 1rem; border-bottom: 1px solid var(--gray-100); vertical-align: middle; }
    tr:last-child td { border-bottom: none; }

    .badge { display: inline-flex; align-items: center; padding: .25rem .65rem; border-radius: 999px; font-size: .72rem; font-weight: 600; }
    .badge-pending { background: #fff3cd; color: #856404; }
    .badge-approved { background: #d1e7dd; color: #0f5132; }
    .badge-rejected { background: #f8d7da; color: #842029; }

    .action-btn { background: none; border: 1.5px solid var(--gray-200); border-radius: var(--radius-sm); padding: .3rem .7rem; font-size: .78rem; cursor: pointer; color: var(--gray-700); font-weight: 500; transition: all .12s; }
    .action-btn:hover { border-color: var(--primary); color: var(--primary); }

    .modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 200; display: none; align-items: center; justify-content: center; padding: 1rem; backdrop-filter: blur(4px); }
    .modal-bg.open { display: flex; }
    .modal { background: #fff; border-radius: var(--radius); width: 100%; max-width: 460px; box-shadow: var(--shadow-lg); animation: slideUp .2s ease; }
    @keyframes slideUp { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    .modal-header { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--gray-200); display: flex; justify-content: space-between; align-items: center; }
    .modal-header h3 { font-size: 1rem; font-weight: 700; }
    .modal-close { background: none; border: none; cursor: pointer; color: var(--gray-400); }
    .modal-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
    .modal-footer { padding: 1rem 1.5rem; border-top: 1px solid var(--gray-200); display: flex; justify-content: flex-end; gap: .75rem; }
    .btn-cancel { background: none; border: 1.5px solid var(--gray-200); border-radius: var(--radius-sm); padding: .6rem 1.2rem; font-size: .875rem; cursor: pointer; color: var(--gray-700); font-weight: 500; }
    .btn-save { background: var(--primary); color: #fff; border: none; border-radius: var(--radius-sm); padding: .6rem 1.4rem; font-size: .875rem; cursor: pointer; font-weight: 600; }
    .btn-save:hover { background: var(--primary-dark); }

    .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .toolbar h2 { font-size: 1rem; font-weight: 700; }
    .btn-refresh { background: none; border: 1.5px solid var(--gray-200); border-radius: var(--radius-sm); padding: .45rem .9rem; font-size: .82rem; cursor: pointer; color: var(--gray-600); font-weight: 500; display: inline-flex; align-items: center; gap: .4rem; transition: all .12s; }
    .btn-refresh:hover { border-color: var(--primary); color: var(--primary); }
    .btn-logout { background: none; border: 1.5px solid var(--gray-200); border-radius: var(--radius-sm); padding: .4rem .85rem; font-size: .82rem; cursor: pointer; color: var(--gray-600); font-weight: 500; }
    .btn-logout:hover { background: #fee2e2; border-color: #fca5a5; color: var(--danger); }
  </style>
</head>
<body>
  ${NAV_HTML('admin')}

  <!-- 로그인 -->
  <div id="loginSection" class="login-wrap">
    <div class="login-card">
      <h2>관리자 로그인</h2>
      <p>대관신청 관리 페이지입니다</p>
      <form id="loginForm" style="display:flex;flex-direction:column;gap:1rem;">
        <div class="form-field">
          <label>비밀번호</label>
          <input type="password" id="password" placeholder="비밀번호를 입력하세요" required>
        </div>
        <button type="submit" class="btn btn-primary">로그인</button>
      </form>
    </div>
  </div>

  <!-- 대시보드 -->
  <div id="adminSection" style="display:none;">
    <div class="section">
      <!-- 통계 -->
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-icon" style="background:#eef2ff;">
            <svg viewBox="0 0 22 22" fill="none"><rect x="3" y="3" width="16" height="16" rx="2" stroke="#3b5bdb" stroke-width="1.8"/><path d="M7 11h8M7 7h8M7 15h4" stroke="#3b5bdb" stroke-width="1.8" stroke-linecap="round"/></svg>
          </div>
          <div>
            <div class="stat-label">전체</div>
            <div class="stat-value" id="statTotal">0</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:#fffbeb;">
            <svg viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="8" stroke="#d97706" stroke-width="1.8"/><path d="M11 7v4l2.5 2.5" stroke="#d97706" stroke-width="1.8" stroke-linecap="round"/></svg>
          </div>
          <div>
            <div class="stat-label">대기</div>
            <div class="stat-value" id="statPending" style="color:#d97706;">0</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:#f0fdf4;">
            <svg viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="8" stroke="#16a34a" stroke-width="1.8"/><path d="M7.5 11l2.5 2.5 5-5" stroke="#16a34a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <div>
            <div class="stat-label">승인</div>
            <div class="stat-value" id="statApproved" style="color:#16a34a;">0</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:#fef2f2;">
            <svg viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="8" stroke="#dc2626" stroke-width="1.8"/><path d="M8 8l6 6M14 8l-6 6" stroke="#dc2626" stroke-width="1.8" stroke-linecap="round"/></svg>
          </div>
          <div>
            <div class="stat-label">거부</div>
            <div class="stat-value" id="statRejected" style="color:#dc2626;">0</div>
          </div>
        </div>
      </div>

      <!-- 목록 -->
      <div class="card">
        <div style="padding:1.25rem 1.5rem; border-bottom:1px solid var(--gray-100);">
          <div class="toolbar">
            <h2>대관신청 목록</h2>
            <div style="display:flex;gap:.5rem;align-items:center;">
              <button class="btn-refresh" onclick="loadApplications()">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7a6 6 0 106-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M7 1L5 3l2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                새로고침
              </button>
              <button class="btn-logout" onclick="logout()">로그아웃</button>
            </div>
          </div>
        </div>
        <div style="overflow-x:auto;">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>신청자</th>
                <th>사용일시</th>
                <th>목적 / 인원</th>
                <th>접수일</th>
                <th>상태</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody id="appTable"></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <!-- 상태 변경 모달 -->
  <div class="modal-bg" id="statusModal">
    <div class="modal">
      <div class="modal-header">
        <h3>신청 상태 변경</h3>
        <button class="modal-close" onclick="closeStatusModal()">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
      </div>
      <form id="statusForm">
        <input type="hidden" id="modalId">
        <div class="modal-body">
          <div class="form-field">
            <label>상태</label>
            <select id="modalStatus">
              <option value="pending">대기 중</option>
              <option value="approved">승인</option>
              <option value="rejected">거부</option>
            </select>
          </div>
          <div class="form-field">
            <label>관리자 메모</label>
            <textarea id="modalNotes" placeholder="승인/거부 사유 등을 작성하세요." style="min-height:80px;"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-cancel" onclick="closeStatusModal()">취소</button>
          <button type="submit" class="btn-save">저장</button>
        </div>
      </form>
    </div>
  </div>

  <div id="toast"></div>

  <footer>
    <p><strong>한국학원경영아카데미</strong> 관리자 페이지</p>
    <p style="margin-top:.25rem; color:var(--gray-600); font-size:.8rem;">© 2024 한국학원경영아카데미. All rights reserved.</p>
  </footer>

  <script>
    let authToken = '';

    function showToast(msg, type='success') {
      const t = document.getElementById('toast');
      t.textContent = msg; t.className = 'show ' + type;
      setTimeout(() => { t.className = ''; }, 3000);
    }

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const pw = document.getElementById('password').value;
      try {
        const res = await fetch('/api/admin/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({password: pw}) });
        const data = await res.json();
        if (data.success) {
          authToken = pw;
          document.getElementById('loginSection').style.display = 'none';
          document.getElementById('adminSection').style.display = 'block';
          loadApplications();
        } else {
          showToast(data.message || '로그인 실패', 'error');
        }
      } catch { showToast('로그인 오류', 'error'); }
    });

    function logout() {
      authToken = '';
      document.getElementById('loginSection').style.display = 'flex';
      document.getElementById('adminSection').style.display = 'none';
      document.getElementById('password').value = '';
    }

    async function loadApplications() {
      try {
        const res = await fetch('/api/admin/applications', { headers: { Authorization: \`Bearer \${authToken}\` } });
        const data = await res.json();
        if (!data.success) { showToast('데이터 로드 실패', 'error'); return; }
        updateStats(data.applications);
        renderTable(data.applications);
      } catch { showToast('데이터 로드 오류', 'error'); }
    }

    function updateStats(apps) {
      document.getElementById('statTotal').textContent = apps.length;
      document.getElementById('statPending').textContent = apps.filter(a=>a.status==='pending').length;
      document.getElementById('statApproved').textContent = apps.filter(a=>a.status==='approved').length;
      document.getElementById('statRejected').textContent = apps.filter(a=>a.status==='rejected').length;
    }

    function statusBadge(s) {
      const map = { pending: ['badge-pending','대기 중'], approved: ['badge-approved','승인'], rejected: ['badge-rejected','거부'] };
      const [cls, label] = map[s] || ['badge-etc', s];
      return \`<span class="badge \${cls}">\${label}</span>\`;
    }

    function renderTable(apps) {
      document.getElementById('appTable').innerHTML = apps.length === 0
        ? '<tr><td colspan="7" style="text-align:center; color:var(--gray-400); padding:3rem;">접수된 신청이 없습니다.</td></tr>'
        : apps.map(a => \`
          <tr>
            <td style="color:var(--gray-400); font-size:.8rem;">#\${a.id}</td>
            <td>
              <div style="font-weight:600; color:var(--gray-900);">\${a.name}</div>
              <div style="font-size:.78rem; color:var(--gray-500);">\${a.phone}</div>
              <div style="font-size:.78rem; color:var(--gray-400);">\${a.email}</div>
            </td>
            <td>
              <div style="font-weight:600;">\${a.date}</div>
              <div style="font-size:.8rem; color:var(--gray-500);">\${a.startTime} – \${a.endTime}</div>
            </td>
            <td>
              <div>\${a.purpose}</div>
              <div style="font-size:.8rem; color:var(--gray-500);">\${a.participants}명</div>
            </td>
            <td style="font-size:.8rem; color:var(--gray-500);">\${new Date(a.submittedAt).toLocaleDateString('ko-KR')}</td>
            <td>
              \${statusBadge(a.status)}
              \${a.adminNotes ? \`<div style="font-size:.75rem; color:var(--gray-500); margin-top:.25rem;">\${a.adminNotes}</div>\` : ''}
            </td>
            <td><button class="action-btn" onclick="openStatusModal(\${a.id}, '\${a.status}', \\\`\${(a.adminNotes||'').replace(/\`/g,"'")}\\\`)">상태변경</button></td>
          </tr>
        \`).join('');
    }

    function openStatusModal(id, status, notes) {
      document.getElementById('modalId').value = id;
      document.getElementById('modalStatus').value = status;
      document.getElementById('modalNotes').value = notes;
      document.getElementById('statusModal').classList.add('open');
    }
    function closeStatusModal() { document.getElementById('statusModal').classList.remove('open'); }

    document.getElementById('statusForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('modalId').value;
      const status = document.getElementById('modalStatus').value;
      const notes = document.getElementById('modalNotes').value;
      try {
        const res = await fetch(\`/api/admin/applications/\${id}/status\`, {
          method: 'PUT',
          headers: { 'Content-Type':'application/json', Authorization: \`Bearer \${authToken}\` },
          body: JSON.stringify({ status, notes })
        });
        const data = await res.json();
        if (data.success) { closeStatusModal(); loadApplications(); showToast('상태가 업데이트되었습니다.'); }
        else showToast(data.message || '오류', 'error');
      } catch { showToast('오류가 발생했습니다.', 'error'); }
    });

    document.getElementById('statusModal').addEventListener('click', e => { if(e.target===e.currentTarget) closeStatusModal(); });
  </script>
</body>
</html>`)
})

export default app
