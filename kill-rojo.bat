@echo off
echo Killing Rojo processes...

REM Find and kill processes using port 34872 (default)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :34872') do (
    echo Killing PID %%a on port 34872
    taskkill /PID %%a /F 2>nul
)

REM Find and kill processes using port 34875 (isolated)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :34875') do (
    echo Killing PID %%a on port 34875
    taskkill /PID %%a /F 2>nul
)

REM Kill any rojo.exe processes
taskkill /IM rojo.exe /F 2>nul

echo Done!
pause