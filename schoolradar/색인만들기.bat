@echo off
chcp 65001 >nul
title 스쿨레이더 — 색인 만들기
cd /d "%~dp0"

echo.
echo   스쿨레이더 — 색인 만들기
echo   ----------------------------------------
echo   1년에 한 번만 하면 됩니다. 10분쯤 걸립니다.
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo   Node.js 가 없습니다. nodejs.org 에서 LTS 를 설치하세요.
  echo.
  pause & exit /b 1
)

if not exist "node_modules\" (
  echo   [0/2] 필요한 것을 내려받습니다...
  call npm install || (echo   설치 실패. & pause & exit /b 1)
  echo.
)

findstr /C:"const API_KEY = '여기에_인증키'" api\schoolinfo.js >nul 2>&1
if not errorlevel 1 (
  echo   인증키가 아직 없습니다.
  echo.
  echo   1. https://www.schoolinfo.go.kr/ng/go/pnnggo_a01_m0.do  에 들어가
  echo      네이버나 카카오로 로그인하고 사용 목적을 등록하면 키가 바로 나옵니다. 무료입니다.
  echo   2. 메모장으로  api\schoolinfo.js  를 열어 맨 위
  echo        const API_KEY = '여기에_인증키';
  echo      의 따옴표 안을 받은 키로 바꾸고 저장하세요.
  echo   3. 이 파일을 다시 실행하세요.
  echo.
  pause & exit /b 1
)

echo   [1/2] 전국 학교 색인을 만듭니다 (몇 분)...
call node build-schools.js
if errorlevel 1 (
  echo.
  echo   실패했습니다. 위 메시지를 그대로 들고 오세요. 거의 언제나 인증키 문제입니다.
  echo.
  pause & exit /b 1
)
echo.

echo   [2/2] 졸업생 진로 색인을 만듭니다 (몇 분, 약 90MB 내려받음)...
call node build-kess.js
if errorlevel 1 (
  echo.
  echo   실패했습니다. 위 메시지를 그대로 들고 오세요.
  echo.
  pause & exit /b 1
)

echo.
echo   끝났습니다. 이제 스쿨레이더.bat 을 실행하세요.
echo.
pause
