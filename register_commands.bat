@ECHO OFF
SETLOCAL ENABLEDELAYEDEXPANSION

REM ============================================================================
REM PurgeBot - Discord Command Registration
REM Registers and synchronizes slash commands with Discord API
REM ============================================================================

REM Set console title for better identification
TITLE PurgeBot - Discord Command Registration

REM Display script header
ECHO ============================================
ECHO PurgeBot - Discord Command Registration
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

REM Check if TypeScript build exists
IF NOT EXIST "dist" (
    ECHO [WARNING] No dist folder found. Building TypeScript project...
    npm run build
    IF %ERRORLEVEL% NEQ 0 (
        ECHO [ERROR] Failed to build TypeScript project.
        PAUSE
        EXIT /B 1
    )
)

ECHO [INFO] Registering Discord slash commands...
ECHO ============================================
ECHO.

REM Run the command registration
npm run register

IF %ERRORLEVEL% EQU 0 (
    ECHO.
    ECHO ============================================
    ECHO [SUCCESS] Registration completed successfully!
    ECHO ============================================
    ECHO Commands have been registered with Discord.
    ECHO.
    ECHO Note: It may take a few minutes for commands to appear in Discord.
) ELSE (
    ECHO.
    ECHO ============================================
    ECHO [ERROR] Registration failed with error code %ERRORLEVEL%
    ECHO ============================================
    ECHO Please check your bot token and environment configuration.
)

ECHO.
ECHO Press any key to exit...
PAUSE >NUL