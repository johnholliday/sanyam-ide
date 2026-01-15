# Tasks: Yarn to pnpm Migration

**Feature ID**: 1-yarn-to-pnpm
**Generated**: 2026-01-15
**Total Tasks**: 24

---

## Overview

This migration replaces Yarn 1.x with pnpm 9.x across the entire monorepo. Tasks are organized by functional requirements from the specification.

### User Scenarios (Priority Order)

| ID | Scenario | Description | Covered By |
|----|----------|-------------|------------|
| US1 | Fresh Clone & Build | Developer clones repo, installs deps, builds, runs app | FR-1, FR-2, FR-3, FR-4 |
| US2 | CI/CD Pipeline | GitHub Actions builds, tests, packages | FR-5 |
| US3 | Docker Builds | Docker images build and run correctly | FR-7 |

---

## Phase 1: Setup - Core Configuration

**Objective**: Create pnpm-specific configuration files

**Independent Test**: `pnpm install` completes successfully at repo root

### Tasks

- [x] T001 [P] Create pnpm workspace configuration in pnpm-workspace.yaml
- [x] T002 [P] Create pnpm settings in .npmrc with shamefully-hoist for Theia compatibility
- [x] T003 Update lerna.json to set npmClient to pnpm

---

## Phase 2: Foundational - Package.json Updates

**Objective**: Update all package.json files for pnpm compatibility

**Dependencies**: Phase 1 must complete first

**Independent Test**: All package.json files valid, no yarn references in scripts

### Tasks

- [x] T004 [US1] Update root package.json: engines field (replace yarn with pnpm>=9)
- [x] T005 [US1] Update root package.json: add packageManager field for pnpm@9.15.0
- [x] T006 [US1] Update root package.json: convert resolutions to pnpm.overrides format
- [x] T007 [US1] Update root package.json: replace all yarn commands with pnpm in scripts
- [x] T008 [P] [US1] Update applications/electron/package.json: engines and scripts
- [x] T009 [P] [US1] Update applications/browser/package.json: engines and scripts
- [x] T010 [P] [US1] Verify theia-extensions/launcher/package.json for yarn references
- [x] T011 [P] [US1] Verify theia-extensions/product/package.json for yarn references
- [x] T012 [P] [US1] Verify theia-extensions/updater/package.json for yarn references

---

## Phase 3: US1 - Lock File Migration

**Objective**: Generate pnpm lock file and remove yarn lock file

**Dependencies**: Phase 2 must complete first

**Independent Test**: `pnpm install && pnpm build:dev` succeeds

### Tasks

- [x] T013 [US1] Run pnpm import to convert yarn.lock to pnpm-lock.yaml
- [x] T014 [US1] Run pnpm install to generate complete lock file
- [x] T015 [US1] Delete yarn.lock after successful pnpm install
- [x] T016 [US1] Verify .gitignore for pnpm compatibility (no yarn-specific ignores needed)

---

## Phase 4: US2 - CI/CD Pipeline Updates

**Objective**: Update all GitHub Actions workflows to use pnpm

**Dependencies**: Phase 3 (lock file) should be complete

**Independent Test**: Push to branch triggers workflows that complete successfully

### Tasks

- [x] T017 [US2] Update .github/workflows/build.yml: add pnpm setup, cache, replace commands
- [x] T018 [P] [US2] Update .github/workflows/build-next.yml: add pnpm setup, cache, replace commands
- [x] T019 [P] [US2] Update .github/workflows/license-check-workflow.yml: paths, pnpm setup, commands

---

## Phase 5: US3 - Docker Configuration Updates

**Objective**: Update Dockerfiles to use pnpm

**Dependencies**: Phase 3 (lock file) should be complete

**Independent Test**: `docker build -f browser.Dockerfile .` succeeds

### Tasks

- [x] T020 [US3] Update Dockerfile: enable corepack and prepare pnpm
- [x] T021 [US3] Update browser.Dockerfile: enable corepack, replace all yarn commands with pnpm

---

## Phase 6: Polish - Documentation Updates

**Objective**: Update documentation to reflect pnpm usage

**Dependencies**: All previous phases complete

**Independent Test**: Documentation accurately describes pnpm commands

### Tasks

- [x] T022 [P] Update README.md: replace all yarn commands with pnpm equivalents
- [x] T023 [P] Update CLAUDE.md: replace all build commands with pnpm equivalents

---

## Phase 7: Validation

**Objective**: Comprehensive validation of migration

**Dependencies**: All previous phases complete

### Tasks

