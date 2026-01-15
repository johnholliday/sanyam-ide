# Research: Yarn to pnpm Migration

**Feature ID**: 1-yarn-to-pnpm
**Created**: 2026-01-15

---

## Research Topics

### 1. pnpm Workspace Configuration

**Decision**: Use `pnpm-workspace.yaml` with glob patterns matching existing Yarn workspaces

**Rationale**: pnpm uses a dedicated YAML file for workspace configuration rather than the `workspaces` field in package.json. This provides clearer separation of concerns.

**Configuration**:
```yaml
packages:
  - 'applications/*'
  - 'theia-extensions/*'
```

**Alternatives Considered**:
- Keep using package.json workspaces field - Not supported by pnpm
- Migrate to Turborepo - Out of scope, adds complexity

---

### 2. Lerna Compatibility with pnpm

**Decision**: Update Lerna to use pnpm as npm client

**Rationale**: Lerna 6.x+ supports pnpm natively. The project already uses Lerna 6.0.1, which is compatible.

**Configuration Change**:
```json
{
  "npmClient": "pnpm",
  "useWorkspaces": true
}
```

**Alternatives Considered**:
- Replace Lerna with pnpm's native `--filter` commands - Would require significant script refactoring
- Use Turborepo - Out of scope for this migration

---

### 3. Yarn Resolutions to pnpm Overrides

**Decision**: Convert `resolutions` to `pnpm.overrides` in root package.json

**Rationale**: pnpm uses a different syntax for dependency overrides. The `pnpm.overrides` field in package.json serves the same purpose.

**Mapping**:
| Yarn Resolution | pnpm Override |
|-----------------|---------------|
| `"@types/puppeteer": "^5.4.0"` | `"@types/puppeteer": "^5.4.0"` |
| `"**/multer": "1.4.4-lts.1"` | `"multer": "1.4.4-lts.1"` |
| `"**/nan": "2.23.0"` | `"nan": "2.23.0"` |

**Note**: pnpm doesn't require the `**/` prefix for nested dependency overrides - it applies to all occurrences by default.

**Alternatives Considered**:
- Use `.pnpmfile.cjs` for programmatic resolution - More complex, not needed for simple overrides

---

### 4. GitHub Actions pnpm Setup

**Decision**: Use `pnpm/action-setup` action with caching

**Rationale**: Official pnpm action provides version management and integrates with GitHub's caching.

**Configuration**:
```yaml
- name: Install pnpm
  uses: pnpm/action-setup@v4
  with:
    version: 9

- name: Use Node.js ${{ matrix.node }}
  uses: actions/setup-node@v4
  with:
    node-version: ${{ matrix.node }}
    cache: 'pnpm'
```

**Alternatives Considered**:
- Use `npm install -g pnpm` - Less reliable, no caching benefits
- Use Corepack - Requires Node.js configuration, less explicit

---

### 5. Docker pnpm Installation

**Decision**: Install pnpm via corepack or npm in Dockerfile

**Rationale**: Docker images need pnpm available for build. Using corepack is the modern approach for Node.js 16.13+.

**Configuration**:
```dockerfile
# Enable corepack and prepare pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate
```

**Alternatives Considered**:
- Install via npm: `RUN npm install -g pnpm` - Works but adds extra step
- Use pnpm Docker image - Would require changing base image

---

### 6. Script Command Replacements

**Decision**: Replace all `yarn` commands with `pnpm` equivalents

**Mapping**:
| Yarn Command | pnpm Equivalent |
|--------------|-----------------|
| `yarn` | `pnpm install` |
| `yarn --skip-integrity-check` | `pnpm install` (not needed) |
| `yarn --frozen-lockfile` | `pnpm install --frozen-lockfile` |
| `yarn --pure-lockfile` | `pnpm install --frozen-lockfile` |
| `yarn <script>` | `pnpm <script>` or `pnpm run <script>` |
| `yarn -s <script>` | `pnpm <script>` (silent by default) |
| `yarn --cwd <dir>` | `pnpm --dir <dir>` or `-C <dir>` |
| `yarn autoclean` | Not available in pnpm (use `pnpm prune` or different approach) |
| `yarn cache clean` | `pnpm store prune` |
| `yarn config set network-timeout` | `pnpm config set fetch-timeout` |

**Alternatives Considered**:
- Create wrapper scripts - Adds maintenance overhead
- Use npm for some operations - Defeats purpose of migration

---

### 7. Theia Compatibility with pnpm

**Decision**: Proceed with migration; Theia officially supports pnpm

**Rationale**: Eclipse Theia documentation confirms pnpm support. The `@theia/cli` tool works with any npm-compatible package manager.

**Considerations**:
- `theia rebuild:electron` command should work with pnpm's node_modules structure
- `theia build` uses webpack, which is package-manager agnostic
- `theia download:plugins` is a custom script that should work unchanged

**Alternatives Considered**: None - pnpm is a supported option

---

### 8. .npmrc Configuration

**Decision**: Create `.npmrc` with pnpm-specific settings

**Rationale**: pnpm uses `.npmrc` for configuration. Some settings improve monorepo compatibility.

**Configuration**:
```ini
# Use hoisting for compatibility with Theia's module resolution
shamefully-hoist=true

# Ensure all peer dependencies are installed
auto-install-peers=true

# Store all packages in project for reproducibility
# (Optional - can use global store for disk savings)
# store-dir=.pnpm-store
```

**Note**: `shamefully-hoist=true` may be needed initially to maintain compatibility with code that relies on hoisted dependencies. Can be disabled later after validating stricter isolation works.

**Alternatives Considered**:
- Use `public-hoist-pattern` for selective hoisting - More complex, optimize later
- Use strict mode from start - Risk of breaking Theia compatibility

---

### 9. Engine Field Updates

**Decision**: Replace yarn engine requirement with pnpm

**Current**:
```json
"engines": {
  "yarn": ">=1.7.0 <2",
  "node": ">=20"
}
```

**New**:
```json
"engines": {
  "pnpm": ">=9",
  "node": ">=20"
}
```

**Alternatives Considered**:
- Use packageManager field - Can use both for explicit version enforcement

---

### 10. Docker Autoclean Replacement

**Decision**: Replace `yarn autoclean` with pnpm-specific cleanup

**Rationale**: pnpm doesn't have an autoclean equivalent, but its content-addressable storage and pruning achieve similar goals.

**Replacement Strategy**:
```dockerfile
# Instead of yarn autoclean
# 1. Use pnpm's built-in deduplication
RUN pnpm dedupe

# 2. Remove dev dependencies if needed
RUN pnpm prune --prod

# 3. Clean store
RUN pnpm store prune
```

**Alternatives Considered**:
- Manual file deletion with find/rm - More fragile
- Keep yarn for Docker only - Defeats purpose, adds complexity

---

## Summary

All research topics have been resolved. The migration is feasible with the following key points:

1. **Configuration Files**: Create `pnpm-workspace.yaml` and `.npmrc`
2. **Lerna**: Update `npmClient` to `pnpm`
3. **Overrides**: Convert `resolutions` to `pnpm.overrides`
4. **CI/CD**: Use `pnpm/action-setup` action
5. **Docker**: Use corepack to enable pnpm
6. **Scripts**: Replace all `yarn` commands with `pnpm` equivalents
7. **Compatibility**: Use `shamefully-hoist=true` initially for Theia compatibility
