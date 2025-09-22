#!/bin/bash

# ============================================================================
# PurgeBot - Discord Command Registration
# Registers and synchronizes slash commands with Discord API
# ============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Display script header
echo "============================================"
echo "PurgeBot - Discord Command Registration"
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

# Check if TypeScript build exists
if [ ! -d "dist" ]; then
    echo -e "${YELLOW}[WARNING] No dist folder found. Building TypeScript project...${NC}"
    npm run build
    if [ $? -ne 0 ]; then
        echo -e "${RED}[ERROR] Failed to build TypeScript project.${NC}"
        exit 1
    fi
fi

echo -e "${BLUE}[INFO] Registering Discord slash commands...${NC}"
echo "============================================"
echo

# Run the command registration
npm run register
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo
    echo "============================================"
    echo -e "${GREEN}[SUCCESS] Registration completed successfully!${NC}"
    echo "============================================"
    echo "Commands have been registered with Discord."
    echo
    echo "Note: It may take a few minutes for commands to appear in Discord."
else
    echo
    echo "============================================"
    echo -e "${RED}[ERROR] Registration failed with error code $EXIT_CODE${NC}"
    echo "============================================"
    echo "Please check your bot token and environment configuration."
fi

echo
echo "Press Enter to exit..."
read