@echo off
REM Quick Setup Script for Aarogya Backend (Windows)

echo.
echo 🏥 Aarogya Backend Setup Script
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is not installed. Please install from https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js found: 
node --version
echo ✅ npm found: 
npm --version
echo.

REM Install dependencies
echo 📦 Installing dependencies...
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo ✅ Dependencies installed
echo.

REM Check for .env file
if not exist .env (
    echo ⚠️  .env file not found. Creating from .env.example...
    copy .env.example .env
    echo 📝 Created .env file. Please edit it and add your ANTHROPIC_API_KEY
    echo.
)

REM Display next steps
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ✅ Setup complete!
echo.
echo 📝 Next steps:
echo 1. Edit .env file and add your Anthropic API key
echo 2. Start the server with one of:
echo    npm start          (production)
echo    npm run dev        (development with auto-reload)
echo 3. Open in browser:
echo    http://localhost:5000
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
pause
