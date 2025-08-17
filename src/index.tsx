import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

const app = new Hono()

// 메모리 스토리지 (실제 환경에서는 D1 데이터베이스 사용 권장)
let applications: any[] = []
let applicationIdCounter = 1

// 관리자 비밀번호 (실제 환경에서는 환경변수 사용)
const ADMIN_PASSWORD = 'admin123'

// CORS 설정
app.use('/api/*', cors())

// 정적 파일 서빙
app.use('/static/*', serveStatic({ root: './public' }))

// 대관신청 접수 API
app.post('/api/application', async (c) => {
  try {
    const formData = await c.req.json()
    
    // 메일 발송 로직 (실제 환경에서는 Cloudflare Email Routing 또는 외부 메일 서비스 사용)
    const emailContent = `
안녕하세요. 한국학원경영아카데미입니다.

대관신청이 접수되었습니다.

신청자: ${formData.name}
연락처: ${formData.phone}
이메일: ${formData.email}
사용일자: ${formData.date}
사용시간: ${formData.startTime} - ${formData.endTime}
사용목적: ${formData.purpose}
예상인원: ${formData.participants}명
추가요청사항: ${formData.notes || '없음'}

빠른 시일 내에 연락드리겠습니다.
감사합니다.

한국학원경영아카데미
전화: 010-8394-0484
이메일: petcky@gmail.com
주소: 경기도 광명시 일직로 43, GIDC C동 1705호
    `;
    
    // 신청 데이터 저장
    const application = {
      id: applicationIdCounter++,
      ...formData,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      emailContent
    }
    applications.push(application)
    
    // 실제 메일 발송은 여기에 구현
    console.log('Email would be sent:', emailContent)
    console.log('Application saved:', application)
    
    return c.json({ 
      success: true, 
      message: '대관신청이 성공적으로 접수되었습니다. 확인 메일을 발송했습니다.',
      applicationId: application.id
    })
  } catch (error) {
    console.error('Application submission error:', error)
    return c.json({ 
      success: false, 
      message: '신청 처리 중 오류가 발생했습니다. 다시 시도해주세요.' 
    }, 500)
  }
})

// 관리자 로그인 API
app.post('/api/admin/login', async (c) => {
  try {
    const { password } = await c.req.json()
    
    if (password === ADMIN_PASSWORD) {
      return c.json({ success: true, message: '로그인 성공' })
    } else {
      return c.json({ success: false, message: '비밀번호가 틀렸습니다.' }, 401)
    }
  } catch (error) {
    return c.json({ success: false, message: '로그인 처리 중 오류가 발생했습니다.' }, 500)
  }
})

// 관리자 신청 목록 조회 API
app.get('/api/admin/applications', async (c) => {
  const password = c.req.header('Authorization')?.replace('Bearer ', '')
  
  if (password !== ADMIN_PASSWORD) {
    return c.json({ success: false, message: '인증이 필요합니다.' }, 401)
  }
  
  return c.json({ 
    success: true, 
    applications: applications.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()) 
  })
})

// 관리자 신청 상태 업데이트 API
app.put('/api/admin/applications/:id/status', async (c) => {
  const password = c.req.header('Authorization')?.replace('Bearer ', '')
  
  if (password !== ADMIN_PASSWORD) {
    return c.json({ success: false, message: '인증이 필요합니다.' }, 401)
  }
  
  try {
    const id = parseInt(c.req.param('id'))
    const { status, notes } = await c.req.json()
    
    const applicationIndex = applications.findIndex(app => app.id === id)
    if (applicationIndex === -1) {
      return c.json({ success: false, message: '신청을 찾을 수 없습니다.' }, 404)
    }
    
    applications[applicationIndex] = {
      ...applications[applicationIndex],
      status,
      adminNotes: notes,
      updatedAt: new Date().toISOString()
    }
    
    return c.json({ 
      success: true, 
      message: '상태가 업데이트되었습니다.',
      application: applications[applicationIndex]
    })
  } catch (error) {
    return c.json({ success: false, message: '상태 업데이트 중 오류가 발생했습니다.' }, 500)
  }
})

