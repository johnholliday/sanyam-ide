#!/bin/bash

# Configuration - add/remove patterns as needed
INCLUDE_PATTERNS=(
  "*.ts" "*.tsx" "*.js" "*.jsx" "*.mjs" "*.cjs"
  "*.json" "*.yaml" "*.yml" "*.md" "*.langium"
  "*.css" "*.scss" "*.less" "*.html"
  "*.sh" "*.ps1" "*.bat"
  "*.cfg" "*.ini" "*.env*"
  "Dockerfile*" "docker-compose*.yml"
  ".gitignore" ".npmrc" "pnpm-lock.yaml" "package-lock.json"
  "tsconfig*.json" "webpack*.config.*" "vite.config.*"
  "jest.config.*" "vitest.config.*"
)

EXCLUDE_PATTERNS=(
  "*.log" "*.tmp" "*.cache" "*.pid"
  "dist/" "lib/" "build/" "out/" "target/"
  "*.min.js" "*.map"
  ".git/" ".vscode/" ".idea/" "*.swp"
  "coverage/" ".nyc_output/"
)

# Auto-generate zip name with timestamp
PROJECT_NAME=$(basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)")
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DEFAULT_ZIP_NAME="../${PROJECT_NAME}_src_${TIMESTAMP}.zip"
ZIP_NAME="${1:-$DEFAULT_ZIP_NAME}"

# Validate we're in a git repo (for git ls-files)
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "Error: Not in a git repository. Git is required to respect .gitignore."
  echo "Alternatively, modify script to use 'find' instead of 'git ls-files'."
  exit 1
fi

# Check if zip command exists
if ! command -v zip > /dev/null 2>&1; then
  echo "Error: 'zip' command not found. Install with: sudo apt-get install zip unzip"
  exit 1
fi

# Create temporary file list
TEMP_LIST=$(mktemp)
trap "rm -f $TEMP_LIST" EXIT

echo -e "\n🔍 Scanning repository for source files...\n"

# Build include pattern for git ls-files
INCLUDE_GLOB=$(IFS=' '; echo "${INCLUDE_PATTERNS[*]}")

# Get all tracked + untracked (but not ignored) files matching patterns
git ls-files -c -o --exclude-standard -- ${INCLUDE_PATTERNS[@]} > "$TEMP_LIST" 2>/dev/null

# Manually add hidden root files if they exist
for file in .gitignore .npmrc .nvmrc; do
  [[ -f "$file" ]] && echo "$file" >> "$TEMP_LIST"
done

# Count files
FILE_COUNT=$(wc -l < "$TEMP_LIST")

if [[ $FILE_COUNT -eq 0 ]]; then
  echo "Warning: No source files found matching the patterns."
  echo "Review INCLUDE_PATTERNS in the script."
  exit 1
fi

echo "📦 Found $FILE_COUNT source files to archive"
echo -e "\n🎯 Creating archive: $ZIP_NAME\n"

# Create zip with exclusions
while IFS= read -r file; do
  # Skip if matches exclude patterns
  skip=false
  for exclude in "${EXCLUDE_PATTERNS[@]}"; do
    if [[ "$file" == $exclude ]]; then
      skip=true
      break
    fi
  done
  [[ "$skip" == true ]] && continue
  
  # Add file to zip (quiet mode)
  zip -q "$ZIP_NAME" "$file"
done < "$TEMP_LIST"

# Verify creation
if [[ -f "$ZIP_NAME" ]]; then
  FINAL_SIZE=$(du -h "$ZIP_NAME" | cut -f1)
  FINAL_COUNT=$(zipinfo -1 "$ZIP_NAME" | wc -l)
  echo "✅ Success! Created archive with $FINAL_COUNT files ($FINAL_SIZE)"
  echo "📍 Location: $(realpath "$ZIP_NAME")"
else
  echo "❌ Failed to create archive"
  exit 1
fi