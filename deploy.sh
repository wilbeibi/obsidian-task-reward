#!/bin/bash

# Task Reward Plugin Deployment Script
# Usage: ./deploy.sh [vault-path]

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Task Reward Plugin Deployment ===${NC}\n"

# Check if vault path is provided
if [ -z "$1" ]; then
    echo -e "${YELLOW}Usage: ./deploy.sh /path/to/your/vault${NC}"
    echo -e "${YELLOW}Example: ./deploy.sh ~/Documents/MyVault${NC}\n"
    exit 1
fi

VAULT_PATH="$1"
PLUGIN_DIR="$VAULT_PATH/.obsidian/plugins/task-reward"

# Validate vault path
if [ ! -d "$VAULT_PATH" ]; then
    echo -e "${RED}Error: Vault path does not exist: $VAULT_PATH${NC}"
    exit 1
fi

# Validate required files
if [ ! -f "main.js" ]; then
    echo -e "${RED}Error: main.js not found. Please run 'npm run build' first${NC}"
    exit 1
fi

if [ ! -f "manifest.json" ]; then
    echo -e "${RED}Error: manifest.json not found${NC}"
    exit 1
fi

# Create plugin directory
echo "Creating plugin directory..."
mkdir -p "$PLUGIN_DIR"

# Copy core files
echo "Copying core files..."
cp main.js "$PLUGIN_DIR/"
cp manifest.json "$PLUGIN_DIR/"

echo -e "${GREEN}✓ Core files copied${NC}"

# Copy audio file (if exists)
if [ -d "sound" ]; then
    echo "Audio folder detected..."
    mkdir -p "$PLUGIN_DIR/sound"

    if [ -f "sound/reward.m4a" ]; then
        cp sound/reward.m4a "$PLUGIN_DIR/sound/"
        echo -e "${GREEN}✓ reward.m4a copied${NC}"
    fi

    if [ -f "sound/reward.mp3" ]; then
        cp sound/reward.mp3 "$PLUGIN_DIR/sound/"
        echo -e "${GREEN}✓ reward.mp3 copied${NC}"
    fi

    if [ ! -f "sound/reward.m4a" ] && [ ! -f "sound/reward.mp3" ]; then
        echo -e "${YELLOW}⚠ No audio file found in sound/ (plugin will fall back to synthesized tones)${NC}"
    fi
else
    echo -e "${YELLOW}⚠ No sound/ folder found (plugin will fall back to synthesized tones)${NC}"
fi

echo -e "\n${GREEN}=== Deployment Complete ===${NC}"
echo -e "Plugin installed to: ${PLUGIN_DIR}"
echo -e "\nNext steps:"
echo -e "1. Open Obsidian"
echo -e "2. Go to Settings → Community Plugins"
echo -e "3. Disable Safe Mode (if enabled)"
echo -e "4. Enable 'Task Reward' plugin"
echo -e "5. Enjoy your rewards! 🎉\n"
