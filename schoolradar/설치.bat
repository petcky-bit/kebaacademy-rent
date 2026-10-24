@echo off
chcp 65001 >nul
title 스쿨레이더 설치
cd /d "%~dp0"

echo.
echo   스쿨레이더 설치
echo   ========================================
echo   이 폴더에 필요한 것을 전부 내려받습니다.
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo   [멈춤] Node.js 가 없습니다.
  echo.
  echo   https://nodejs.org 에서 LTS 를 받아 설치한 뒤
  echo   이 파일을 다시 실행하세요.
  echo.
  pause & exit /b 1
)

where powershell >nul 2>&1
if errorlevel 1 (
  echo   [멈춤] 이 윈도에는 PowerShell 이 없습니다.
  echo   README.md 의 수동 설치 순서를 따라 주세요.
  echo.
  pause ^& exit /b 1
)

rem ───────── 1/3 씨앗 꾸러미 ─────────
if exist "api\gongsi.js" (
  echo   [1/3] 씨앗 꾸러미가 이미 있습니다. 건너뜁니다.
  goto seedDone
)

echo   [1/3] 씨앗 꾸러미를 받습니다...
call :get "https://drive.google.com/uc?export=download&id=1G_fNMiAlIUVdUlMYJjEakzKAaLNHbVQy" "_seed.zip" 100000
if errorlevel 1 goto seedFail

rem zip 안에 폴더가 한 겹 더 싸여 있으면 끌어올린다
if not exist "api\gongsi.js" (
  for /d %%D in (*) do (
    if exist "%%D\api\gongsi.js" (
      robocopy "%%D" "." /E /IS /NFL /NDL /NJH /NJS >nul
      rd /s /q "%%D"
    )
  )
)
if not exist "api\gongsi.js" goto seedFail
echo         받았습니다.
goto seedDone

:seedFail
del "_seed.zip" >nul 2>&1
echo.
echo   [멈춤] 씨앗 꾸러미를 못 받았습니다.
echo   구글 드라이브가 자동 내려받기를 막았을 수 있습니다.
echo.
echo   아래 주소를 브라우저로 직접 열어 zip 을 받은 뒤,
echo   이 폴더에 풀고 이 파일을 다시 실행하세요.
echo.
echo     https://drive.google.com/file/d/1G_fNMiAlIUVdUlMYJjEakzKAaLNHbVQy/view
echo.
pause & exit /b 1

:seedDone

rem ───────── 2/3 화면과 서버 ─────────
echo   [2/3] 화면과 서버 파일을 받습니다...
call :get "https://github.com/petcky-bit/kebaacademy-rent/archive/refs/heads/claude/gallant-maxwell-m8idlb.zip" "_sr.zip" 20000
if errorlevel 1 goto srFail

set "SRDIR=kebaacademy-rent-claude-gallant-maxwell-m8idlb"
if not exist "%SRDIR%\schoolradar\dev.js" goto srFail
robocopy "%SRDIR%\schoolradar" "." /E /IS /NFL /NDL /NJH /NJS >nul
rd /s /q "%SRDIR%"
if not exist "dev.js" goto srFail
echo         받았습니다.
goto srDone

:srFail
del "_sr.zip" >nul 2>&1
echo.
echo   [멈춤] 화면 파일을 못 받았습니다. 인터넷 연결을 확인하고 다시 실행하세요.
echo.
pause & exit /b 1

:srDone

rem ───────── 3/3 의존성 ─────────
echo   [3/3] 필요한 것을 설치합니다...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo.
  echo   [멈춤] npm install 에 실패했습니다. 인터넷 연결을 확인하고 다시 실행하세요.
  echo.
  pause & exit /b 1
)

rem ───────── 받은 것이 다 있는지 ─────────
set "MISS="
for %%F in (dev.js README.md api\gongsi.js api\collect.js api\schoolinfo.js api\vault.js api\report.js public\index.html public\app.html public\vault.html public\style.css public\catalog.js build-schools.js build-kess.js regions.json) do (
  if not exist "%%F" set "MISS=%%F"
)
if defined MISS (
  echo.
  echo   [멈춤] 빠진 파일이 있습니다: %MISS%
  echo   이 파일을 다시 실행해 보고, 또 그러면 화면을 그대로 보여 주세요.
  echo.
  pause ^& exit /b 1
)
if not exist "스쿨레이더.bat" (
  echo.
  echo   [주의] 한글 이름의 실행 파일이 제대로 풀리지 않았습니다.
  echo   폴더 안에 "스쿨레이더.bat" 과 "색인만들기.bat" 이 보이는지 확인하세요.
  echo   이름이 깨져 있으면 화면을 그대로 보여 주세요.
  echo.
)

echo.
echo   ========================================
echo   설치가 끝났습니다.
echo.

findstr /C:"const API_KEY = '여기에_인증키'" api\schoolinfo.js >nul 2>&1
if errorlevel 1 (
  echo   인증키는 이미 들어 있습니다.
  echo   다음: "색인만들기.bat" 을 실행하세요.
  echo.
  pause & exit /b 0
)

echo   다음은 인증키입니다. 지금 창을 둘 띄웁니다.
echo.
echo     1. 브라우저  — 네이버나 카카오로 로그인하고 사용 목적을 등록하면
echo                    키가 바로 나옵니다. 무료입니다.
echo     2. 메모장    — 맨 위 24번째 줄
echo                      const API_KEY = '여기에_인증키';
echo                    의 따옴표 안을 받은 키로 바꾸고 Ctrl+S 로 저장하세요.
echo                    따옴표는 지우지 마세요.
echo.
echo   그 뒤 "색인만들기.bat" 을 실행하면 됩니다.
echo.
timeout /t 3 /nobreak >nul
start "" https://www.schoolinfo.go.kr/ng/go/pnnggo_a01_m0.do
start "" notepad api\schoolinfo.js
pause

exit /b 0

rem ───────── 내려받아 풀기 ─────────
rem   %1 주소   %2 임시파일   %3 최소 바이트(이보다 작으면 zip 이 아니라 안내 페이지다)
:get
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
 "$ErrorActionPreference='Stop';" ^
 "try { [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12 } catch {};" ^
 "Invoke-WebRequest -Uri '%~1' -OutFile '%~2' -UseBasicParsing;" ^
 "if ((Get-Item '%~2').Length -lt %~3) { exit 2 };" ^
 "Expand-Archive -LiteralPath '%~2' -DestinationPath '.' -Force;" ^
 "Remove-Item '%~2' -Force"
if errorlevel 1 (
  del "%~2" >nul 2>&1
  exit /b 1
)
exit /b 0
