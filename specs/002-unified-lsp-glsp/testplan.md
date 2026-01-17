# Test Plan: Unified LSP/GLSP Language Server

**Feature**: 002-unified-lsp-glsp
**Date**: 2026-01-16
**Status**: Ready for Manual Verification

This document covers the remaining manual verification tasks for Phase 8.

---

## T138: VSIX Installation Test

### Objective

Verify the VSIX package installs correctly in a clean VS Code/Theia environment.

### Prerequisites

- [ ] Built VSIX package (`pnpm package:vsix` in `packages/language-server`)
- [ ] Clean VS Code installation (no Sanyam extensions)
- [ ] OR Clean Theia instance

### Test Steps

#### 1. Build the VSIX Package

```bash
cd packages/language-server
pnpm build:vsix
pnpm package:vsix
```

**Expected**:

- `language-server-0.0.1.vsix` file created in `packages/language-server/`
- No build errors

#### 2. Install in VS Code

```bash
code --install-extension packages/language-server/language-server-0.0.1.vsix
```

**Expected**:

- Extension installs without errors
- Extension appears in Extensions panel

#### 3. Verify Language Registration

1. Open VS Code
2. Create a new file with `.ecml` extension
3. Check bottom-right status bar

**Expected**:

- Language mode shows "ECML" or appropriate language
- No error notifications

#### 4. Test Basic LSP Features

1. Open a `.ecml` file with content
2. Test completion (`Ctrl+Space`)
3. Test hover (mouse over keyword)
4. Test go-to-definition (`F12`)

**Expected**:

- Completion popup appears
- Hover shows information
- Definition navigation works (or shows "No definition found")

#### 5. Verify Syntax Highlighting

1. Open a DSL file
2. Check for colored syntax

**Expected**:

- Keywords are highlighted
- Strings are highlighted
- Comments are highlighted

### Results

| Test | Pass/Fail | Notes |
|------|-----------|-------|
| Build VSIX | | |
| Install in VS Code | | |
| Language Registration | | |
| LSP Features | | |
| Syntax Highlighting | | |

---

## T149: Quickstart.md Validation Walkthrough

### Objective

Verify the quickstart guide is accurate and complete by following it step-by-step.

### Prerequisites

- [ ] Fresh clone of repository (or clean working directory)
- [ ] Node.js and pnpm installed

### Test Steps

#### Part 1: Using Existing Grammar Support (Section 1)

1. **Build the project**

   ```bash
   pnpm install
   pnpm build:dev
   pnpm electron start
   ```

   **Expected**: IDE launches without errors

2. **Open a DSL file**
   - Open any `.ecml` file from workspace

   **Expected**: File opens with syntax highlighting

3. **Test IDE features listed in quickstart**
   - [ ] Syntax highlighting visible
   - [ ] Code completion works (`Ctrl+Space`)
   - [ ] Hover information displays
   - [ ] Go to Definition (`F12`)
   - [ ] Find References (`Shift+F12`)
   - [ ] Rename Symbol (`F2`)
   - [ ] Diagnostics show in Problems panel

4. **Test diagram view**
   - Open command palette (`Ctrl+Shift+P`)
   - Run "Open Diagram View"

   **Expected**: Diagram opens (or appropriate message if not supported)

#### Part 2: Creating a New Grammar Package (Section 2)

1. **Create package structure**

   ```bash
   mkdir -p packages/grammar-definitions/testgrammar/src
   cd packages/grammar-definitions/testgrammar
   ```

2. **Create files per quickstart**
   - [ ] Create `package.json` as documented
   - [ ] Create `langium-config.json` as documented
   - [ ] Create `testgrammar.langium` as documented
   - [ ] Create `manifest.ts` as documented
   - [ ] Create `src/contribution.ts` as documented

3. **Build and test**

   ```bash
   cd ../../..  # Return to root
   pnpm install
   pnpm build:dev
   ```

   **Expected**:
   - No build errors
   - Grammar package compiles

4. **Verify grammar discovery**
   - Check that grammar appears in registry output during build

   **Expected**: "Found X grammar package(s)" includes testgrammar

5. **Clean up**

   ```bash
   rm -rf packages/grammar-definitions/testgrammar
   ```

#### Part 3: Customizing Language Features (Section 3)

