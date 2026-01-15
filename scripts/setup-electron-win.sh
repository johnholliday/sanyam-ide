#!/bin/bash
# Download Windows Electron binary for WSL development
# This creates a separate dist-win32 directory with Windows Electron

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ELECTRON_PKG="$PROJECT_ROOT/node_modules/electron"
DIST_WIN32="$ELECTRON_PKG/dist-win32"

# Get electron version from package.json
ELECTRON_VERSION=$(node -e "console.log(require('$ELECTRON_PKG/package.json').version)")
echo "Setting up Windows Electron v$ELECTRON_VERSION..."

# Check if already downloaded
if [ -f "$DIST_WIN32/electron.exe" ]; then
    echo "Windows Electron already exists at $DIST_WIN32"
    exit 0
fi

# Create dist-win32 directory
mkdir -p "$DIST_WIN32"

# Download URL for Windows x64
DOWNLOAD_URL="https://github.com/electron/electron/releases/download/v${ELECTRON_VERSION}/electron-v${ELECTRON_VERSION}-win32-x64.zip"

echo "Downloading Windows Electron from: $DOWNLOAD_URL"
TEMP_ZIP="/tmp/electron-win32.zip"

# Download
curl -L -o "$TEMP_ZIP" "$DOWNLOAD_URL"

# Extract
echo "Extracting to $DIST_WIN32..."
unzip -o "$TEMP_ZIP" -d "$DIST_WIN32"

# Cleanup
rm "$TEMP_ZIP"

echo "Windows Electron setup complete!"
echo "Location: $DIST_WIN32/electron.exe"