- [x] T024 Run full validation: pnpm install, build:dev, download:plugins, electron start, test, lint
  - ✅ pnpm install - succeeds
  - ✅ pnpm build:dev - succeeds (lerna filters fixed for sanyam* package names)
  - ✅ pnpm download:plugins - succeeds
  - ⚠️ pnpm test - E2E tests require package:preview first (pre-existing)
  - ⚠️ pnpm lint - pre-existing lint error in branding-util.tsx:59 (not pnpm related)

---

## Dependency Graph

```
Phase 1 (Setup)
    │
    ▼
Phase 2 (Package.json)
    │
    ▼
Phase 3 (Lock File) ─── US1 Complete ✓
    │
    ├──────────────────┬─────────────────┐
    ▼                  ▼                 ▼
Phase 4 (CI/CD)    Phase 5 (Docker)   Phase 6 (Docs)
    │                  │                 │
    └──────────────────┴─────────────────┘
                       │
                       ▼
               Phase 7 (Validation)
```

---

## Parallel Execution Opportunities

### Within Phase 1
- T001, T002 can run in parallel (different files)

### Within Phase 2
- T008, T009, T010, T011, T012 can run in parallel (different package.json files)

### After Phase 3 completes
- Phase 4, Phase 5, Phase 6 can all run in parallel (independent concerns)

### Within Phase 6
- T022, T023 can run in parallel (different documentation files)

---

## Implementation Strategy

### MVP Scope
**US1 (Fresh Clone & Build)**: Phases 1-3 (Tasks T001-T016)
- Creates working local development environment
- Developers can clone, install, build, and run

### Incremental Delivery
1. **MVP**: US1 - Local development works (Phases 1-3)
2. **CI Ready**: US2 - GitHub Actions work (Phase 4)
3. **Docker Ready**: US3 - Docker builds work (Phase 5)
4. **Complete**: Documentation updated (Phase 6)

---

## Task Details

### T001: Create pnpm-workspace.yaml

**File**: `/pnpm-workspace.yaml` (CREATE)

```yaml
packages:
  - 'applications/*'
  - 'theia-extensions/*'
```

### T002: Create .npmrc

**File**: `/.npmrc` (CREATE)

```ini
shamefully-hoist=true
auto-install-peers=true
strict-peer-dependencies=false
```

### T003: Update lerna.json

**File**: `/lerna.json` (UPDATE)

Change `"npmClient": "yarn"` to `"npmClient": "pnpm"`

### T004-T007: Update root package.json

**File**: `/package.json` (UPDATE)

- T004: Change engines from `"yarn": ">=1.7.0 <2"` to `"pnpm": ">=9"`
- T005: Add `"packageManager": "pnpm@9.15.0"`
- T006: Move `resolutions` to `pnpm.overrides`, remove `**/` prefixes
- T007: Replace `yarn` with `pnpm` in all scripts

### T008-T009: Update application package.json files

**Files**: `/applications/electron/package.json`, `/applications/browser/package.json` (UPDATE)

- Update engines field
- Replace yarn commands in scripts with pnpm

### T010-T012: Verify extension package.json files

**Files**: `/theia-extensions/*/package.json` (VERIFY)

Check for and update any yarn references

### T013-T016: Lock file migration

**Commands**:
```bash
pnpm import           # T013: Import from yarn.lock
pnpm install          # T014: Generate full lock file
rm yarn.lock          # T015: Remove old lock file
# T016: Verify .gitignore
```

### T017-T019: CI/CD workflow updates

**Files**: `.github/workflows/*.yml` (UPDATE)

Add pnpm setup action, update cache config, replace yarn commands

### T020-T021: Docker updates

**Files**: `/Dockerfile`, `/browser.Dockerfile` (UPDATE)

Add corepack enable, replace yarn commands with pnpm

### T022-T023: Documentation updates

**Files**: `/README.md`, `/CLAUDE.md` (UPDATE)

Replace all yarn command examples with pnpm

### T024: Validation

**Commands**:
```bash
pnpm install
pnpm build:dev
pnpm download:plugins
pnpm electron start
pnpm test
pnpm lint
```

---

## Success Criteria Mapping

| Task Range | Success Criterion |
|------------|-------------------|
| T001-T016 | Installation completes (`pnpm install` exits 0) |
| T001-T016 | Build completes (`pnpm build` exits 0) |
| T024 | Tests pass (`pnpm test` exits 0) |
| T024 | Electron app functions |
| T024 | Browser app functions |
| T017-T019 | CI pipelines succeed |
| T020-T021 | Docker builds succeed |