1. **Review customization examples**
   - [ ] Custom validators example is syntactically correct
   - [ ] Custom LSP providers example compiles
   - [ ] Custom GLSP providers example compiles
   - [ ] Updated contribution example matches current API

### Documentation Accuracy Checklist

| Section | Accurate | Notes |
|---------|----------|-------|
| Using Existing Grammar Support | | |
| Opening DSL Files | | |
| Opening Diagram View | | |
| Diagram Interactions | | |
| Creating Package Structure | | |
| package.json Template | | |
| langium-config.json Template | | |
| Grammar File Example | | |
| Manifest Template | | |
| Contribution Template | | |
| Custom Validators | | |
| Custom LSP Providers | | |
| Custom GLSP Providers | | |
| Troubleshooting Section | | |

---

## T150: Linting Verification

### Objective

Run linting on all new packages to ensure code quality.

### Test Steps

#### 1. Run Root Linting

```bash
pnpm lint
```

**Expected**: No errors (warnings acceptable)

#### 2. Lint Specific Packages

```bash
# Types package
cd packages/types
pnpm lint

# LSP package
cd ../language-server
pnpm lint

# GLSP extension
cd ../theia-extensions/glsp
pnpm lint
```

**Expected**: Each package lints without errors

#### 3. Check New Files Specifically

```bash
# Check LSP providers
npx eslint packages/language-server/src/lsp/providers/*.ts

# Check GLSP providers
npx eslint packages/language-server/src/glsp/providers/*.ts

# Check Model API
npx eslint packages/language-server/src/model/*.ts

# Check Grammar contributions
npx eslint packages/grammar-definitions/*/src/contribution.ts
```

### Results

| Package/Path | Errors | Warnings | Notes |
|--------------|--------|----------|-------|
| packages/types | | | |
| packages/language-server | | | |
| packages/theia-extensions/glsp | | | |
| LSP providers | | | |
| GLSP providers | | | |
| Model API | | | |
| Grammar contributions | | | |

### Common Issues to Fix

- [ ] Unused imports
- [ ] Missing return types
- [ ] Inconsistent naming
- [ ] Missing semicolons (if required by config)

---

## T152: Circular Dependency Verification

### Objective

Verify there are no circular dependencies between packages.

### Test Steps

#### 1. Install Dependency Check Tool

```bash
npm install -g madge
```

#### 2. Check Core Packages

```bash
# Check types package
madge --circular packages/types/src/

# Check LSP package
madge --circular packages/language-server/src/

# Check GLSP extension
madge --circular packages/theia-extensions/glsp/src/
```

**Expected**: "No circular dependency found" for each

#### 3. Check Cross-Package Dependencies

```bash
# Full project check (may take time)
madge --circular --extensions ts packages/
```

**Expected**: No circular dependencies between packages

#### 4. Visual Dependency Graph (Optional)

```bash
# Generate dependency graph
madge --image deps.svg packages/language-server/src/main.ts
```

Review the graph for unexpected dependency patterns.

### Results

| Check | Circular Deps Found | Details |
|-------|---------------------|---------|
| packages/types | | |
| packages/language-server | | |
| packages/theia-extensions/glsp | | |
| Cross-package | | |

### Expected Dependency Structure

```
@sanyam/types (no dependencies on other @sanyam packages)
    ↑
@sanyam/language-server (depends on @sanyam/types)
    ↑
@sanyam-ide/glsp (depends on @sanyam/types, @sanyam/language-server)

packages/grammar-definitions/* (depend on @sanyam/types only)
```

### Common Circular Dependency Patterns to Avoid

- [ ] Type definitions importing implementations
- [ ] Index files creating cycles
- [ ] Utility modules importing from feature modules
- [ ] Provider implementations importing each other

---

## Sign-Off

| Task | Verified By | Date | Status |
|------|-------------|------|--------|
| T138 VSIX Installation | | | |
| T149 Quickstart Validation | | | |
| T150 Linting | | | |
| T152 Circular Dependencies | | | |

### Final Checklist

- [ ] All automated tests pass
- [ ] All manual verification tasks complete
- [ ] No blocking issues found
- [ ] Documentation is accurate
- [ ] Code quality meets standards

### Notes

_Add any issues discovered during testing here:_

---

**Test Plan Version**: 1.0
**Last Updated**: 2026-01-16
