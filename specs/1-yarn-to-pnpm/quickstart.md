# Quickstart: Yarn to pnpm Migration

This guide provides step-by-step instructions for implementing the Yarn to pnpm migration.

## Prerequisites

- Node.js 20+
- pnpm 9.x installed globally (`npm install -g pnpm` or via corepack)

## Quick Implementation Steps

### Step 1: Create Configuration Files

```bash
# Create pnpm-workspace.yaml
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'applications/*'
  - 'theia-extensions/*'
EOF

# Create .npmrc
cat > .npmrc << 'EOF'
shamefully-hoist=true
auto-install-peers=true
strict-peer-dependencies=false
EOF
```

### Step 2: Update lerna.json

Change `npmClient` from `"yarn"` to `"pnpm"`:

```json
{
  "lerna": "4.0.0",
  "version": "1.67.100",
  "useWorkspaces": true,
  "npmClient": "pnpm",
  "command": {
    "run": {
      "stream": true
    }
  }
}
```

### Step 3: Update Root package.json

Key changes:
1. Replace `"yarn": ">=1.7.0 <2"` with `"pnpm": ">=9"` in engines
2. Add `"packageManager": "pnpm@9.15.0"`
3. Move `resolutions` to `pnpm.overrides` (remove `**/` prefix)
4. Replace `yarn` with `pnpm` in all scripts

### Step 4: Import Lock File

```bash
# Import yarn.lock to pnpm format
pnpm import

# Install all dependencies
pnpm install

# Remove old lock file
rm yarn.lock
```

### Step 5: Validate Installation

```bash
# Build the project
pnpm build:dev

# Download VS Code plugins
pnpm download:plugins

# Start Electron app
pnpm electron start
```

## Script Command Reference

| Yarn Command | pnpm Command |
|--------------|--------------|
| `yarn` | `pnpm install` |
| `yarn build` | `pnpm build` |
| `yarn build:dev` | `pnpm build:dev` |
| `yarn download:plugins` | `pnpm download:plugins` |
| `yarn electron start` | `pnpm electron start` |
| `yarn browser start` | `pnpm browser start` |
| `yarn test` | `pnpm test` |
| `yarn lint` | `pnpm lint` |
| `yarn package:applications` | `pnpm package:applications` |

## Troubleshooting

### Issue: Module not found errors

If you see "Cannot find module" errors after migration:

1. Clear node_modules: `rm -rf node_modules applications/*/node_modules theia-extensions/*/node_modules`
2. Clear pnpm store: `pnpm store prune`
3. Reinstall: `pnpm install`

### Issue: Native module rebuild errors

For Electron native module issues:

```bash
pnpm electron rebuild
```

### Issue: Peer dependency warnings

If peer dependency warnings appear, they can usually be ignored initially. The `auto-install-peers=true` setting should handle most cases.

## CI/CD Quick Reference

GitHub Actions workflow snippet:

```yaml
- name: Install pnpm
  uses: pnpm/action-setup@v4
  with:
    version: 9

- name: Use Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '22'
    cache: 'pnpm'

- name: Install dependencies
  run: pnpm install
```

## Docker Quick Reference

Add to Dockerfile before npm commands:

```dockerfile
RUN corepack enable && corepack prepare pnpm@latest --activate
```
