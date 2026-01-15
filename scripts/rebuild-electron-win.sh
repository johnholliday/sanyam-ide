#!/bin/bash
# Force rebuild native modules for Windows
# Uses cmd.exe to avoid PowerShell execution policy issues

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WIN_APP_PATH=$(wslpath -w "$PROJECT_ROOT/applications/electron-app")

echo "Rebuilding native modules for Windows..."
echo "Path: $WIN_APP_PATH"

# Change to /mnt/c to avoid UNC path issues, then use pushd in cmd.exe
# Note: Don't quote the path inside cmd.exe - pushd handles spaces in UNC paths
(cd /mnt/c && cmd.exe /c "pushd ${WIN_APP_PATH} && pnpm rebuild")

echo "Rebuild complete."
