@echo off
chcp 65001 >nul
title Time Party - ishga tushirish
cd /d "%~dp0"

REM Node.js yo'lini topamiz (PATH'da bo'lmasa ham ishlaydi)
set "NODE_EXE=node"
set "NPM_CMD=npm"
if exist "C:\Program Files\nodejs\node.exe" (
  set "NODE_EXE=C:\Program Files\nodejs\node.exe"
  set "NPM_CMD=C:\Program Files\nodejs\npm.cmd"
)

set "PATH=C:\Program Files\nodejs;%PATH%"

echo ============================================
echo   TIME PARTY - ishga tushirilmoqda...
echo ============================================
echo.

REM 1) Eski node processlarni to'xtatish (port band bo'lmasligi uchun)
echo [1/5] Eski serverlar to'xtatilmoqda...
taskkill /F /IM node.exe >nul 2>&1
REM 2) Paketlar o'rnatilganligini tekshirish
if not exist "node_modules" (
  echo [2/5] Paketlar o'rnatilmoqda ^(bir necha daqiqa^)...
  call npm install
)
if not exist "server\node_modules" (
  echo [2/5] Backend paketlari o'rnatilmoqda...
  call npm --prefix server install
)

REM 3) Frontend'ni build qilish (toza, keshsiz kod)
echo [3/5] Kod yangilanmoqda...
call "%NPM_CMD%" run build
REM 4) Ma'lumot
echo.
echo ============================================
echo   MANZIL:  http://localhost:4000
echo   Admin:   http://localhost:4000/admin
echo   Ustoz:   http://localhost:4000/teacher
echo ============================================
echo.
echo [4/5] Server ishga tushirilmoqda...
echo   Brauzer 5 sekunddan keyin avtomatik ochiladi.
echo   To'xtatish uchun Ctrl+C bosing.
echo.

REM 5) Brauzerni ochish (server ko'tarilgach)
start "" /min cmd /c "timeout /t 5 >nul & start http://localhost:4000"

"%NODE_EXE%" server\index.js
pause
