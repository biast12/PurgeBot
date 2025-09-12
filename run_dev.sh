#!/bin/bash

# =====================================================
# PurgeBot - Development Mode Launcher
# Runs TypeScript in watch mode for development
# =====================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Display script header
echo "============================================"
echo "PurgeBot - Development Mode"
echo "============================================"
echo

# Check if Node.js is installed and accessible
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR] Node.js is not installed or not in PATH.${NC}"
    echo "Please install Node.js and ensure it's added to your system PATH."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}[WARNING] No node_modules found.${NC}"
    echo "Installing dependencies first..."
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}[ERROR] Failed to install dependencies.${NC}"
        exit 1
    fi
    echo
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${RED}[ERROR] .env file not found.${NC}"
    echo "Please create a .env file with your bot configuration."
    echo "You can copy .env.example to .env and modify it."
    exit 1
fi

# Check if tsconfig.json exists
if [ ! -f "tsconfig.json" ]; then
    echo -e "${RED}[ERROR] tsconfig.json not found in current directory.${NC}"
    echo "Please ensure TypeScript is properly configured."
    exit 1
fi

echo -e "${BLUE}[INFO] Starting TypeScript in watch mode...${NC}"
echo -e "${BLUE}[INFO] Any changes to .ts files will trigger automatic rebuild${NC}"
echo "====================================================="
echo

# Run TypeScript in watch mode
npm run dev
EXIT_CODE=$?

# Check if the watch process ended
if [ $EXIT_CODE -ne 0 ]; then
    echo
    echo "====================================================="
    echo -e "${RED}[ERROR] TypeScript watch mode failed with error code: $EXIT_CODE${NC}"
    echo "====================================================="
else
    echo
    echo "====================================================="
    echo -e "${BLUE}[INFO] TypeScript watch mode ended.${NC}"
    echo "====================================================="
fi

echo
echo "Press Enter to exit..."
read