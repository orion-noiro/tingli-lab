@echo off
title TingLi Lab - Mandarin Phonetic Mastery
echo ========================================================
echo   Iniciando TingLi Lab (http://localhost:3000)...
echo ========================================================
set "PATH=%USERPROFILE%\.local\bin;%PATH%"
cd /d "%~dp0"
start "" "http://localhost:3000"
npm run start
pause
