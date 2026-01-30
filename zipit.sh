#!/bin/bash

# Configuration - file extensions to include
INCLUDE_EXTENSIONS=(
  "ts" "tsx" "js" "jsx" "mjs" "cjs"
  "json" "yaml" "yml" "md" "langium"
  "css" "scss" "less" "html" "svg"
  "sh" "ps1" "bat"
  "cfg" "ini"
)

# Exact filenames to always include (at any depth)
INCLUDE_FILES=(
  "package.json"
  "tsconfig.json"
  "tsconfig.base.json"
  "turbo.json"
  "pnpm-workspace.yaml"
  "pnpm-lock.yaml"
  "package-lock.json"
  ".gitignore"
  ".npmrc"
  ".nvmrc"
  "Dockerfile"
  "docker-compose.yml"
  "docker-compose.yaml"
  "webpack.config.js"
  "vite.config.js"
  "vite.config.ts"
  "esbuild.mjs"
  "langium-config.json"
)

# Directories to exclude entirely
EXCLUDE_DIRS=(
  "node_modules"
  ".git"
  ".vscode"
  ".idea"
  "dist"
  "lib"
  "build"
  "out"
  "target"
  "coverage"
  ".nyc_output"
  ".turbo"
  ".cache"
  "src-gen"
  "plugins"
)

# File patterns to exclude
EXCLUDE_PATTERNS=(
  "*.log"
  "*.tmp"
  "*.cache"
  "*.pid"
  "*.min.js"
  "*.map"
  "*.swp"
  "*.vsix"
  "*.tgz"
)

# Auto-generate zip name with timestamp
PROJECT_NAME=$(basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)")
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DEFAULT_ZIP_NAME="../${PROJECT_NAME}_src_${TIMESTAMP}.zip"
ZIP_NAME="${1:-$DEFAULT_ZIP_NAME}"

# Check if zip command exists
if ! command -v zip > /dev/null 2>&1; then
  echo "Error: 'zip' command not found. Install with: sudo apt-get install zip unzip"
  exit 1
fi

# Build find exclude arguments for directories
FIND_EXCLUDES=""
for dir in "${EXCLUDE_DIRS[@]}"; do
  FIND_EXCLUDES="$FIND_EXCLUDES -path '*/$dir' -prune -o -path '*/$dir/*' -prune -o"
done

# Create temporary file list
TEMP_LIST=$(mktemp)
trap "rm -f $TEMP_LIST" EXIT

echo -e "\n🔍 Scanning repository for source files...\n"

# Find files by extension (excluding specified directories)
for ext in "${INCLUDE_EXTENSIONS[@]}"; do
  eval "find . $FIND_EXCLUDES -type f -name '*.$ext' -print" 2>/dev/null >> "$TEMP_LIST"
done

# Find specific filenames at any depth
for filename in "${INCLUDE_FILES[@]}"; do
  eval "find . $FIND_EXCLUDES -type f -name '$filename' -print" 2>/dev/null >> "$TEMP_LIST"
done

# Remove duplicates and sort
sort -u "$TEMP_LIST" -o "$TEMP_LIST"

# Filter out excluded patterns
FILTERED_LIST=$(mktemp)
trap "rm -f $TEMP_LIST $FILTERED_LIST" EXIT

while IFS= read -r file; do
  skip=false
  for pattern in "${EXCLUDE_PATTERNS[@]}"; do
    if [[ "$file" == $pattern ]]; then
      skip=true
      break
    fi
  done
  [[ "$skip" == false ]] && echo "$file" >> "$FILTERED_LIST"
done < "$TEMP_LIST"

# Count files
FILE_COUNT=$(wc -l < "$FILTERED_LIST")

if [[ $FILE_COUNT -eq 0 ]]; then
  echo "Warning: No source files found matching the patterns."
  exit 1
fi

echo "📦 Found $FILE_COUNT source files to archive"
echo -e "\n🎯 Creating archive: $ZIP_NAME\n"

# Remove existing zip if present
rm -f "$ZIP_NAME"

# Create zip from file list
zip -q "$ZIP_NAME" -@ < "$FILTERED_LIST"

# Verify creation
if [[ -f "$ZIP_NAME" ]]; then
  FINAL_SIZE=$(du -h "$ZIP_NAME" | cut -f1)
  FINAL_COUNT=$(unzip -l "$ZIP_NAME" 2>/dev/null | tail -1 | awk '{print $2}')
  echo "✅ Success! Created archive with $FINAL_COUNT files ($FINAL_SIZE)"
  echo "📍 Location: $(realpath "$ZIP_NAME")"
  
  # Show summary of what's included
  echo -e "\n📋 Contents summary:"
  echo "   package.json files: $(unzip -l "$ZIP_NAME" 2>/dev/null | grep -c 'package\.json')"
  echo "   TypeScript files:   $(unzip -l "$ZIP_NAME" 2>/dev/null | grep -c '\.ts$')"
  echo "   JavaScript files:   $(unzip -l "$ZIP_NAME" 2>/dev/null | grep -c '\.js$')"
  echo "   Langium grammars:   $(unzip -l "$ZIP_NAME" 2>/dev/null | grep -c '\.langium$')"
else
  echo "❌ Failed to create archive"
  exit 1
fi