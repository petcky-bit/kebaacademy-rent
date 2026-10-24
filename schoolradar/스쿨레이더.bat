@echo off
chcp 65001 >nul
title 스쿨레이더
cd /d "%~dp0"

echo.
echo   스쿨레이더
echo   ----------------------------------------
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo   Node.js 가 없습니다.
  echo   nodejs.org 에서 LTS 를 설치한 뒤 이 파일을 다시 실행하세요.
  echo.
  pause
  exit /b 1
)

if not exist "dev.js" (
  echo   dev.js 가 없습니다. 이 파일을 스쿨레이더 폴더 안에 두고 실행하세요.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo   처음 실행이라 필요한 것을 내려받습니다. 몇 분 걸립니다...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo   설치에 실패했습니다. 인터넷 연결을 확인하고 다시 실행하세요.
    echo.
    pause
    exit /b 1
  )
  echo.
)

findstr /C:"const API_KEY = '여기에_인증키'" api\schoolinfo.js >nul 2>&1
if not errorlevel 1 (
  echo   인증키가 아직 없습니다. 먼저 "색인만들기.bat" 을 실행하세요.
  echo   거기에 발급 방법이 적혀 있습니다.
  echo.
  pause
  exit /b 1
)

if not exist "public\schools.json" (
  echo   학교 색인이 아직 없습니다. 먼저 "색인만들기.bat" 을 실행하세요.
  echo   그걸 돌려야 학교 검색이 됩니다. 1년에 한 번이면 충분합니다.
  echo.
  pause
  exit /b 1
)

echo   브라우저가 곧 열립니다.  http://localhost:3000
echo   이 검은 창을 닫으면 스쿨레이더가 멈춥니다.
echo.

start "" /b cmd /c timeout /t 3 /nobreak ^>nul ^& start http://localhost:3000

node dev.js

echo.
echo   스쿨레이더가 멈췄습니다.
echo   위에 "EADDRINUSE" 가 보이면 이미 다른 창에서 돌고 있는 것입니다.
echo.
pause
