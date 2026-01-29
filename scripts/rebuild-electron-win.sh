#!/bin/bash
# Force rebuild native modules for Windows
# Downloads prebuilt Windows binaries where available, falls back to node-gyp on Windows

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WIN_PROJECT_ROOT=$(wslpath -w "$PROJECT_ROOT")
APP_PATH="$PROJECT_ROOT/applications/electron"
NATIVE_DIR="$APP_PATH/lib/backend/native"
ELECTRON_VERSION="38.4.0"

# Electron 38.x uses Node 22.x ABI (NODE_MODULE_VERSION=127)
# For prebuild-install, we pass --runtime electron --target $ELECTRON_VERSION

echo "Rebuilding native modules for Windows..."
echo "Project: $PROJECT_ROOT"

# Helper function to run commands on Windows via PowerShell 7 (loads profile for fnm/nvm)
run_win_cmd() {
    (cd /mnt/c && pwsh.exe -Command "$@")
}

mkdir -p "$NATIVE_DIR"

# Track results
SUCCEEDED=()
FAILED=()

# Helper: try prebuild-install from WSL to download a Windows prebuilt binary
# Usage: download_prebuild <package-name> <package-dir> <output-name>
download_prebuild() {
    local pkg_name="$1"
    local pkg_dir="$2"
    local output_name="$3"
    local build_release="$pkg_dir/build/Release/$output_name"

    echo ""
    echo "--- $pkg_name ---"

    if [ ! -d "$pkg_dir" ]; then
        echo "  Package dir not found: $pkg_dir"
        FAILED+=("$pkg_name (not installed)")
        return 1
    fi

    # Try prebuild-install to download Windows prebuilt
    echo "  Attempting prebuild-install for win32-x64..."
    if (cd "$pkg_dir" && npx prebuild-install --platform win32 --arch x64 --runtime electron --target "$ELECTRON_VERSION" --force 2>&1); then
        # Check if the output is a Windows binary
        if [ -f "$build_release" ] && file "$build_release" | grep -q "PE32+"; then
            echo "  ✓ Downloaded Windows prebuilt"
            cp "$build_release" "$NATIVE_DIR/$output_name"
            SUCCEEDED+=("$pkg_name")
            return 0
        fi
    fi

    echo "  Prebuild-install failed or no prebuilt available"
    return 1
}

