/**
 * Unit tests for GrammarScanner
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  scanForGrammarPackages,
  generateRegistryCode,
  type ScannedGrammarPackage,
} from '../../../packages/sanyam-lsp/src/discovery/grammar-scanner.js';

describe('GrammarScanner', () => {
  let tempDir: string;

  beforeEach(() => {
    // Create temporary directory for test fixtures
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grammar-scanner-test-'));
  });

  afterEach(() => {
    // Clean up temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper to create a test package
   */
  function createTestPackage(
    relativePath: string,
    packageJson: Record<string, unknown>
  ): void {
    const pkgDir = path.join(tempDir, relativePath);
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(
      path.join(pkgDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
  }

  /**
   * Helper to create workspace config
   */
  function createWorkspaceConfig(packages: string[]): void {
    const config = `packages:\n${packages.map((p) => `  - '${p}'`).join('\n')}\n`;
    fs.writeFileSync(path.join(tempDir, 'pnpm-workspace.yaml'), config);
  }

  describe('scanForGrammarPackages', () => {
    it('should find packages with sanyam.grammar: true', async () => {
      createWorkspaceConfig(['grammars/*']);
      createTestPackage('grammars/mygrammar', {
        name: 'mygrammar',
        version: '1.0.0',
        sanyam: {
          grammar: true,
          languageId: 'mygrammar',
          contribution: './lib/contribution.js',
        },
      });

      const result = await scanForGrammarPackages({ workspaceRoot: tempDir });

      expect(result.packages).to.have.length(1);
      expect(result.packages[0]?.languageId).to.equal('mygrammar');
      expect(result.packages[0]?.contributionPath).to.equal('./lib/contribution.js');
      expect(result.warnings).to.have.length(0);
    });

    it('should find packages matching @sanyam/grammar-* naming', async () => {
      createWorkspaceConfig(['packages/*']);
      createTestPackage('packages/ecml', {
        name: '@sanyam/grammar-ecml',
        version: '1.0.0',
      });

      const result = await scanForGrammarPackages({ workspaceRoot: tempDir });

      expect(result.packages).to.have.length(1);
      expect(result.packages[0]?.languageId).to.equal('ecml');
      expect(result.packages[0]?.packageName).to.equal('@sanyam/grammar-ecml');
    });

    it('should extract language ID from package name with hyphens', async () => {
      createWorkspaceConfig(['packages/*']);
      createTestPackage('packages/iso-42001', {
        name: '@sanyam/grammar-iso-42001',
        version: '1.0.0',
      });

      const result = await scanForGrammarPackages({ workspaceRoot: tempDir });

      expect(result.packages).to.have.length(1);
      expect(result.packages[0]?.languageId).to.equal('iso-42001');
    });

    it('should prefer explicit languageId over naming convention', async () => {
      createWorkspaceConfig(['grammars/*']);
      createTestPackage('grammars/test', {
        name: '@sanyam/grammar-test',
        version: '1.0.0',
        sanyam: {
          grammar: true,
          languageId: 'custom-id',
        },
      });

      const result = await scanForGrammarPackages({ workspaceRoot: tempDir });

      expect(result.packages).to.have.length(1);
      expect(result.packages[0]?.languageId).to.equal('custom-id');
    });

    it('should ignore non-grammar packages', async () => {
      createWorkspaceConfig(['packages/*']);
      createTestPackage('packages/utils', {
        name: '@sanyam/utils',
        version: '1.0.0',
      });
      createTestPackage('packages/grammar-ecml', {
        name: '@sanyam/grammar-ecml',
        version: '1.0.0',
      });

      const result = await scanForGrammarPackages({ workspaceRoot: tempDir });

      expect(result.packages).to.have.length(1);
      expect(result.packages[0]?.packageName).to.equal('@sanyam/grammar-ecml');
    });

    it('should use default contribution path when not specified', async () => {
      createWorkspaceConfig(['grammars/*']);
      createTestPackage('grammars/mygrammar', {
        name: '@sanyam/grammar-mygrammar',
        version: '1.0.0',
      });

      const result = await scanForGrammarPackages({ workspaceRoot: tempDir });

      expect(result.packages).to.have.length(1);
      expect(result.packages[0]?.contributionPath).to.equal('./lib/contribution.js');
    });

    it('should handle multiple workspace globs', async () => {
      createWorkspaceConfig(['packages/*', 'grammars/*']);
      createTestPackage('packages/grammar-ecml', {
        name: '@sanyam/grammar-ecml',
        version: '1.0.0',
      });
      createTestPackage('grammars/spdevkit', {
        name: '@sanyam/grammar-spdevkit',
        version: '1.0.0',
      });

      const result = await scanForGrammarPackages({ workspaceRoot: tempDir });

      expect(result.packages).to.have.length(2);
      const ids = result.packages.map((p) => p.languageId);
      expect(ids).to.include('ecml');
      expect(ids).to.include('spdevkit');
    });

    it('should return warning when workspace config not found', async () => {
      const result = await scanForGrammarPackages({ workspaceRoot: tempDir });

      expect(result.packages).to.have.length(0);
      expect(result.warnings).to.have.length(1);
      expect(result.warnings[0]).to.include('not found');
    });

    it('should handle empty packages array in workspace config', async () => {
      fs.writeFileSync(path.join(tempDir, 'pnpm-workspace.yaml'), 'packages: []\n');

      const result = await scanForGrammarPackages({ workspaceRoot: tempDir });

      expect(result.packages).to.have.length(0);
      expect(result.warnings).to.have.length(0);
    });

    it('should handle malformed package.json gracefully', async () => {
      createWorkspaceConfig(['packages/*']);
      const pkgDir = path.join(tempDir, 'packages/broken');
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(path.join(pkgDir, 'package.json'), 'not valid json');

      const result = await scanForGrammarPackages({ workspaceRoot: tempDir });

      expect(result.packages).to.have.length(0);
      expect(result.warnings).to.have.length(1);
      expect(result.warnings[0]).to.include('Error reading');
    });
  });

  describe('generateRegistryCode', () => {
    it('should generate valid TypeScript code', () => {
      const packages: ScannedGrammarPackage[] = [
        {
          packageName: '@sanyam/grammar-ecml',
          languageId: 'ecml',
          contributionPath: './lib/contribution.js',
          packagePath: '/path/to/ecml',
          version: '1.0.0',
        },
      ];

      const code = generateRegistryCode(packages);

      expect(code).to.include("import { contribution as contribution0 } from '@sanyam/grammar-ecml/contribution'");
      expect(code).to.include('GRAMMAR_REGISTRY');
      expect(code).to.include('GRAMMAR_BY_ID');
      expect(code).to.include('getContribution');
    });

    it('should include all packages in registry', () => {
      const packages: ScannedGrammarPackage[] = [
        {
          packageName: '@sanyam/grammar-ecml',
          languageId: 'ecml',
          contributionPath: './lib/contribution.js',
          packagePath: '/path/to/ecml',
          version: '1.0.0',
        },
        {
          packageName: '@sanyam/grammar-spdevkit',
          languageId: 'spdevkit',
          contributionPath: './lib/contribution.js',
          packagePath: '/path/to/spdevkit',
          version: '2.0.0',
        },
      ];

      const code = generateRegistryCode(packages);

      expect(code).to.include('contribution0');
      expect(code).to.include('contribution1');
      expect(code).to.include('@sanyam/grammar-ecml');
      expect(code).to.include('@sanyam/grammar-spdevkit');
    });

    it('should include generation timestamp', () => {
      const packages: ScannedGrammarPackage[] = [];
      const code = generateRegistryCode(packages);

      expect(code).to.include('Generated at:');
      expect(code).to.include('AUTO-GENERATED');
    });

    it('should handle empty package list', () => {
      const packages: ScannedGrammarPackage[] = [];
      const code = generateRegistryCode(packages);

      expect(code).to.include('GRAMMAR_REGISTRY');
      expect(code).to.include('Packages: 0');
    });
  });
});
