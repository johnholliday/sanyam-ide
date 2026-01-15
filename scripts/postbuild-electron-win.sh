#!/bin/bash
# Post-build script to automatically build Windows Electron after Linux build
# Only runs if WSL is detected and SKIP_WIN_BUILD is not set

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Skip if SKIP_WIN_BUILD is set
if [ -n "$SKIP_WIN_BUILD" ]; then
    echo "[postbuild] SKIP_WIN_BUILD is set, skipping Windows Electron build"
    exit 0
fi

# Check if we're in WSL
if ! grep -qEi "(microsoft|wsl)" /proc/version 2>/dev/null; then
    echo "[postbuild] Not in WSL, skipping Windows Electron build"
    exit 0
fi

# Check if cmd.exe is available
if ! command -v cmd.exe &> /dev/null; then
    echo "[postbuild] cmd.exe not found, skipping Windows Electron build"
    exit 0
fi

echo ""
echo "=========================================="
echo "Building Windows Electron version..."
echo "=========================================="
echo ""

# Run the Windows Electron build
bash "$PROJECT_ROOT/scripts/build-electron-win.sh"

echo ""
echo "=========================================="
echo "Dual-platform build complete!"
echo "  - Linux: Ready for development"
echo "  - Windows: Ready in applications/electron-app"
echo "=========================================="