# Helper: rebuild a single package using node-gyp on Windows
# Copies package to a Windows-native temp dir to avoid UNC path issues with cmd.exe/MSBuild
# Usage: rebuild_on_windows <package-name> <package-dir> <output-name>
rebuild_on_windows() {
    local pkg_name="$1"
    local pkg_dir="$2"
    local output_name="$3"

    # Use a Windows-native temp directory to avoid UNC path issues
    local win_temp_base="C:\\temp\\sanyam-rebuild"
    local wsl_temp_base="/mnt/c/temp/sanyam-rebuild"
    local pkg_temp="$wsl_temp_base/$pkg_name"

    echo "  Attempting node-gyp rebuild on Windows..."
    echo "  Copying package to Windows-native path..."

    # Clean and copy package to Windows temp
    rm -rf "$pkg_temp"
    mkdir -p "$pkg_temp"
    cp -r "$pkg_dir"/* "$pkg_temp"/
    # Copy binding.gyp if it exists (may not be caught by /*)
    [ -f "$pkg_dir/binding.gyp" ] && cp "$pkg_dir/binding.gyp" "$pkg_temp/"

    # Also copy node-addon-api so node-gyp can find it
    local napi_dir=$(resolve_pkg "node-addon-api")
    if [ -n "$napi_dir" ] && [ -d "$napi_dir" ]; then
        mkdir -p "$pkg_temp/node_modules/node-addon-api"
        cp -r "$napi_dir"/* "$pkg_temp/node_modules/node-addon-api/"
    fi

    local win_pkg_temp="${win_temp_base}\\${pkg_name}"
    local build_release="$pkg_temp/build/Release/$output_name"

    if run_win_cmd "Set-Location '${win_pkg_temp}'; npx node-gyp rebuild --target=${ELECTRON_VERSION} --arch=x64 --dist-url=https://electronjs.org/headers" 2>&1; then
        if [ -f "$build_release" ] && file "$build_release" | grep -q "PE32+"; then
            echo "  ✓ Built Windows binary via node-gyp"
            cp "$build_release" "$NATIVE_DIR/$output_name"
            SUCCEEDED+=("$pkg_name")
            rm -rf "$pkg_temp"
            return 0
        fi
    fi

    echo "  ✗ node-gyp rebuild failed for $pkg_name"
    FAILED+=("$pkg_name")
    rm -rf "$pkg_temp"
    return 1
}

# Resolve actual package directories (follow pnpm symlinks)
resolve_pkg() {
    local pkg_path="$PROJECT_ROOT/node_modules/$1"
    if [ -L "$pkg_path" ]; then
        readlink -f "$pkg_path"
    elif [ -d "$pkg_path" ]; then
        echo "$pkg_path"
    else
        echo ""
    fi
}

# Step 1: Download/rebuild each native module
echo ""
echo "Step 1: Building native modules for Windows..."

# Module definitions: package-name, npm-package-path, output-filename
declare -a MODULES=(
    "drivelist|drivelist|drivelist.node"
    "native-keymap|native-keymap|keymapping.node"
    "keytar|keytar|keytar.node"
    "node-pty|node-pty|pty.node"
)

for module_def in "${MODULES[@]}"; do
    IFS='|' read -r pkg_name npm_path output_name <<< "$module_def"
    pkg_dir=$(resolve_pkg "$npm_path")

    if [ -z "$pkg_dir" ]; then
        echo ""
        echo "--- $pkg_name ---"
        echo "  Package not found in node_modules"
        FAILED+=("$pkg_name (not installed)")
        continue
    fi

    # First try prebuild-install
    if download_prebuild "$pkg_name" "$pkg_dir" "$output_name"; then
        continue
    fi

    # Fall back to node-gyp on Windows (copies to C:\temp to avoid UNC path issues)
    rebuild_on_windows "$pkg_name" "$pkg_dir" "$output_name" || true
done

# Step 2: Download Windows-specific platform packages
echo ""
echo "Step 2: Installing Windows-specific packages..."

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

# Copy watcher from the Win32 package
WATCHER_SRC="$PROJECT_ROOT/node_modules/@parcel/watcher-win32-x64/watcher.node"
if [ -f "$WATCHER_SRC" ]; then
    echo "  Copying watcher.node..."
    cp "$WATCHER_SRC" "$NATIVE_DIR/watcher.node"
    SUCCEEDED+=("@parcel/watcher")
fi

# Step 3: Download Windows ripgrep
echo ""
echo "Step 3: Downloading Windows ripgrep..."
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

if [ -f "$RIPGREP_WIN" ]; then
    cp "$RIPGREP_WIN" "$NATIVE_DIR/rg"
    SUCCEEDED+=("ripgrep")
fi

# Step 4: Verify Windows binaries
echo ""
echo "Step 4: Verifying Windows binaries..."
WIN_COUNT=0
TOTAL_COUNT=0
for file in "$NATIVE_DIR"/*; do
    if [ -f "$file" ]; then
        TOTAL_COUNT=$((TOTAL_COUNT + 1))
        if file "$file" | grep -q "PE32+"; then
            echo "  ✓ $(basename "$file"): Windows PE32+"
            WIN_COUNT=$((WIN_COUNT + 1))
        else
            echo "  ✗ $(basename "$file"): NOT Windows"
        fi
    fi
done

echo ""
echo "Results: ${#SUCCEEDED[@]} succeeded, ${#FAILED[@]} failed"
if [ ${#FAILED[@]} -gt 0 ]; then
    echo "Failed modules: ${FAILED[*]}"
    echo ""
    echo "For modules that failed, you may need Windows Visual Studio Build Tools:"
    echo "  1. Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/"
    echo "  2. Install 'Desktop development with C++' workload"
    echo "  3. Re-run this script"
fi

if [ "$WIN_COUNT" -eq "$TOTAL_COUNT" ] && [ "$TOTAL_COUNT" -gt 0 ]; then
    echo "Rebuild complete! All $WIN_COUNT binaries are Windows PE32+."
else
    echo "Warning: Only $WIN_COUNT of $TOTAL_COUNT binaries are Windows PE32+."
    echo "The non-Windows binaries may cause issues when running on Windows."
fi
