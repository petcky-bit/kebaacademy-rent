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

where curl >nul 2>&1
if errorlevel 1 goto noTools
where tar >nul 2>&1
if errorlevel 1 goto noTools
goto haveTools

:noTools
echo   [멈춤] 이 윈도에는 curl 또는 tar 가 없습니다 ^(윈도 10 1803 미만^).
echo   README.md 의 수동 설치 순서를 따라 주세요.
echo.
pause & exit /b 1

:haveTools

rem ───────── 1/3 씨앗 꾸러미 ─────────
if exist "api\gongsi.js" (
  echo   [1/3] 씨앗 꾸러미가 이미 있습니다. 건너뜁니다.
  goto seedDone
)

echo   [1/3] 씨앗 꾸러미를 받습니다...
curl -sSL -o "_seed.zip" "https://drive.google.com/uc?export=download&id=1G_fNMiAlIUVdUlMYJjEakzKAaLNHbVQy"
if not exist "_seed.zip" goto seedFail
for %%A in ("_seed.zip") do if %%~zA LSS 100000 goto seedFail

tar -xf "_seed.zip" || goto seedFail
del "_seed.zip" >nul 2>&1

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
curl -sSL -o "_sr.zip" "https://github.com/petcky-bit/kebaacademy-rent/archive/refs/heads/claude/gallant-maxwell-m8idlb.zip"
if not exist "_sr.zip" goto srFail
for %%A in ("_sr.zip") do if %%~zA LSS 20000 goto srFail

tar -xf "_sr.zip" || goto srFail
del "_sr.zip" >nul 2>&1

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
