@echo off
setlocal
title Build MC-707 Toolbox
cd /d "%~dp0"
echo.
echo  Building MC-707-Toolbox.exe
echo  The first build downloads about 250 MB and takes 2 to 5 minutes.
echo  Everything it prints is saved to build-log.txt.
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo  Node.js is not installed.
  echo  Install the LTS version from https://nodejs.org , then double-click this file again.
  echo.
  pause
  exit /b 1
)
set CSC_IDENTITY_AUTO_DISCOVERY=false
set NPM_CONFIG_UPDATE_NOTIFIER=false
echo  Step 1 of 2: downloading the tools...
call npm install --no-audit --no-fund --loglevel=error > build-log.txt 2>&1
if errorlevel 1 goto failed
echo  Step 2 of 2: packaging the app...
call npm run dist >> build-log.txt 2>&1
if errorlevel 1 goto failed
if not exist "dist\MC-707-Toolbox.exe" goto failed
echo.
echo  Done. Your app is here:  %~dp0dist\MC-707-Toolbox.exe
echo  Copy it anywhere you like. It needs no installer.
echo.
echo  Windows may show a blue "Windows protected your PC" box the first time,
echo  because the app is not code-signed. Click More info, then Run anyway.
echo.
pause
exit /b 0
:failed
echo.
echo  Something went wrong. The details are in build-log.txt next to this file.
echo  Common causes: no internet connection, or a work/school PC that blocks downloads.
echo.
pause
exit /b 1
