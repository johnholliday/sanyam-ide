/**
 * Grammar Discovery Integration Tests (T092)
 *
 * Tests for discovering grammar packages at build time.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';

// Import the modules under test
import {
  GrammarScanner,
  createGrammarScanner,
  type GrammarPackageInfo,
  type ScanResult,
} from '../../../packages/language-server/src/discovery/grammar-scanner';

describe('Grammar Discovery Integration', () => {
  let scanner: GrammarScanner;
  let tempDir: string;

  beforeEach(() => {
    scanner = createGrammarScanner();
    tempDir = path.join(__dirname, 'temp-workspace');

    // Clean up and create temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('workspace scanning', () => {
    it('should discover grammar packages in workspace', async () => {
      // Create a mock workspace with grammar packages
      createMockWorkspace(tempDir, {
        packages: ['grammars/lang1', 'grammars/lang2'],
      });
      createMockGrammarPackage(tempDir, 'grammars/lang1', {
        name: '@sanyam/grammar-lang1',
        languageId: 'lang1',
        fileExtensions: ['.l1'],
      });
      createMockGrammarPackage(tempDir, 'grammars/lang2', {
        name: '@sanyam/grammar-lang2',
        languageId: 'lang2',
        fileExtensions: ['.l2'],
      });

      const result = await scanner.scan(tempDir);

      expect(result.packages).toHaveLength(2);
      expect(result.packages.map(p => p.languageId)).toContain('lang1');
      expect(result.packages.map(p => p.languageId)).toContain('lang2');
    });

    it('should detect packages by sanyam field in package.json', async () => {
      createMockWorkspace(tempDir, {
        packages: ['packages/my-grammar'],
      });
      createMockGrammarPackage(tempDir, 'packages/my-grammar', {
        name: 'my-custom-grammar',
        languageId: 'custom',
        fileExtensions: ['.cst'],
        useSanyamField: true,
      });

      const result = await scanner.scan(tempDir);

      expect(result.packages).toHaveLength(1);
      expect(result.packages[0].languageId).toBe('custom');
    });

    it('should detect packages by @sanyam/grammar-* naming convention', async () => {
      createMockWorkspace(tempDir, {
        packages: ['grammars/test'],
      });
      createMockGrammarPackage(tempDir, 'grammars/test', {
        name: '@sanyam/grammar-testlang',
        languageId: 'testlang',
        fileExtensions: ['.tst'],
      });

      const result = await scanner.scan(tempDir);

      expect(result.packages).toHaveLength(1);
      expect(result.packages[0].name).toBe('@sanyam/grammar-testlang');
    });

    it('should skip packages without grammar markers', async () => {
      createMockWorkspace(tempDir, {
        packages: ['packages/regular-package', 'grammars/lang1'],
      });

      // Regular package without grammar markers
      const regularPath = path.join(tempDir, 'packages/regular-package');
      fs.mkdirSync(regularPath, { recursive: true });
      fs.writeFileSync(
        path.join(regularPath, 'package.json'),
        JSON.stringify({ name: 'regular-package', version: '1.0.0' })
      );

      // Grammar package
      createMockGrammarPackage(tempDir, 'grammars/lang1', {
        name: '@sanyam/grammar-lang1',
        languageId: 'lang1',
        fileExtensions: ['.l1'],
      });

      const result = await scanner.scan(tempDir);

      expect(result.packages).toHaveLength(1);
      expect(result.packages[0].languageId).toBe('lang1');
    });

    it('should handle empty workspace', async () => {
      createMockWorkspace(tempDir, { packages: [] });

      const result = await scanner.scan(tempDir);

      expect(result.packages).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should report errors for invalid packages', async () => {
      createMockWorkspace(tempDir, {
        packages: ['grammars/invalid'],
      });

      // Create invalid package (missing required fields)
      const invalidPath = path.join(tempDir, 'grammars/invalid');
      fs.mkdirSync(invalidPath, { recursive: true });
      fs.writeFileSync(
        path.join(invalidPath, 'package.json'),
        JSON.stringify({
          name: '@sanyam/grammar-invalid',
          sanyam: { grammar: true }, // Missing languageId
        })
      );

      const result = await scanner.scan(tempDir);

      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('package info extraction', () => {
    it('should extract all package information', async () => {
      createMockWorkspace(tempDir, {
        packages: ['grammars/complete'],
      });
      createMockGrammarPackage(tempDir, 'grammars/complete', {
        name: '@sanyam/grammar-complete',
        languageId: 'complete',
        fileExtensions: ['.cmp', '.complete'],
        version: '2.0.0',
        description: 'A complete grammar package',
      });

      const result = await scanner.scan(tempDir);
      const pkg = result.packages[0];

      expect(pkg.name).toBe('@sanyam/grammar-complete');
      expect(pkg.languageId).toBe('complete');
      expect(pkg.fileExtensions).toEqual(['.cmp', '.complete']);
      expect(pkg.version).toBe('2.0.0');
      expect(pkg.description).toBe('A complete grammar package');
    });

    it('should extract manifest path if present', async () => {
      createMockWorkspace(tempDir, {
        packages: ['grammars/with-manifest'],
      });
      createMockGrammarPackage(tempDir, 'grammars/with-manifest', {
        name: '@sanyam/grammar-with-manifest',
        languageId: 'manifest',
        fileExtensions: ['.mnf'],
        hasManifest: true,
      });

      const result = await scanner.scan(tempDir);
      const pkg = result.packages[0];

      expect(pkg.manifestPath).toBeDefined();
      expect(pkg.manifestPath).toContain('manifest.ts');
    });

    it('should extract contribution path if present', async () => {
      createMockWorkspace(tempDir, {
        packages: ['grammars/with-contribution'],
      });
      createMockGrammarPackage(tempDir, 'grammars/with-contribution', {
        name: '@sanyam/grammar-with-contribution',
        languageId: 'contrib',
        fileExtensions: ['.cnt'],
        hasContribution: true,
      });

      const result = await scanner.scan(tempDir);
      const pkg = result.packages[0];

      expect(pkg.contributionPath).toBeDefined();
      expect(pkg.contributionPath).toContain('contribution.ts');
    });
  });

  describe('langium-config.json parsing', () => {
    it('should parse langium-config.json for language info', async () => {
      createMockWorkspace(tempDir, {
        packages: ['grammars/langium'],
      });

      const grammarPath = path.join(tempDir, 'grammars/langium');
      fs.mkdirSync(grammarPath, { recursive: true });

      // Create package.json
      fs.writeFileSync(
        path.join(grammarPath, 'package.json'),
        JSON.stringify({
          name: '@sanyam/grammar-langium',
          version: '1.0.0',
          sanyam: { grammar: true },
        })
      );

      // Create langium-config.json
      fs.writeFileSync(
        path.join(grammarPath, 'langium-config.json'),
        JSON.stringify({
          projectName: 'LangiumTest',
          languages: [
            {
              id: 'langium-test',
              grammar: 'src/language.langium',
              fileExtensions: ['.lgt'],
            },
          ],
        })
      );

      const result = await scanner.scan(tempDir);
      const pkg = result.packages[0];

      expect(pkg.languageId).toBe('langium-test');
      expect(pkg.fileExtensions).toEqual(['.lgt']);
    });

    it('should prefer sanyam field over langium-config.json', async () => {
      createMockWorkspace(tempDir, {
        packages: ['grammars/override'],
      });

      const grammarPath = path.join(tempDir, 'grammars/override');
      fs.mkdirSync(grammarPath, { recursive: true });

      // Create package.json with sanyam field
      fs.writeFileSync(
        path.join(grammarPath, 'package.json'),
        JSON.stringify({
          name: '@sanyam/grammar-override',
          version: '1.0.0',
          sanyam: {
            grammar: true,
            languageId: 'override-id',
            fileExtensions: ['.ovr'],
          },
        })
      );

      // Create langium-config.json with different values
      fs.writeFileSync(
        path.join(grammarPath, 'langium-config.json'),
        JSON.stringify({
          projectName: 'Override',
          languages: [
            {
              id: 'langium-id',
              grammar: 'src/language.langium',
              fileExtensions: ['.lng'],
            },
          ],
        })
      );

      const result = await scanner.scan(tempDir);
      const pkg = result.packages[0];

      // Should use sanyam field values
      expect(pkg.languageId).toBe('override-id');
      expect(pkg.fileExtensions).toEqual(['.ovr']);
    });
  });

  describe('dependency resolution', () => {
    it('should detect grammar dependencies', async () => {
      createMockWorkspace(tempDir, {
        packages: ['grammars/base', 'grammars/extended'],
      });

      createMockGrammarPackage(tempDir, 'grammars/base', {
        name: '@sanyam/grammar-base',
        languageId: 'base',
        fileExtensions: ['.base'],
      });

      const extendedPath = path.join(tempDir, 'grammars/extended');
      fs.mkdirSync(extendedPath, { recursive: true });
      fs.writeFileSync(
        path.join(extendedPath, 'package.json'),
        JSON.stringify({
          name: '@sanyam/grammar-extended',
          version: '1.0.0',
          sanyam: {
            grammar: true,
            languageId: 'extended',
            fileExtensions: ['.ext'],
          },
          dependencies: {
            '@sanyam/grammar-base': '^1.0.0',
          },
        })
      );

      const result = await scanner.scan(tempDir);
      const extendedPkg = result.packages.find(p => p.languageId === 'extended');

      expect(extendedPkg?.dependencies).toContain('@sanyam/grammar-base');
    });
  });

  describe('sorting and ordering', () => {
    it('should sort packages by dependencies', async () => {
      createMockWorkspace(tempDir, {
        packages: ['grammars/derived', 'grammars/base'],
      });

      // Base package (no dependencies)
      createMockGrammarPackage(tempDir, 'grammars/base', {
        name: '@sanyam/grammar-base',
        languageId: 'base',
        fileExtensions: ['.base'],
      });

      // Derived package (depends on base)
      const derivedPath = path.join(tempDir, 'grammars/derived');
      fs.mkdirSync(derivedPath, { recursive: true });
      fs.writeFileSync(
        path.join(derivedPath, 'package.json'),
        JSON.stringify({
          name: '@sanyam/grammar-derived',
          version: '1.0.0',
          sanyam: {
            grammar: true,
            languageId: 'derived',
            fileExtensions: ['.drv'],
          },
          dependencies: {
            '@sanyam/grammar-base': '^1.0.0',
          },
        })
      );

      const result = await scanner.scan(tempDir);
      const sortedPackages = scanner.sortByDependencies(result.packages);

      // Base should come before derived
      const baseIndex = sortedPackages.findIndex(p => p.languageId === 'base');
      const derivedIndex = sortedPackages.findIndex(p => p.languageId === 'derived');

      expect(baseIndex).toBeLessThan(derivedIndex);
    });
  });
});

// Helper functions

function createMockWorkspace(
  basePath: string,
  config: { packages: string[] }
): void {
  // Create pnpm-workspace.yaml
  const workspaceYaml = `packages:\n${config.packages.map(p => `  - '${p}'`).join('\n')}`;
  fs.writeFileSync(path.join(basePath, 'pnpm-workspace.yaml'), workspaceYaml);
}

function createMockGrammarPackage(
  basePath: string,
  packagePath: string,
  config: {
    name: string;
    languageId: string;
    fileExtensions: string[];
    version?: string;
    description?: string;
    useSanyamField?: boolean;
    hasManifest?: boolean;
    hasContribution?: boolean;
  }
): void {
  const fullPath = path.join(basePath, packagePath);
  fs.mkdirSync(fullPath, { recursive: true });

  // Create package.json
  const packageJson: any = {
    name: config.name,
    version: config.version ?? '1.0.0',
    description: config.description,
  };

  if (config.useSanyamField || !config.name.startsWith('@sanyam/grammar-')) {
    packageJson.sanyam = {
      grammar: true,
      languageId: config.languageId,
      fileExtensions: config.fileExtensions,
    };
  } else {
    // Use langium-config.json instead
    fs.writeFileSync(
      path.join(fullPath, 'langium-config.json'),
      JSON.stringify({
        projectName: config.languageId,
        languages: [
          {
            id: config.languageId,
            grammar: `src/${config.languageId}.langium`,
            fileExtensions: config.fileExtensions,
          },
        ],
      })
    );
    // Still need sanyam marker
    packageJson.sanyam = { grammar: true };
  }

  fs.writeFileSync(
    path.join(fullPath, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  // Create src directory
  const srcPath = path.join(fullPath, 'src');
  fs.mkdirSync(srcPath, { recursive: true });

  // Create manifest if requested
  if (config.hasManifest) {
    fs.writeFileSync(
      path.join(srcPath, 'manifest.ts'),
      `export const manifest = { name: '${config.name}' };`
    );
  }

  // Create contribution if requested
  if (config.hasContribution) {
    fs.writeFileSync(
      path.join(srcPath, 'contribution.ts'),
      `export const contribution = { languageId: '${config.languageId}' };`
    );
  }
}
