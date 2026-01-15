#!/bin/bash
# Launch Electron on Windows from WSL with auto-rebuild
# Uses cmd.exe to avoid PowerShell execution policy issues

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WIN_PROJECT_ROOT=$(wslpath -w "$PROJECT_ROOT")
WIN_APP_PATH="${WIN_PROJECT_ROOT}\\applications\\electron"
WIN_ELECTRON_PATH="${WIN_PROJECT_ROOT}\\node_modules\\electron\\dist-win32\\electron.exe"

echo "Starting Electron development environment..."
echo "WSL Project: $PROJECT_ROOT"
echo "Windows App Path: $WIN_APP_PATH"

# Check if Windows Electron exists
if [ ! -f "$PROJECT_ROOT/node_modules/electron/dist-win32/electron.exe" ]; then
    echo "Windows Electron not found. Running setup..."
    bash "$PROJECT_ROOT/scripts/setup-electron-win.sh"
fi

# Helper function to run cmd.exe from a Windows-compatible path
run_win_cmd() {
    # Change to /mnt/c to avoid UNC path issues with cmd.exe
    (cd /mnt/c && cmd.exe /c "$@")
}

# Check if Windows native modules exist, rebuild if missing
check_and_rebuild() {
    local native_dir="$PROJECT_ROOT/applications/electron/lib/backend/native"
    local check_file="$native_dir/keymapping.node"
    echo "Checking for Windows native modules..."

    if [ ! -f "$check_file" ]; then
        echo "Windows native modules not found. Rebuilding..."
        bash "$PROJECT_ROOT/scripts/rebuild-electron-win.sh"
    else
        # Verify it's actually a Windows binary
        if file "$check_file" | grep -q "PE32+"; then
            echo "Windows native modules found."
        else
            echo "Native modules are Linux binaries. Rebuilding for Windows..."
            bash "$PROJECT_ROOT/scripts/rebuild-electron-win.sh"
        fi
    fi
}

check_and_rebuild

# Launch Electron using Windows Electron binary (no quotes needed for UNC paths without spaces)
# --disable-gpu-sandbox is needed when running from WSL filesystem via UNC paths
echo "Launching Electron on Windows..."
run_win_cmd "pushd ${WIN_APP_PATH} && set NODE_ENV=development && ${WIN_ELECTRON_PATH} scripts\\theia-electron-main.js --plugins=local-dir:..\\plugins --disable-gpu-sandbox --no-sandbox"
