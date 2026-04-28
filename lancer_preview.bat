@echo off
title Cadre Logique - Preview

cd /d "%~dp0"

echo Verification de Node.js...
where node >nul 2>&1
if errorlevel 1 (
  echo ERREUR: Node.js introuvable.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installation des dependances...
  call npm install
  if errorlevel 1 (
    echo ERREUR: npm install a echoue.
    pause
    exit /b 1
  )
)

echo Build production...
call npm run build
if errorlevel 1 (
  echo ERREUR: build echoue.
  pause
  exit /b 1
)

echo Demarrage preview...
start "Cadre Logique Preview" cmd /k "npm run preview"

timeout /t 6 /nobreak >nul
start "" "http://localhost:4174"

pause