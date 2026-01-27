#!/bin/bash
# Check if webpack bundles are stale compared to source files
# Exits with warning message if stale, but doesn't block startup

RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_freshness() {
    local src_dir="$1"
    local bundle_dir="$2"
    local name="$3"

    # Skip if bundle doesn't exist yet (first build)
    if [ ! -d "$bundle_dir" ]; then
        return 0
    fi

    # Find newest source file (excluding generated directories since they're regenerated each build)
    local newest_src=$(find "$src_dir" -path "*/generated" -prune -o \( -name "*.ts" -o -name "*.tsx" -o -name "*.css" \) -print 2>/dev/null | xargs stat -c %Y 2>/dev/null | sort -rn | head -1)

    # Find newest bundle file
    local newest_bundle=$(find "$bundle_dir" -name "*.js" 2>/dev/null | xargs stat -c %Y 2>/dev/null | sort -rn | head -1)

    if [ -n "$newest_src" ] && [ -n "$newest_bundle" ]; then
        if [ "$newest_src" -gt "$newest_bundle" ]; then
            echo -e "${YELLOW}⚠️  WARNING: $name bundles may be stale!${NC}"
            echo -e "   Source files are newer than compiled bundles."
            echo -e "   Run ${RED}pnpm build${NC} to rebuild."
            return 1
        fi
    fi
    return 0
}

stale=0

# Check GLSP extension
check_freshness "packages/theia-extensions/glsp/src" "applications/browser/lib" "GLSP" || stale=1

# Check language server
check_freshness "packages/language-server/src" "packages/language-server/lib" "Language Server" || stale=1

# Check other theia extensions
for ext in product updater launcher; do
    check_freshness "packages/theia-extensions/$ext/src" "packages/theia-extensions/$ext/lib" "$ext" || stale=1
done

if [ $stale -eq 1 ]; then
    echo ""
    echo -e "${YELLOW}Tip: Run 'pnpm build' or clean with:${NC}"
    echo "  rm -rf applications/browser/lib/ .turbo/ && pnpm build"
    echo ""
fi

exit 0  # Don't block startup, just warn