// 관리자 페이지
app.get('/admin', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>관리자 페이지 - 한국학원경영아카데미</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
          .academy-bg {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .admin-card {
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          }
          .status-pending { @apply bg-yellow-100 text-yellow-800; }
          .status-approved { @apply bg-green-100 text-green-800; }
          .status-rejected { @apply bg-red-100 text-red-800; }
        </style>
    </head>
    <body class="bg-gray-50">
        <!-- 헤더 -->
        <header class="academy-bg text-white py-6">
            <div class="max-w-7xl mx-auto px-4">
                <div class="flex justify-between items-center">
                    <h1 class="text-3xl font-bold">
                        <i class="fas fa-cog mr-2"></i>
                        관리자 페이지
                    </h1>
                    <div class="flex items-center space-x-4">
                        <a href="/" class="bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-2 rounded-lg transition">
                            <i class="fas fa-home mr-2"></i>메인 페이지
                        </a>
                        <button id="logoutBtn" class="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg transition">
                            <i class="fas fa-sign-out-alt mr-2"></i>로그아웃
                        </button>
                    </div>
                </div>
            </div>
        </header>

        <!-- 로그인 폼 -->
        <div id="loginSection" class="max-w-md mx-auto mt-20">
            <div class="bg-white rounded-lg admin-card p-8">
                <h2 class="text-2xl font-bold text-center mb-6">관리자 로그인</h2>
                <form id="loginForm" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">비밀번호</label>
                        <input type="password" id="password" required 
                               class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    </div>
                    <button type="submit" 
                            class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition">
                        <i class="fas fa-key mr-2"></i>로그인
                    </button>
                </form>
            </div>
        </div>

        <!-- 관리자 대시보드 -->
        <div id="adminSection" class="max-w-7xl mx-auto px-4 py-8" style="display: none;">
            <!-- 통계 카드 -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div class="bg-white rounded-lg admin-card p-6">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <i class="fas fa-list-alt text-3xl text-blue-600"></i>
                        </div>
                        <div class="ml-4">
                            <p class="text-sm font-medium text-gray-500">전체 신청</p>
                            <p id="totalCount" class="text-2xl font-bold text-gray-900">0</p>
                        </div>
                    </div>
                </div>
                
                <div class="bg-white rounded-lg admin-card p-6">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <i class="fas fa-clock text-3xl text-yellow-600"></i>
                        </div>
                        <div class="ml-4">
                            <p class="text-sm font-medium text-gray-500">대기 중</p>
                            <p id="pendingCount" class="text-2xl font-bold text-yellow-600">0</p>
                        </div>
                    </div>
                </div>
                
                <div class="bg-white rounded-lg admin-card p-6">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <i class="fas fa-check-circle text-3xl text-green-600"></i>
                        </div>
                        <div class="ml-4">
                            <p class="text-sm font-medium text-gray-500">승인됨</p>
                            <p id="approvedCount" class="text-2xl font-bold text-green-600">0</p>
                        </div>
                    </div>
                </div>
                
                <div class="bg-white rounded-lg admin-card p-6">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <i class="fas fa-times-circle text-3xl text-red-600"></i>
                        </div>
                        <div class="ml-4">
                            <p class="text-sm font-medium text-gray-500">거부됨</p>
                            <p id="rejectedCount" class="text-2xl font-bold text-red-600">0</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 신청 목록 -->
            <div class="bg-white rounded-lg admin-card">
                <div class="px-6 py-4 border-b border-gray-200">
                    <div class="flex justify-between items-center">
                        <h3 class="text-lg font-medium text-gray-900">대관신청 목록</h3>
                        <button id="refreshBtn" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition">
                            <i class="fas fa-sync-alt mr-2"></i>새로고침
                        </button>
                    </div>
                </div>
                
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">신청정보</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">사용일시</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">목적/인원</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">액션</th>
                            </tr>
                        </thead>
                        <tbody id="applicationsTable" class="bg-white divide-y divide-gray-200">
                            <!-- 동적으로 생성 -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- 상태 변경 모달 -->
        <div id="statusModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 hidden flex items-center justify-center z-50">
            <div class="bg-white rounded-lg admin-card p-6 w-full max-w-md">
                <h3 class="text-lg font-medium mb-4">신청 상태 변경</h3>
                <form id="statusForm">
                    <input type="hidden" id="modalApplicationId">
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">상태</label>
                        <select id="modalStatus" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                            <option value="pending">대기 중</option>
                            <option value="approved">승인</option>
                            <option value="rejected">거부</option>
                        </select>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">관리자 메모</label>
                        <textarea id="modalNotes" rows="3" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="승인/거부 사유나 추가 메모를 입력하세요."></textarea>
                    </div>
                    <div class="flex justify-end space-x-2">
                        <button type="button" id="cancelModal" class="px-4 py-2 text-gray-600 hover:text-gray-800">취소</button>
                        <button type="submit" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">저장</button>
                    </div>
                </form>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            let authToken = '';
            
            // DOM 요소
            const loginSection = document.getElementById('loginSection');
            const adminSection = document.getElementById('adminSection');
            const loginForm = document.getElementById('loginForm');
            const logoutBtn = document.getElementById('logoutBtn');
            const refreshBtn = document.getElementById('refreshBtn');
            const statusModal = document.getElementById('statusModal');
            const statusForm = document.getElementById('statusForm');
            const cancelModal = document.getElementById('cancelModal');
            
            // 로그인 처리
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const password = document.getElementById('password').value;
                
                try {
                    const response = await axios.post('/api/admin/login', { password });
                    if (response.data.success) {
                        authToken = password;
                        loginSection.style.display = 'none';
                        adminSection.style.display = 'block';
                        loadApplications();
                    } else {
                        alert(response.data.message);
                    }
                } catch (error) {
                    alert('로그인 중 오류가 발생했습니다.');
                }
            });
            
            // 로그아웃
            logoutBtn.addEventListener('click', () => {
                authToken = '';
                loginSection.style.display = 'block';
                adminSection.style.display = 'none';
                document.getElementById('password').value = '';
            });
            
            // 신청 목록 로드
            async function loadApplications() {
                try {
                    const response = await axios.get('/api/admin/applications', {
                        headers: { Authorization: \`Bearer \${authToken}\` }
                    });
                    
                    if (response.data.success) {
                        updateStatistics(response.data.applications);
                        renderApplications(response.data.applications);
                    }
                } catch (error) {
                    console.error('신청 목록 로드 실패:', error);
                }
            }
            
            // 통계 업데이트
            function updateStatistics(applications) {
                const total = applications.length;
                const pending = applications.filter(app => app.status === 'pending').length;
                const approved = applications.filter(app => app.status === 'approved').length;
                const rejected = applications.filter(app => app.status === 'rejected').length;
                
                document.getElementById('totalCount').textContent = total;
                document.getElementById('pendingCount').textContent = pending;
                document.getElementById('approvedCount').textContent = approved;
                document.getElementById('rejectedCount').textContent = rejected;
            }
            
            // 신청 목록 렌더링
            function renderApplications(applications) {
                const tbody = document.getElementById('applicationsTable');
                tbody.innerHTML = '';
                
                applications.forEach(app => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = \`
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="text-sm font-medium text-gray-900">\${app.name}</div>
                            <div class="text-sm text-gray-500">\${app.phone}</div>
                            <div class="text-sm text-gray-500">\${app.email}</div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="text-sm text-gray-900">\${app.date}</div>
                            <div class="text-sm text-gray-500">\${app.startTime} - \${app.endTime}</div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="text-sm text-gray-900">\${app.purpose}</div>
                            <div class="text-sm text-gray-500">\${app.participants}명</div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full status-\${app.status}">
                                \${getStatusText(app.status)}
                            </span>
                            \${app.adminNotes ? \`<div class="text-xs text-gray-500 mt-1">\${app.adminNotes}</div>\` : ''}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button onclick="openStatusModal(\${app.id}, '\${app.status}', '\${app.adminNotes || ''}')" 
                                    class="text-blue-600 hover:text-blue-900 mr-2">
                                <i class="fas fa-edit"></i> 상태변경
                            </button>
                        </td>
                    \`;
                    tbody.appendChild(tr);
                });
            }
            
            // 상태 텍스트 변환
            function getStatusText(status) {
                switch (status) {
                    case 'pending': return '대기 중';
                    case 'approved': return '승인';
                    case 'rejected': return '거부';
                    default: return status;
                }
            }
            
            // 상태 변경 모달 열기
            function openStatusModal(id, status, notes) {
                document.getElementById('modalApplicationId').value = id;
                document.getElementById('modalStatus').value = status;
                document.getElementById('modalNotes').value = notes;
                statusModal.classList.remove('hidden');
            }
            
            // 모달 닫기
            cancelModal.addEventListener('click', () => {
                statusModal.classList.add('hidden');
            });
            
            // 상태 업데이트
            statusForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const id = document.getElementById('modalApplicationId').value;
                const status = document.getElementById('modalStatus').value;
                const notes = document.getElementById('modalNotes').value;
                
                try {
                    const response = await axios.put(\`/api/admin/applications/\${id}/status\`, 
                        { status, notes },
                        { headers: { Authorization: \`Bearer \${authToken}\` } }
                    );
                    
                    if (response.data.success) {
                        statusModal.classList.add('hidden');
                        loadApplications();
                        alert('상태가 업데이트되었습니다.');
                    } else {
                        alert(response.data.message);
                    }
                } catch (error) {
                    alert('상태 업데이트 중 오류가 발생했습니다.');
                }
            });
            
            // 새로고침
            refreshBtn.addEventListener('click', loadApplications);
            
            // 전역 함수로 등록
            window.openStatusModal = openStatusModal;
        </script>
    </body>
    </html>
  `)
})

// 메인 페이지
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>한국학원경영아카데미 - 대관신청</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
          .academy-bg {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .form-shadow {
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          }
        </style>
    </head>
    <body class="bg-gray-50">
        <!-- 헤더 -->
        <header class="academy-bg text-white py-8 mb-8">
            <div class="max-w-6xl mx-auto px-4">
                <div class="text-center">
                    <h1 class="text-4xl font-bold mb-2">
                        <i class="fas fa-university mr-3"></i>
                        한국학원경영아카데미
                    </h1>
                    <p class="text-xl text-blue-100">교육시설 대관신청</p>
                </div>
            </div>
        </header>

        <div class="max-w-6xl mx-auto px-4 pb-12">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <!-- 대관신청 폼 -->
                <div class="bg-white rounded-lg form-shadow p-8">
                    <h2 class="text-2xl font-bold text-gray-800 mb-6">
                        <i class="fas fa-edit mr-2 text-blue-600"></i>
                        대관신청서
                    </h2>
                    
                    <form id="applicationForm" class="space-y-6">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">신청자명 *</label>
                                <input type="text" name="name" required 
                                       class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">연락처 *</label>
                                <input type="tel" name="phone" required 
                                       class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">이메일 *</label>
                            <input type="email" name="email" required 
                                   class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">사용일자 *</label>
                                <input type="date" name="date" required 
                                       class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">시작시간 *</label>
                                <input type="time" name="startTime" required 
                                       class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">종료시간 *</label>
                                <input type="time" name="endTime" required 
                                       class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">사용목적 *</label>
                                <select name="purpose" required 
                                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                                    <option value="">선택하세요</option>
                                    <option value="교육/세미나">교육/세미나</option>
                                    <option value="회의">회의</option>
                                    <option value="워크샵">워크샵</option>
                                    <option value="강연">강연</option>
                                    <option value="기타">기타</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">예상인원 *</label>
                                <input type="number" name="participants" required min="1" max="100" 
                                       class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">추가 요청사항</label>
                            <textarea name="notes" rows="4" 
                                      class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                      placeholder="기자재 요청, 특별 요구사항 등을 적어주세요."></textarea>
                        </div>
                        
                        <button type="submit" 
                                class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-4 px-6 rounded-lg transition duration-200 transform hover:scale-105">
                            <i class="fas fa-paper-plane mr-2"></i>
                            신청하기
                        </button>
                    </form>
                </div>
                
                <!-- 시설 정보 및 지도 -->
                <div class="space-y-8">
                    <!-- 시설 사진 -->
                    <div class="bg-white rounded-lg form-shadow p-6">
                        <h3 class="text-xl font-bold text-gray-800 mb-4">
                            <i class="fas fa-images mr-2 text-blue-600"></i>
                            교육시설
                        </h3>
                        <div class="mb-4">
                            <img src="https://page.gensparksite.com/v1/base64_upload/33df98b1f3d6c0f900ee7eb6f7e236bc" 
                                 alt="한국학원경영아카데미 교육시설" 
                                 class="w-full h-64 object-cover rounded-lg shadow-md">
                        </div>
                        <p class="text-gray-600 leading-relaxed">
                            현대적인 교육시설로 다양한 규모의 교육과 세미나를 진행할 수 있습니다. 
                            최신 AV 장비와 편리한 시설을 갖추고 있어 효과적인 교육환경을 제공합니다.
                        </p>
                    </div>
                    
                    <!-- 연락처 정보 -->
                    <div class="bg-white rounded-lg form-shadow p-6">
                        <h3 class="text-xl font-bold text-gray-800 mb-4">
                            <i class="fas fa-info-circle mr-2 text-blue-600"></i>
                            시설 정보
                        </h3>
                        <div class="space-y-3">
                            <div class="flex items-center">
                                <i class="fas fa-map-marker-alt text-blue-600 w-5 mr-3"></i>
                                <span class="text-gray-700">경기도 광명시 일직로 43, GIDC C동 1705호</span>
                            </div>
                            <div class="flex items-center">
                                <i class="fas fa-phone text-blue-600 w-5 mr-3"></i>
                                <span class="text-gray-700">010-8394-0484</span>
                            </div>
                            <div class="flex items-center">
                                <i class="fas fa-envelope text-blue-600 w-5 mr-3"></i>
                                <span class="text-gray-700">petcky@gmail.com</span>
                            </div>
                            <div class="flex items-center">
                                <i class="fas fa-users text-blue-600 w-5 mr-3"></i>
                                <span class="text-gray-700">최대 수용인원: 100명</span>
                            </div>
                            <div class="flex items-center">
                                <i class="fas fa-clock text-blue-600 w-5 mr-3"></i>
                                <span class="text-gray-700">운영시간: 09:00 ~ 22:00</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 구글지도 -->
                    <div class="bg-white rounded-lg form-shadow p-6">
                        <h3 class="text-xl font-bold text-gray-800 mb-4">
                            <i class="fas fa-map text-blue-600 mr-2"></i>
                            찾아오시는 길
                        </h3>
                        <div class="aspect-w-16 aspect-h-9">
                            <iframe 
                                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3167.568!2d126.8845!3d37.4185!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x357b7bb8b1f8d7b1%3A0x1234567890abcdef!2z6rK96riw64-EIOq0keuqheyLnCDsnbzspIHroZwgNDMsIEdJREMg7KeA2Y7rgrDsl4XshLzthLAg7JeQmMW7Y2Qz64-E!5e0!3m2!1sko!2skr!4v1692123456789" 
                                width="100%" 
                                height="300" 
                                style="border:0; border-radius: 8px;" 
                                allowfullscreen="" 
                                loading="lazy" 
                                referrerpolicy="no-referrer-when-downgrade"
                                class="w-full h-64 rounded-lg">
                            </iframe>
                        </div>
                        <div class="mt-4 text-sm text-gray-600">
                            <p><strong>대중교통:</strong> KTX광명역에서 도보 5분 거리</p>
                            <p><strong>주차:</strong> 건물 내 주차장 이용 가능</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- 푸터 -->
        <footer class="bg-gray-800 text-white py-8 mt-12">
            <div class="max-w-6xl mx-auto px-4 text-center">
                <p class="mb-2">&copy; 2024 한국학원경영아카데미. All rights reserved.</p>
                <p class="text-gray-400">경기도 광명시 일직로 43, GIDC C동 1705호 | 전화: 010-8394-0484 | 이메일: petcky@gmail.com</p>
            </div>
        </footer>
        
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            document.getElementById('applicationForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData.entries());
                
                // 폼 검증
                if (!data.name || !data.phone || !data.email || !data.date || !data.startTime || !data.endTime || !data.purpose || !data.participants) {
                    alert('필수 항목을 모두 입력해주세요.');
                    return;
                }
                
                // 시간 검증
                if (data.startTime >= data.endTime) {
                    alert('종료시간은 시작시간보다 늦어야 합니다.');
                    return;
                }
                
                const submitButton = e.target.querySelector('button[type="submit"]');
                submitButton.disabled = true;
                submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>처리중...';
                
                try {
                    const response = await axios.post('/api/application', data);
                    
                    if (response.data.success) {
                        alert('대관신청이 성공적으로 접수되었습니다!\n\n신청하신 이메일로 확인 메일을 발송했습니다.\n빠른 시일 내에 연락드리겠습니다.');
                        e.target.reset();
                    } else {
                        alert('신청 처리 중 오류가 발생했습니다: ' + response.data.message);
                    }
                } catch (error) {
                    console.error('Error:', error);
                    alert('신청 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
                } finally {
                    submitButton.disabled = false;
                    submitButton.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>신청하기';
                }
            });
            
            // 날짜 필드 최소값을 오늘로 설정
            document.querySelector('input[name="date"]').min = new Date().toISOString().split('T')[0];
        </script>
    </body>
    </html>
  `)
})

export default app
