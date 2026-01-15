# Implementation Plan: Yarn to pnpm Migration

**Feature ID**: 1-yarn-to-pnpm
**Status**: Ready for Implementation
**Created**: 2026-01-15

---

## Technical Context

| Aspect | Current State | Target State |
|--------|---------------|--------------|
| Package Manager | Yarn 1.x (Classic) | pnpm 9.x (latest) |
| Lock File | `yarn.lock` (721KB) | `pnpm-lock.yaml` |
| Workspace Config | `package.json` workspaces field | `pnpm-workspace.yaml` |
| Workspace Orchestration | Lerna with Yarn | Lerna with pnpm |
| Dependency Overrides | `resolutions` field | `pnpm.overrides` field |
| CI/CD | Yarn commands | pnpm with action-setup |

### Repository Structure

```
sanyam-ide/
├── package.json              # Root workspace config (UPDATE)
├── yarn.lock                 # Lock file (DELETE)
├── lerna.json                # Lerna config (UPDATE)
├── pnpm-workspace.yaml       # Workspace config (CREATE)
├── .npmrc                    # pnpm config (CREATE)
├── Dockerfile                # Builder image (UPDATE)
├── browser.Dockerfile        # Browser app image (UPDATE)
├── applications/
│   ├── electron/package.json # App package (UPDATE)
│   └── browser/package.json  # App package (UPDATE)
├── theia-extensions/
│   ├── launcher/package.json # Extension package (UPDATE)
│   ├── product/package.json  # Extension package (UPDATE)
│   └── updater/package.json  # Extension package (UPDATE)
└── .github/workflows/
    ├── build.yml             # Main CI (UPDATE)
    ├── build-next.yml        # Next build CI (UPDATE)
    └── license-check-workflow.yml # License check (UPDATE)
```

---

## Implementation Phases

### Phase 1: Core Configuration Files

**Objective**: Create pnpm-specific configuration and update package manager settings.

#### Task 1.1: Create pnpm-workspace.yaml

**File**: `/pnpm-workspace.yaml` (CREATE)

```yaml
packages:
  - 'applications/*'
  - 'theia-extensions/*'
```

#### Task 1.2: Create .npmrc

**File**: `/.npmrc` (CREATE)

```ini
# Hoist dependencies for Theia compatibility
shamefully-hoist=true

# Auto-install peer dependencies
auto-install-peers=true

# Use strict peer dependencies
strict-peer-dependencies=false
```

#### Task 1.3: Update lerna.json

**File**: `/lerna.json` (UPDATE)

Change `npmClient` from `"yarn"` to `"pnpm"`.

#### Task 1.4: Update Root package.json

**File**: `/package.json` (UPDATE)

1. Update `engines` field:
   - Remove: `"yarn": ">=1.7.0 <2"`
   - Add: `"pnpm": ">=9"`

2. Convert `resolutions` to `pnpm.overrides`:
   - Move all entries from `resolutions` to `pnpm.overrides`
   - Remove `**/` prefix from patterns

3. Update all scripts replacing `yarn` with `pnpm`:
   - `yarn build:extensions` → `pnpm build:extensions`
   - `yarn build:applications` → `pnpm build:applications`
   - `yarn --cwd` → `pnpm --dir` or `pnpm -C`

4. Add `packageManager` field for explicit version:
   ```json
   "packageManager": "pnpm@9.15.0"
   ```

---

### Phase 2: Application Package Updates

**Objective**: Update all workspace package.json files for pnpm compatibility.

#### Task 2.1: Update applications/electron/package.json

1. Update `engines` field (remove yarn, add pnpm)
2. Replace all `yarn` commands in scripts with `pnpm`
3. Replace `yarn -s` with `pnpm` (silent by default)

#### Task 2.2: Update applications/browser/package.json

1. Update `engines` field (remove yarn, add pnpm)
2. Replace all `yarn` commands in scripts with `pnpm`

#### Task 2.3: Update theia-extensions/*/package.json

All three extension packages use standard scripts, likely no changes needed. Verify and update if any yarn references exist.

---

### Phase 3: CI/CD Pipeline Updates

**Objective**: Update all GitHub Actions workflows to use pnpm.

#### Task 3.1: Update .github/workflows/build.yml

1. Add pnpm setup step after checkout:
   ```yaml
   - name: Install pnpm
     uses: pnpm/action-setup@v4
     with:
       version: 9
   ```

2. Update setup-node to use pnpm cache:
   ```yaml
   - name: Use Node.js ${{ matrix.node }}
     uses: actions/setup-node@v4
     with:
       node-version: ${{ matrix.node }}
       cache: 'pnpm'
   ```

3. Replace all yarn commands:
   - `yarn --skip-integrity-check --network-timeout 100000` → `pnpm install`
   - `yarn build:dev` → `pnpm build:dev`
   - `yarn build` → `pnpm build`
   - `yarn download:plugins` → `pnpm download:plugins`
   - `yarn package:applications` → `pnpm package:applications`
   - `yarn electron test` → `pnpm electron test`
   - `yarn lint` → `pnpm lint`

