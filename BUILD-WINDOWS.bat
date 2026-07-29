@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required.
  echo Install the LTS version from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)

call npm install
if errorlevel 1 (
  echo Setup did not finish. Check your internet connection and try again.
  pause
  exit /b 1
)

call npm run verify
if errorlevel 1 (
  echo Verification failed, so no app was packaged.
  pause
  exit /b 1
)

call npm run build:windows
if errorlevel 1 (
  echo The Windows build did not finish.
  pause
  exit /b 1
)

echo.
echo Done. Your portable app is in the dist folder.
pause
endlocal
