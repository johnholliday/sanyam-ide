#!/bin/bash
# Swap native modules between Linux and Windows versions
# Usage: ./swap-native-modules.sh <linux|win32> [--skip-bundled]
#
# Options:
#   --skip-bundled  Don't update bundled modules in lib/backend/native/
#                   Use this when you want node_modules Linux but bundled Windows

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CACHE_DIR="$PROJECT_ROOT/.native-cache"
TARGET_PLATFORM="${1:-linux}"
SKIP_BUNDLED=false

# Parse options
for arg in "$@"; do
    case $arg in
        --skip-bundled)
            SKIP_BUNDLED=true
            shift
            ;;
    esac
done

if [[ "$TARGET_PLATFORM" != "linux" && "$TARGET_PLATFORM" != "win32" ]]; then
    echo "Usage: $0 <linux|win32> [--skip-bundled]"
    exit 1
fi

echo "Swapping native modules to $TARGET_PLATFORM..."

# Native modules that need swapping
NATIVE_MODULES=(
    "native-keymap:build/Release/keymapping.node"
    "drivelist:build/Release/drivelist.node"
    "keytar:build/Release/keytar.node"
    "node-pty:build/Release/pty.node"
    "@theia/ffmpeg:build/Release/ffmpeg.node"
)

# Determine current platform by checking one of the modules
CURRENT_PLATFORM="unknown"
TEST_FILE="$PROJECT_ROOT/node_modules/native-keymap/build/Release/keymapping.node"
if [ -f "$TEST_FILE" ]; then
    if file "$TEST_FILE" | grep -q "PE32+"; then
        CURRENT_PLATFORM="win32"
    elif file "$TEST_FILE" | grep -q "ELF"; then
        CURRENT_PLATFORM="linux"
    fi
fi

echo "Current platform: $CURRENT_PLATFORM"
echo "Target platform: $TARGET_PLATFORM"

NEED_SWAP=true
NEED_VERIFY=false
if [ "$CURRENT_PLATFORM" == "$TARGET_PLATFORM" ]; then
    echo "node_modules already on $TARGET_PLATFORM"
    NEED_SWAP=false
    # But still verify all modules exist
    NEED_VERIFY=true
fi

# Verify all modules exist when platform matches
if [ "$NEED_VERIFY" == "true" ]; then
    echo "Verifying all native modules are present..."
    for entry in "${NATIVE_MODULES[@]}"; do
        module="${entry%%:*}"
        file="${entry##*:}"
        dst="$PROJECT_ROOT/node_modules/$module/$file"
        src="$CACHE_DIR/$TARGET_PLATFORM/$(echo $module | tr '/' '_')_$(basename $file)"

        if [ ! -f "$dst" ]; then
            echo "  Missing: $module - restoring from cache..."
            if [ -f "$src" ]; then
                mkdir -p "$(dirname $dst)"
                cp "$src" "$dst"
                echo "  Restored: $module"
            else
                echo "  Warning: $module not in cache, will need rebuild"
            fi
        fi
    done
fi

if [ "$NEED_SWAP" == "true" ]; then
    # Save current modules to cache if they exist and are valid
    if [ "$CURRENT_PLATFORM" != "unknown" ]; then
        echo "Saving current $CURRENT_PLATFORM modules to cache..."
        mkdir -p "$CACHE_DIR/$CURRENT_PLATFORM"

        for entry in "${NATIVE_MODULES[@]}"; do
            module="${entry%%:*}"
            file="${entry##*:}"
            src="$PROJECT_ROOT/node_modules/$module/$file"
            dst="$CACHE_DIR/$CURRENT_PLATFORM/$(echo $module | tr '/' '_')_$(basename $file)"

            if [ -f "$src" ]; then
                cp "$src" "$dst"
                echo "  Cached: $module"
            fi
        done
    fi

    # Restore target platform modules from cache
    if [ -d "$CACHE_DIR/$TARGET_PLATFORM" ] && [ "$(ls -A $CACHE_DIR/$TARGET_PLATFORM 2>/dev/null)" ]; then
        echo "Restoring $TARGET_PLATFORM modules from cache..."

        for entry in "${NATIVE_MODULES[@]}"; do
            module="${entry%%:*}"
            file="${entry##*:}"
            src="$CACHE_DIR/$TARGET_PLATFORM/$(echo $module | tr '/' '_')_$(basename $file)"
            dst="$PROJECT_ROOT/node_modules/$module/$file"

            if [ -f "$src" ]; then
                # Create destination directory if it doesn't exist
                mkdir -p "$(dirname $dst)"
                cp "$src" "$dst"
                echo "  Restored: $module"
            else
                echo "  Missing from cache: $module (will need rebuild)"
            fi
        done
    else
        echo "No cache for $TARGET_PLATFORM - modules will need to be rebuilt"
        exit 1
    fi
fi

# Also update lib/backend/native if it exists (bundled modules)
# Skip this if --skip-bundled was passed
APP_NATIVE_DIR="$PROJECT_ROOT/applications/electron/lib/backend/native"
if [ "$SKIP_BUNDLED" == "true" ]; then
    echo "Skipping bundled module update (--skip-bundled)"
elif [ -d "$APP_NATIVE_DIR" ]; then
    echo "Updating bundled native modules in lib/backend/native/..."

    # Map module cache names to bundled names
    declare -A BUNDLE_MAP=(
        ["native-keymap_keymapping.node"]="keymapping.node"
        ["drivelist_drivelist.node"]="drivelist.node"
        ["keytar_keytar.node"]="keytar.node"
        ["node-pty_pty.node"]="pty.node"
    )

    for cache_name in "${!BUNDLE_MAP[@]}"; do
        src="$CACHE_DIR/$TARGET_PLATFORM/$cache_name"
        dst="$APP_NATIVE_DIR/${BUNDLE_MAP[$cache_name]}"
        if [ -f "$src" ] && [ -f "$dst" ]; then
            cp "$src" "$dst"
            echo "  Updated: ${BUNDLE_MAP[$cache_name]}"
        fi
    done

    # Handle watcher.node from platform-specific package
    if [ "$TARGET_PLATFORM" == "linux" ]; then
        WATCHER_SRC="$PROJECT_ROOT/node_modules/@parcel/watcher-linux-x64-glibc/watcher.node"
    else
        WATCHER_SRC="$PROJECT_ROOT/node_modules/@parcel/watcher-win32-x64/watcher.node"
    fi
    if [ -f "$WATCHER_SRC" ] && [ -f "$APP_NATIVE_DIR/watcher.node" ]; then
        cp "$WATCHER_SRC" "$APP_NATIVE_DIR/watcher.node"
        echo "  Updated: watcher.node"
    fi

    # Handle ripgrep
    if [ "$TARGET_PLATFORM" == "linux" ]; then
        RG_SRC="$PROJECT_ROOT/node_modules/@vscode/ripgrep/bin/rg"
    else
        RG_SRC="$PROJECT_ROOT/node_modules/@vscode/ripgrep/bin/rg.exe"
    fi
    if [ -f "$RG_SRC" ] && [ -f "$APP_NATIVE_DIR/rg" ]; then
        cp "$RG_SRC" "$APP_NATIVE_DIR/rg"
        echo "  Updated: rg"
    fi
fi

echo "Done! Native modules are now $TARGET_PLATFORM."
