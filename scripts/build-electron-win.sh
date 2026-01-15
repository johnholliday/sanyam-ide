#!/bin/bash
# Build Electron app for Windows from WSL
# Strategy: Build with Linux, then rebuild native modules for Windows

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WIN_PROJECT_ROOT=$(wslpath -w "$PROJECT_ROOT")
APP_PATH="$PROJECT_ROOT/applications/electron"
NATIVE_DIR="$APP_PATH/lib/backend/native"
ELECTRON_VERSION="38.4.0"

echo "Building Electron app for Windows..."
echo "Project: $PROJECT_ROOT"

# Helper function to run cmd.exe from a Windows-compatible path
run_win_cmd() {
    (cd /mnt/c && cmd.exe /c "$@")
}

# Step 0: Ensure @theia/ffmpeg is built for Electron Linux (required for Theia build)
echo ""
echo "Step 0: Ensuring @theia/ffmpeg is built for Electron Linux..."
FFMPEG_NODE="$PROJECT_ROOT/node_modules/@theia/ffmpeg/build/Release/ffmpeg.node"
if [ -f "$FFMPEG_NODE" ]; then
    if file "$FFMPEG_NODE" | grep -q "PE32+"; then
        echo "  ffmpeg.node is Windows binary, rebuilding for Linux Electron..."
        (cd "$PROJECT_ROOT/node_modules/@theia/ffmpeg" && rm -rf build && npx node-gyp rebuild --target=$ELECTRON_VERSION --arch=x64 --dist-url=https://electronjs.org/headers)
    else
        echo "  ffmpeg.node is already Linux binary"
    fi
else
    echo "  ffmpeg.node not found, building for Linux Electron..."
    (cd "$PROJECT_ROOT/node_modules/@theia/ffmpeg" && npx node-gyp rebuild --target=$ELECTRON_VERSION --arch=x64 --dist-url=https://electronjs.org/headers)
fi

# Step 1: Build with Linux (normal Theia build)
echo ""
echo "Step 1: Running normal Theia build (Linux)..."
cd "$PROJECT_ROOT"
pnpm theia:electron build

# Step 2: Rebuild native modules for Windows using node-gyp
echo ""
echo "Step 2: Rebuilding native modules for Windows..."

NATIVE_MODULES=(
    "native-keymap"
    "drivelist"
    "keytar"
    "node-pty"
)

for module in "${NATIVE_MODULES[@]}"; do
    echo "  Rebuilding $module..."
    run_win_cmd "pushd ${WIN_PROJECT_ROOT}\\node_modules\\${module} && node-gyp rebuild --target=${ELECTRON_VERSION} --arch=x64 --dist-url=https://electronjs.org/headers" 2>&1 | tail -3
done

# Step 3: Rebuild @theia/ffmpeg for Windows
echo ""
echo "Step 3: Rebuilding @theia/ffmpeg for Windows..."
run_win_cmd "pushd ${WIN_PROJECT_ROOT}\\node_modules\\@theia\\ffmpeg && node-gyp rebuild --target=${ELECTRON_VERSION} --arch=x64 --dist-url=https://electronjs.org/headers" 2>&1 | tail -3

# Step 4: Download Windows ripgrep
echo ""
echo "Step 4: Downloading Windows ripgrep..."
run_win_cmd "pushd ${WIN_PROJECT_ROOT}\\node_modules\\@vscode\\ripgrep && node lib\\postinstall.js --force" 2>&1 | tail -3

# Step 5: Copy native modules to lib/backend/native
echo ""
echo "Step 5: Copying Windows native modules..."

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

# Handle @parcel/watcher from prebuilt package
WATCHER_SRC="$PROJECT_ROOT/node_modules/@parcel/watcher-win32-x64/watcher.node"
if [ -f "$WATCHER_SRC" ]; then
    echo "  Copying watcher.node from prebuilt package..."
    cp "$WATCHER_SRC" "$NATIVE_DIR/watcher.node"
else
    echo "  Warning: $WATCHER_SRC not found"
fi

# Handle ripgrep
RIPGREP_SRC="$PROJECT_ROOT/node_modules/@vscode/ripgrep/bin/rg.exe"
if [ -f "$RIPGREP_SRC" ]; then
    echo "  Copying ripgrep..."
    cp "$RIPGREP_SRC" "$NATIVE_DIR/rg"
else
    echo "  Warning: $RIPGREP_SRC not found"
fi

# Step 6: Verify Windows binaries
echo ""
echo "Step 6: Verifying Windows binaries..."
for file in "$NATIVE_DIR"/*; do
    file_type=$(file "$file" | grep -o "PE32+" || echo "NOT Windows")
    echo "  $(basename $file): $file_type"
done

# Step 7: Swap back to Linux modules to keep node_modules Linux-compatible
# Use --skip-bundled to preserve Windows binaries in lib/backend/native/
echo ""
echo "Step 7: Restoring Linux native modules in node_modules..."
bash "$PROJECT_ROOT/scripts/swap-native-modules.sh" linux --skip-bundled

echo ""
echo "Build complete! Run 'pnpm start:electron:win' to launch."
echo "Note: Windows binaries are in lib/backend/native/, node_modules stays Linux-compatible."
