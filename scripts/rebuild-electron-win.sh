#!/bin/bash
# Force rebuild native modules for Windows
# Uses @electron/rebuild on Windows to properly build native modules

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WIN_PROJECT_ROOT=$(wslpath -w "$PROJECT_ROOT")
APP_PATH="$PROJECT_ROOT/applications/electron"
NATIVE_DIR="$APP_PATH/lib/backend/native"
ELECTRON_VERSION="38.4.0"

echo "Rebuilding native modules for Windows..."
echo "Project: $PROJECT_ROOT"

# Helper function to run cmd.exe from a Windows-compatible path
run_win_cmd() {
    (cd /mnt/c && cmd.exe /c "$@")
}

# Step 1: Install @electron/rebuild if not present
echo ""
echo "Step 1: Ensuring @electron/rebuild is available..."
if [ ! -d "$PROJECT_ROOT/node_modules/@electron/rebuild" ]; then
    echo "  Installing @electron/rebuild..."
    pnpm add -D @electron/rebuild
fi

# Step 2: Use electron-rebuild from Windows to rebuild native modules
echo ""
echo "Step 2: Rebuilding native modules using electron-rebuild on Windows..."
echo "  This requires Windows Visual Studio Build Tools to be installed."
echo "  If this fails, install them from: https://visualstudio.microsoft.com/visual-cpp-build-tools/"
echo ""

# Run electron-rebuild from Windows
run_win_cmd "pushd ${WIN_PROJECT_ROOT} && npx electron-rebuild -v ${ELECTRON_VERSION} -m . --force" 2>&1 || {
    echo ""
    echo "ERROR: electron-rebuild failed."
    echo "Make sure Windows Visual Studio Build Tools are installed:"
    echo "  1. Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/"
    echo "  2. Install 'Desktop development with C++' workload"
    echo "  3. Re-run this script"
    exit 1
}

# Step 3: Download Windows-specific optional packages
echo ""
echo "Step 3: Installing Windows-specific packages..."

# Install @parcel/watcher-win32-x64
WATCHER_WIN_PKG="$PROJECT_ROOT/node_modules/@parcel/watcher-win32-x64"
if [ ! -d "$WATCHER_WIN_PKG" ]; then
    echo "  Downloading @parcel/watcher-win32-x64..."
    npm pack @parcel/watcher-win32-x64@2.5.4 --pack-destination /tmp >/dev/null 2>&1
    mkdir -p "$WATCHER_WIN_PKG"
    tar -xzf /tmp/parcel-watcher-win32-x64-2.5.4.tgz -C "$WATCHER_WIN_PKG" --strip-components=1
    rm -f /tmp/parcel-watcher-win32-x64-2.5.4.tgz
    echo "  Installed @parcel/watcher-win32-x64"
else
    echo "  @parcel/watcher-win32-x64 already installed"
fi

# Step 4: Download Windows ripgrep
echo ""
echo "Step 4: Downloading Windows ripgrep..."
RIPGREP_DIR="$PROJECT_ROOT/node_modules/@vscode/ripgrep/bin"
RIPGREP_WIN="$RIPGREP_DIR/rg.exe"
if [ ! -f "$RIPGREP_WIN" ]; then
    RG_VERSION="15.0.0"
    RG_URL="https://github.com/BurntSushi/ripgrep/releases/download/${RG_VERSION}/ripgrep-${RG_VERSION}-x86_64-pc-windows-msvc.zip"
    echo "  Downloading from $RG_URL..."
    curl -sL "$RG_URL" -o /tmp/rg.zip
    unzip -q -o /tmp/rg.zip -d /tmp/rg
    cp "/tmp/rg/ripgrep-${RG_VERSION}-x86_64-pc-windows-msvc/rg.exe" "$RIPGREP_WIN"
    rm -rf /tmp/rg /tmp/rg.zip
    echo "  Downloaded rg.exe"
else
    echo "  rg.exe already present"
fi

# Step 5: Copy native modules to lib/backend/native
echo ""
echo "Step 5: Copying Windows native modules to bundled location..."

mkdir -p "$NATIVE_DIR"

# Map of destination names to source locations
declare -A MODULE_MAP=(
    ["drivelist.node"]="node_modules/drivelist/build/Release/drivelist.node"
    ["keymapping.node"]="node_modules/native-keymap/build/Release/keymapping.node"
    ["keytar.node"]="node_modules/keytar/build/Release/keytar.node"
    ["pty.node"]="node_modules/node-pty/build/Release/pty.node"
)

for dest_name in "${!MODULE_MAP[@]}"; do
    src="$PROJECT_ROOT/${MODULE_MAP[$dest_name]}"
    dst="$NATIVE_DIR/$dest_name"
    if [ -f "$src" ]; then
        echo "  Copying $dest_name..."
        cp "$src" "$dst"
    else
        echo "  Warning: $src not found"
    fi
done

# Copy watcher from the Win32 package
WATCHER_SRC="$PROJECT_ROOT/node_modules/@parcel/watcher-win32-x64/watcher.node"
if [ -f "$WATCHER_SRC" ]; then
    echo "  Copying watcher.node..."
    cp "$WATCHER_SRC" "$NATIVE_DIR/watcher.node"
fi

# Copy ripgrep
if [ -f "$RIPGREP_WIN" ]; then
    echo "  Copying rg.exe..."
    cp "$RIPGREP_WIN" "$NATIVE_DIR/rg"
fi

# Step 6: Verify Windows binaries
echo ""
echo "Step 6: Verifying Windows binaries..."
WIN_COUNT=0
TOTAL_COUNT=0
for file in "$NATIVE_DIR"/*; do
    if [ -f "$file" ]; then
        TOTAL_COUNT=$((TOTAL_COUNT + 1))
        if file "$file" | grep -q "PE32+"; then
            echo "  ✓ $(basename $file): Windows PE32+"
            WIN_COUNT=$((WIN_COUNT + 1))
        else
            echo "  ✗ $(basename $file): NOT Windows"
        fi
    fi
done

echo ""
if [ "$WIN_COUNT" -eq "$TOTAL_COUNT" ]; then
    echo "Rebuild complete! All $WIN_COUNT binaries are Windows PE32+."
else
    echo "Warning: Only $WIN_COUNT of $TOTAL_COUNT binaries are Windows PE32+."
    echo "The non-Windows binaries may cause issues when running on Windows."
fi