#### Task 3.2: Update .github/workflows/build-next.yml

1. Add pnpm setup step
2. Update setup-node for pnpm cache
3. Replace yarn commands:
   - `yarn version` commands (version management)
   - `yarn lerna version` → `pnpm lerna version`
   - `yarn update:theia` → `pnpm update:theia`
   - All build/package commands

#### Task 3.3: Update .github/workflows/license-check-workflow.yml

1. Update trigger paths: `yarn.lock` → `pnpm-lock.yaml`
2. Add pnpm setup step
3. Replace `yarn --frozen-lockfile --ignore-scripts` → `pnpm install --frozen-lockfile --ignore-scripts`
4. Update license check commands

---

### Phase 4: Docker Configuration Updates

**Objective**: Update Dockerfiles to use pnpm for builds.

#### Task 4.1: Update Dockerfile (Builder Image)

1. Enable corepack and install pnpm:
   ```dockerfile
   RUN corepack enable && corepack prepare pnpm@latest --activate
   ```

#### Task 4.2: Update browser.Dockerfile

1. Enable corepack in build stage:
   ```dockerfile
   RUN corepack enable && corepack prepare pnpm@latest --activate
   ```

2. Replace yarn commands in build:
   - `yarn config set network-timeout 600000 -g` → `pnpm config set fetch-timeout 600000`
   - `yarn --pure-lockfile` → `pnpm install --frozen-lockfile`
   - `yarn build:extensions` → `pnpm build:extensions`
   - `yarn download:plugins` → `pnpm download:plugins`
   - `yarn browser build` → `pnpm browser build`
   - Remove `yarn autoclean` section (replace with pnpm prune)
   - `yarn cache clean` → `pnpm store prune`

---

### Phase 5: Lock File Migration

**Objective**: Generate new pnpm lock file and remove yarn lock file.

#### Task 5.1: Generate pnpm-lock.yaml

Run `pnpm import` to import from yarn.lock, then `pnpm install` to generate full lock file.

#### Task 5.2: Remove yarn.lock

Delete the yarn.lock file after successful pnpm install.

#### Task 5.3: Update .gitignore (if needed)

Ensure `.gitignore` doesn't reference yarn-specific files that should now be removed, and add any pnpm-specific ignores if needed.

---

### Phase 6: Documentation Updates

**Objective**: Update all documentation to reflect pnpm usage.

#### Task 6.1: Update README.md

Replace all yarn commands with pnpm equivalents in examples and instructions.

#### Task 6.2: Update CLAUDE.md

Update all build commands and development instructions to use pnpm.

---

### Phase 7: Validation

**Objective**: Verify the migration is successful.

#### Task 7.1: Local Build Validation

1. Run `pnpm install`
2. Run `pnpm build:dev`
3. Run `pnpm download:plugins`
4. Run `pnpm electron start`
5. Run `pnpm browser start`

#### Task 7.2: Test Suite Validation

1. Run `pnpm test`
2. Run `pnpm lint`

#### Task 7.3: Package Validation

1. Run `pnpm electron package:preview`
2. Verify the packaged application works

---

## File Change Summary

| File | Action | Description |
|------|--------|-------------|
| `pnpm-workspace.yaml` | CREATE | Define workspace packages |
| `.npmrc` | CREATE | pnpm configuration |
| `package.json` | UPDATE | Scripts, engines, overrides |
| `lerna.json` | UPDATE | Change npmClient to pnpm |
| `applications/electron/package.json` | UPDATE | Scripts, engines |
| `applications/browser/package.json` | UPDATE | Scripts, engines |
| `.github/workflows/build.yml` | UPDATE | pnpm setup and commands |
| `.github/workflows/build-next.yml` | UPDATE | pnpm setup and commands |
| `.github/workflows/license-check-workflow.yml` | UPDATE | pnpm setup, paths, commands |
| `Dockerfile` | UPDATE | Install pnpm |
| `browser.Dockerfile` | UPDATE | Install pnpm, update commands |
| `README.md` | UPDATE | pnpm commands |
| `CLAUDE.md` | UPDATE | pnpm commands |
| `yarn.lock` | DELETE | Remove after migration |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Theia compatibility issues | Use `shamefully-hoist=true` in .npmrc |
| Native module rebuild failures | Test `theia rebuild:electron` early |
| CI caching issues | Verify pnpm store caching works |
| Docker build failures | Test Docker builds before merging |

---

## Rollback Plan

If critical issues are discovered:

1. Revert to previous commit with yarn configuration
2. Run `yarn install` to restore node_modules
3. Investigate issues on a separate branch

---

## Success Criteria Verification

| Criterion | Verification Command |
|-----------|---------------------|
| Installation completes | `pnpm install` exits 0 |
| Build completes | `pnpm build` exits 0 |
| Tests pass | `pnpm test` exits 0 |
| Electron app works | `pnpm electron start` launches |
| Browser app works | `pnpm browser start` serves |
| CI pipelines pass | GitHub Actions green |
| Docker builds | `docker build -f browser.Dockerfile .` |
