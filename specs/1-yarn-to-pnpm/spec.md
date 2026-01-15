# Feature Specification: Convert Monorepo from Yarn to pnpm

**Feature ID**: 1-yarn-to-pnpm
**Status**: Draft
**Created**: 2026-01-15
**Last Updated**: 2026-01-15

---

## Overview

### Problem Statement

The Sanyam IDE monorepo currently uses Yarn 1.x (Classic) as its package manager with Lerna for workspace orchestration. Yarn Classic has limitations in dependency resolution, disk space efficiency, and modern workspace features compared to newer package managers. The project needs to migrate to pnpm (latest version) to benefit from improved performance, stricter dependency management, and better disk space utilization.

### Proposed Solution

Migrate the entire monorepo from Yarn 1.x to the latest version of pnpm while maintaining full functionality of the build system, CI/CD pipelines, and developer workflows. This includes converting all workspace configurations, updating scripts, and replacing the lock file.

### Target Users

- **Project maintainers**: Need reliable builds and dependency management
- **Contributors**: Need consistent local development setup
- **CI/CD systems**: Need automated builds to work without modification to core build logic

### Business Value

- Faster dependency installation (up to 2-3x improvement)
- Reduced disk space usage through content-addressable storage
- Stricter dependency isolation preventing phantom dependencies
- Better compatibility with modern Node.js ecosystem practices
- Improved monorepo workspace management

---

## User Scenarios & Testing

### Primary Scenario: Fresh Clone and Build

**Actor**: Developer
**Precondition**: pnpm is installed globally on the developer's machine
**Flow**:
1. Developer clones the repository
2. Developer runs `pnpm install` in the root directory
3. All dependencies are installed across all workspaces
4. Developer runs `pnpm build:dev` to build the project
5. Developer runs the Electron application successfully

**Acceptance Criteria**:
- All workspace dependencies are correctly linked
- Build completes without errors
- Electron application launches and functions correctly

### Secondary Scenario: CI/CD Pipeline Execution

**Actor**: GitHub Actions workflow
**Precondition**: Workflow triggers on push or pull request
**Flow**:
1. Workflow checks out the repository
2. Workflow installs pnpm using the appropriate action
3. Workflow runs `pnpm install`
4. Workflow executes build scripts
5. Workflow runs tests
6. Workflow packages the application (on release builds)

**Acceptance Criteria**:
- All existing CI workflows execute successfully
- Build artifacts are produced correctly
- Test suite passes

### Tertiary Scenario: Theia Version Update

**Actor**: Maintainer
**Precondition**: New Theia version available
**Flow**:
1. Maintainer runs the update:theia script
2. Script updates all @theia/* packages
3. Maintainer runs `pnpm install` to update lock file
4. Build completes successfully

**Acceptance Criteria**:
- Update scripts work correctly with pnpm
- Lock file regenerates properly
- No workspace linking issues

---

## Functional Requirements

### FR-1: Package Manager Configuration

The project must have a valid pnpm workspace configuration.

**Acceptance Criteria**:
- A `pnpm-workspace.yaml` file exists at the repository root
- The file defines all workspace packages: `applications/*` and `theia-extensions/*`
- A `.npmrc` file exists with appropriate pnpm settings

### FR-2: Lock File Migration

The project must use pnpm's lock file format.

**Acceptance Criteria**:
- `pnpm-lock.yaml` file exists at the repository root
- `yarn.lock` file is removed
- Lock file contains all resolved dependencies for all workspaces

### FR-3: Package.json Updates

All package.json files must be compatible with pnpm.

**Acceptance Criteria**:
- Root `package.json` has `engines` field updated to specify pnpm version instead of yarn
- All `yarn` commands in scripts are replaced with `pnpm` equivalents
- Workspace protocol references work correctly (if any)
- `resolutions` field converted to pnpm's `pnpm.overrides` format

### FR-4: Lerna Configuration Update

Lerna must be configured to work with pnpm.

**Acceptance Criteria**:
- `lerna.json` has `npmClient` set to `pnpm`
- Lerna commands continue to function for workspace orchestration
- Alternatively, migrate to pnpm's native workspace commands if Lerna is no longer needed

### FR-5: CI/CD Pipeline Updates

All GitHub Actions workflows must use pnpm.

**Acceptance Criteria**:
- Workflows install pnpm before dependency installation
- Workflow caching is configured for pnpm's store
- All workflow steps that reference yarn are updated
- Build, test, and package steps complete successfully

### FR-6: Documentation Updates

Project documentation must reflect the new package manager.

**Acceptance Criteria**:
- README.md updated with pnpm commands
- CLAUDE.md updated with pnpm build commands
- Any contributor documentation updated

### FR-7: Docker Configuration Updates

Dockerfiles must use pnpm for dependency installation.

**Acceptance Criteria**:
- `Dockerfile` and `browser.Dockerfile` updated to use pnpm
- Docker builds complete successfully
- Container images function correctly

---

## Success Criteria

| Criterion | Measurement | Target |
|-----------|-------------|--------|
| Installation completes | `pnpm install` exits with code 0 | 100% success rate |
| Build completes | `pnpm build` exits with code 0 | 100% success rate |
| Tests pass | All existing tests pass | 100% pass rate |
| Electron app functions | App launches and core features work | Full functionality |
| Browser app functions | App serves and core features work | Full functionality |
| CI pipelines succeed | GitHub Actions workflows complete | All workflows pass |
| Docker builds succeed | Docker images build without errors | 100% success rate |

---

## Non-Functional Requirements

### NFR-1: Installation Performance

Dependency installation should be faster than or comparable to the current Yarn setup.

### NFR-2: Disk Space Efficiency

pnpm's content-addressable storage should reduce duplicate package storage across workspaces.

### NFR-3: Dependency Isolation

Packages should not be able to access dependencies not explicitly declared in their package.json (no phantom dependencies).

---

## Out of Scope

- Upgrading Node.js version requirements
- Upgrading Theia or other major dependencies as part of this migration
- Changing the project structure or workspace organization
- Migrating away from Lerna entirely (can be evaluated separately)
- Adding new build targets or features

---

## Dependencies & Assumptions

### Dependencies

- pnpm must be installed globally on developer machines (minimum version 9.x)
- GitHub Actions must support pnpm installation (via pnpm/action-setup)
- Node.js 20+ (already required)

### Assumptions

- The Eclipse Theia platform and its dependencies are compatible with pnpm
- All workspace package dependencies can be resolved by pnpm
- Native module rebuilding (electron-rebuild via theia rebuild:electron) works with pnpm
- Existing developer tooling (VS Code, debugging configurations) will continue to work

---

## Key Entities

| Entity | Description |
|--------|-------------|
| Root Workspace | Main repository containing workspace configuration |
| Application Workspaces | `applications/electron` and `applications/browser` |
| Extension Workspaces | `theia-extensions/launcher`, `theia-extensions/product`, `theia-extensions/updater` |
| Lock File | `pnpm-lock.yaml` containing resolved dependency tree |
| Workspace Config | `pnpm-workspace.yaml` defining workspace packages |

---

## Open Questions

None - this is a well-defined package manager migration with clear scope and acceptance criteria.

---

## Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-01-15 | 1.0 | Claude | Initial specification |
