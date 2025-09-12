@ECHO OFF
SETLOCAL ENABLEDELAYEDEXPANSION

REM =====================================================
REM PurgeBot - Development Mode Launcher
REM Runs TypeScript in watch mode for development
REM =====================================================

REM Set console title for better identification
TITLE PurgeBot - Development Mode

REM Display script header
ECHO ============================================
ECHO PurgeBot - Development Mode
ECHO ============================================
ECHO.

REM Check if Node.js is installed and accessible
node --version >NUL 2>&1
IF %ERRORLEVEL% NEQ 0 (
    ECHO [ERROR] Node.js is not installed or not in PATH.
    ECHO Please install Node.js and ensure it's added to your system PATH.
    PAUSE
    EXIT /B 1
)

REM Check if node_modules exists
IF NOT EXIST "node_modules" (
    ECHO [WARNING] No node_modules found.
    ECHO Installing dependencies first...
    npm install
    IF %ERRORLEVEL% NEQ 0 (
        ECHO [ERROR] Failed to install dependencies.
        PAUSE
        EXIT /B 1
    )
    ECHO.
)

REM Check if .env file exists
IF NOT EXIST ".env" (
    ECHO [ERROR] .env file not found.
    ECHO Please create a .env file with your bot configuration.
    ECHO You can copy .env.example to .env and modify it.
    PAUSE
    EXIT /B 1
)

REM Check if tsconfig.json exists
IF NOT EXIST "tsconfig.json" (
    ECHO [ERROR] tsconfig.json not found in current directory.
    ECHO Please ensure TypeScript is properly configured.
    PAUSE
    EXIT /B 1
)

ECHO [INFO] Starting TypeScript in watch mode...
ECHO [INFO] Any changes to .ts files will trigger automatic rebuild
ECHO =====================================================
ECHO.

REM Run TypeScript in watch mode
npm run dev

REM Check if the watch process ended
IF %ERRORLEVEL% NEQ 0 (
    ECHO.
    ECHO =====================================================
    ECHO [ERROR] TypeScript watch mode failed with error code: %ERRORLEVEL%
    ECHO =====================================================
) ELSE (
    ECHO.
    ECHO =====================================================
    ECHO [INFO] TypeScript watch mode ended.
    ECHO =====================================================
)

ECHO.
ECHO Press any key to exit...
PAUSE >NUL