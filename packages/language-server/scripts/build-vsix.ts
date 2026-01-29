#!/usr/bin/env ts-node
/**
 * VSIX Build Script (T137)
 *
 * Builds the complete VSIX package including:
 * - Generated TextMate grammars from Langium grammars
 * - Language configurations
 * - VSIX manifest contributions
 * - Generated vsix-config.ts for dynamic document selector
 *
 * IMPORTANT: This script only includes grammars that are dependencies of the
 * application packages (electron and browser), NOT all grammars in the workspace.
 *
 * Usage:
 *   ts-node --esm scripts/build-vsix.ts
 *
 * Prerequisites:
 *   - Grammar packages must have langium-config.json files
 *   - Langium CLI must be available (npm install langium)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import {
  findGrammarPackages,
  type ScannedGrammarPackage,
} from '@sanyam/grammar-scanner';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Grammar package with Langium configuration path.
 */
interface GrammarPackageWithConfig extends ScannedGrammarPackage {
  langiumConfigPath: string | null;
  grammarPath: string | null;
}

/**
 * Get all grammar packages that are dependencies of applications.
 *
 * This ensures we only include grammars that are actually used by the
 * electron and/or browser applications, not every grammar in the workspace.
 *
 * @param workspaceRoot - Root directory of the workspace
 * @returns Array of scanned grammar packages from application dependencies
 */
async function getApplicationGrammarPackages(workspaceRoot: string): Promise<ScannedGrammarPackage[]> {
  const applicationDirs = [
    path.join(workspaceRoot, 'applications/electron'),
    path.join(workspaceRoot, 'applications/browser'),
  ];

  // Collect unique grammar package names from all applications
  const grammarPackageNames = new Set<string>();
  for (const appDir of applicationDirs) {
    const packageJsonPath = path.join(appDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packages = findGrammarPackages(packageJsonPath);
      packages.forEach((name: string) => grammarPackageNames.add(name));
    }
  }

  // Resolve each package to get its metadata
  const packages: ScannedGrammarPackage[] = [];
  for (const packageName of grammarPackageNames) {
    // Convert @sanyam-grammar/spdevkit to packages/grammar-definitions/spdevkit
    const grammarName = packageName.replace('@sanyam-grammar/', '');
    const packagePath = path.join(workspaceRoot, 'packages/grammar-definitions', grammarName);

    if (fs.existsSync(packagePath)) {
      const pkgJsonPath = path.join(packagePath, 'package.json');
      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));

      packages.push({
        packageName,
        languageId: pkgJson.sanyam?.languageId ?? grammarName,
        contributionPath: pkgJson.sanyam?.contribution ?? './lib/src/contribution.js',
        packagePath,
        version: pkgJson.version,
      });
    } else {
      console.warn(`  Warning: Package path not found for ${packageName}: ${packagePath}`);
    }
  }

  return packages;
}

/**
 * Find Langium configuration for a grammar package.
 */
function findLangiumConfig(pkg: ScannedGrammarPackage): GrammarPackageWithConfig {
  const packageDir = pkg.packagePath;

  // Check for langium-config.json
  const langiumConfigPath = path.join(packageDir, 'langium-config.json');
  const hasLangiumConfig = fs.existsSync(langiumConfigPath);

  // Find .langium file
  let grammarPath: string | null = null;
  const possibleGrammarPaths = [
    path.join(packageDir, `${pkg.languageId}.langium`),
    path.join(packageDir, 'src', `${pkg.languageId}.langium`),
    path.join(packageDir, 'grammar', `${pkg.languageId}.langium`),
  ];

  for (const possiblePath of possibleGrammarPaths) {
    if (fs.existsSync(possiblePath)) {
      grammarPath = possiblePath;
      break;
    }
  }

  return {
    ...pkg,
    langiumConfigPath: hasLangiumConfig ? langiumConfigPath : null,
    grammarPath,
  };
}

/**
 * Generate TextMate grammar from Langium grammar.
 *
 * Uses Langium's CLI to generate the TextMate grammar.
 * Falls back to generating a placeholder if Langium generation fails.
 */
function generateTextMateGrammar(
  pkg: GrammarPackageWithConfig,
  outputDir: string
): { success: boolean; error?: string } {
  const outputPath = path.join(outputDir, `${pkg.languageId}.tmLanguage.json`);

  // If we have a langium-config.json, try to run langium generate
  if (pkg.langiumConfigPath) {
    const packageDir = pkg.packagePath;

    try {
      console.log(`  Running langium generate for ${pkg.languageId}...`);

      // Create a temporary langium-config.json with TextMate output
      const langiumConfig = JSON.parse(
        fs.readFileSync(pkg.langiumConfigPath, 'utf-8')
      );

      // Ensure textMate output is configured
      if (!langiumConfig.textMate) {
        langiumConfig.textMate = {
          out: path.relative(packageDir, outputDir),
        };
      }

      // Write temporary config
      const tempConfigPath = path.join(packageDir, 'langium-config.textmate.json');
      fs.writeFileSync(
        tempConfigPath,
        JSON.stringify(langiumConfig, null, 2),
        'utf-8'
      );

      try {
        // Run langium generate with textmate output
        execSync(
          `npx langium generate --textmate -c ${tempConfigPath}`,
          {
            cwd: packageDir,
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 30000,
          }
        );

        // Check if the grammar was generated
        const generatedPath = path.join(
          packageDir,
          langiumConfig.textMate?.out || 'syntaxes',
          `${pkg.languageId}.tmLanguage.json`
        );

        if (fs.existsSync(generatedPath)) {
          // Copy to output directory
          fs.copyFileSync(generatedPath, outputPath);
          console.log(`  Generated: ${pkg.languageId}.tmLanguage.json`);
          return { success: true };
        }
      } finally {
        // Clean up temporary config
        if (fs.existsSync(tempConfigPath)) {
          fs.unlinkSync(tempConfigPath);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`  Warning: Langium generation failed for ${pkg.languageId}: ${errorMessage}`);
      console.log(`  Falling back to placeholder grammar...`);
    }
  }

  // Fall back to generating a placeholder grammar from the .langium file
  if (pkg.grammarPath) {
    try {
      const grammarContent = fs.readFileSync(pkg.grammarPath, 'utf-8');
      const tmGrammar = generatePlaceholderFromLangiumGrammar(
        pkg.languageId,
        grammarContent
      );
      fs.writeFileSync(outputPath, JSON.stringify(tmGrammar, null, 2) + '\n', 'utf-8');
      console.log(`  Generated: ${pkg.languageId}.tmLanguage.json (from Langium grammar)`);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  // No grammar source available - create minimal placeholder
  const tmGrammar = createMinimalPlaceholder(pkg.languageId);
  fs.writeFileSync(outputPath, JSON.stringify(tmGrammar, null, 2) + '\n', 'utf-8');
  console.log(`  Generated: ${pkg.languageId}.tmLanguage.json (minimal placeholder)`);
  return { success: true };
}

/**
 * Generate a TextMate grammar placeholder by parsing the Langium grammar.
 *
 * Extracts keywords, terminal rules for strings/comments, etc.
 */
function generatePlaceholderFromLangiumGrammar(
  languageId: string,
  grammarContent: string
): object {
  // Extract keywords from the grammar
  const keywordMatches = grammarContent.match(/'([a-zA-Z_][a-zA-Z0-9_]*)'/g) || [];
  const keywords = [
    ...new Set(
      keywordMatches
        .map((k) => k.replace(/'/g, ''))
        .filter((k) => k.length > 1)
    ),
  ];

  // Detect if grammar has specific terminal rules
  const hasStringTerminal = /terminal\s+STRING\s*:/i.test(grammarContent);
  const hasCommentTerminal =
    /terminal\s+(SL_COMMENT|ML_COMMENT)/i.test(grammarContent) ||
    grammarContent.includes('//') ||
    grammarContent.includes('/*');

  // Build patterns
  const patterns: object[] = [];
  const repository: Record<string, object> = {};

  // Keywords
  if (keywords.length > 0) {
    patterns.push({ include: '#keywords' });
    repository['keywords'] = {
      patterns: [
        {
          name: `keyword.control.${languageId}`,
          match: `\\b(${keywords.join('|')})\\b`,
        },
      ],
    };
  }

  // Strings
  if (hasStringTerminal || grammarContent.includes('STRING')) {
    patterns.push({ include: '#strings' });
    repository['strings'] = {
      patterns: [
        {
          name: 'string.quoted.double',
          begin: '"',
          end: '"',
          patterns: [
            {
              name: 'constant.character.escape',
              match: '\\\\.',
            },
          ],
        },
        {
          name: 'string.quoted.single',
          begin: "'",
          end: "'",
          patterns: [
            {
              name: 'constant.character.escape',
              match: '\\\\.',
            },
          ],
        },
      ],
    };
  }

  // Comments
  if (hasCommentTerminal) {
    patterns.push({ include: '#comments' });
    repository['comments'] = {
      patterns: [
        {
          name: 'comment.line.double-slash',
          match: '//.*$',
        },
        {
          name: 'comment.block',
          begin: '/\\*',
          end: '\\*/',
        },
      ],
    };
  }

  // Numbers
  patterns.push({ include: '#numbers' });
  repository['numbers'] = {
    patterns: [
      {
        name: 'constant.numeric',
        match: '\\b\\d+(\\.\\d+)?\\b',
      },
    ],
  };

  return {
    $schema:
      'https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json',
    name: languageId,
    scopeName: `source.${languageId}`,
    patterns,
    repository,
  };
}

/**
 * Create a minimal placeholder TextMate grammar.
 */
function createMinimalPlaceholder(languageId: string): object {
  return {
    $schema:
      'https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json',
    name: languageId,
    scopeName: `source.${languageId}`,
    patterns: [
      { include: '#comments' },
      { include: '#strings' },
    ],
    repository: {
      comments: {
        patterns: [
          {
            name: 'comment.line.double-slash',
            match: '//.*$',
          },
          {
            name: 'comment.block',
            begin: '/\\*',
            end: '\\*/',
          },
        ],
      },
      strings: {
        patterns: [
          {
            name: 'string.quoted.double',
            begin: '"',
            end: '"',
            patterns: [
              {
                name: 'constant.character.escape',
                match: '\\\\.',
              },
            ],
          },
        ],
      },
    },
  };
}

/**
 * Generate language configuration file.
 */
function generateLanguageConfiguration(languageId: string): object {
  return {
    comments: {
      lineComment: '//',
      blockComment: ['/*', '*/'],
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"', notIn: ['string'] },
      { open: "'", close: "'", notIn: ['string', 'comment'] },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    folding: {
      markers: {
        start: '^\\s*//\\s*#?region\\b',
        end: '^\\s*//\\s*#?endregion\\b',
      },
    },
    indentationRules: {
      increaseIndentPattern: '^.*\\{[^}"\']*$',
      decreaseIndentPattern: '^\\s*\\}',
    },
  };
}

/**
 * Update package.json with VSIX contributions.
 */
function updatePackageJson(
  packages: readonly GrammarPackageWithConfig[]
): void {
  const packageJsonPath = path.resolve(__dirname, '../package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

  // Generate contributions
  const languages = packages.map((pkg) => ({
    id: pkg.languageId,
    aliases: [
      pkg.languageId.charAt(0).toUpperCase() + pkg.languageId.slice(1),
      pkg.languageId,
    ],
    extensions: getExtensionsForPackage(pkg),
    configuration: `./language-configurations/${pkg.languageId}.json`,
  }));

  const grammars = packages.map((pkg) => ({
    language: pkg.languageId,
    scopeName: `source.${pkg.languageId}`,
    path: `./syntaxes/${pkg.languageId}.tmLanguage.json`,
  }));

  const activationEvents = packages.map(
    (pkg) => `onLanguage:${pkg.languageId}`
  );

  // Update package.json
  packageJson.activationEvents = activationEvents;
  packageJson.contributes = packageJson.contributes || {};
  packageJson.contributes.languages = languages;
  packageJson.contributes.grammars = grammars;

  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify(packageJson, null, 2) + '\n',
    'utf-8'
  );
  console.log('Updated: package.json with VSIX contributions');
}

/**
 * Get file extensions for a package from its contribution.ts file.
 *
 * Looks for fileExtensions array in src/contribution.ts first,
 * then falls back to src/manifest.ts for single fileExtension.
 */
function getExtensionsForPackage(pkg: GrammarPackageWithConfig): string[] {
  const packageDir = pkg.packagePath;

  // Try contribution.ts first (has fileExtensions array)
  const contributionPath = path.join(packageDir, 'src', 'contribution.ts');
  if (fs.existsSync(contributionPath)) {
    try {
      const content = fs.readFileSync(contributionPath, 'utf-8');
      // Match fileExtensions: ['.ext1', '.ext2']
      const match = content.match(/fileExtensions:\s*\[([^\]]+)\]/);
      if (match) {
        const extensions = match[1].match(/['"]([^'"]+)['"]/g);
        if (extensions) {
          return extensions.map((e: string) => e.replace(/['"]/g, ''));
        }
      }
    } catch {
      // Fall through to manifest
    }
  }

  // Fallback to manifest.ts (note: src/manifest.ts)
  const manifestPath = path.join(packageDir, 'src', 'manifest.ts');
  if (fs.existsSync(manifestPath)) {
    try {
      const content = fs.readFileSync(manifestPath, 'utf-8');
      // Extract fileExtension from manifest
      const match = content.match(/fileExtension:\s*['"]([^'"]+)['"]/);
      if (match) {
        return [match[1]];
      }
    } catch {
      // Fall through to default
    }
  }

  // Last resort fallback
  return [`.${pkg.languageId}`];
}

/**
 * Generate the vsix-config.ts file with document selector configuration.
 *
 * This file is imported by extension.ts to dynamically configure
 * the language client's document selector based on discovered grammars.
 */
function generateVsixConfig(packages: readonly GrammarPackageWithConfig[]): void {
  const generatedDir = path.resolve(__dirname, '../src/generated');
  if (!fs.existsSync(generatedDir)) {
    fs.mkdirSync(generatedDir, { recursive: true });
  }

  const languages = packages.map((p) => p.languageId);
  const extensions = packages.flatMap((p) => getExtensionsForPackage(p));
  const uniqueExtensions = [...new Set(extensions)];

  // Generate extension patterns without the leading dot for the pattern
  const extensionPatterns = uniqueExtensions.map((e) => e.replace(/^\./, ''));

  const code = `/**
 * VSIX Configuration - AUTO-GENERATED
 *
 * Generated by build-vsix.ts from application grammar dependencies.
 * Do not edit manually.
 */
import type { DocumentSelector } from 'vscode-languageclient';

export const SUPPORTED_LANGUAGES = ${JSON.stringify(languages, null, 2)} as const;

export const FILE_EXTENSIONS = ${JSON.stringify(uniqueExtensions, null, 2)} as const;

export const DOCUMENT_SELECTOR: DocumentSelector = [
${languages.map((l) => `  { scheme: 'file', language: '${l}' },`).join('\n')}
  { scheme: 'file', pattern: '**/*.{${extensionPatterns.join(',')}}' },
];
`;

  fs.writeFileSync(
    path.join(generatedDir, 'vsix-config.ts'),
    code,
    'utf-8'
  );
  console.log('Generated: src/generated/vsix-config.ts');
}

/**
 * Generate the server-contributions.ts file with grammar contribution imports.
 *
 * This file is imported by main.ts to load grammar contributions for the
 * language server when running as a bundled VSIX plugin.
 */
function generateServerContributions(packages: readonly GrammarPackageWithConfig[]): void {
  const generatedDir = path.resolve(__dirname, '../src/generated');
  if (!fs.existsSync(generatedDir)) {
    fs.mkdirSync(generatedDir, { recursive: true });
  }

  // Generate import statements and contribution array
  const imports = packages.map((pkg, index) => {
    // Use the package name for the import (will be bundled by esbuild)
    return `import { contribution as contribution${index} } from '${pkg.packageName}/contribution';`;
  });

  const contributionRefs = packages.map((_, index) => `contribution${index}`);

  const code = `/**
 * Server Contributions - AUTO-GENERATED
 *
 * Generated by build-vsix.ts from application grammar dependencies.
 * Do not edit manually.
 *
 * This file imports all grammar contributions for the language server.
 */
import type { LanguageContributionInterface } from '../server-factory.js';

${imports.join('\n')}

/**
 * All grammar contributions for the bundled VSIX.
 */
export const GRAMMAR_CONTRIBUTIONS: LanguageContributionInterface[] = [
  ${contributionRefs.join(',\n  ')},
];
`;

  fs.writeFileSync(
    path.join(generatedDir, 'server-contributions.ts'),
    code,
    'utf-8'
  );
  console.log('Generated: src/generated/server-contributions.ts');
}

/**
 * Update language-server package.json devDependencies and tsconfig.json references
 * to include all discovered grammar packages.
 *
 * This ensures:
 * - pnpm resolves the grammar packages into node_modules (strict mode)
 * - Turbo knows to build grammar packages before the language server
 * - tsc can resolve the static imports in generated server-contributions.ts
 *
 * @param packages - Discovered grammar packages
 * @param workspaceRoot - Root directory of the workspace
 */
function updateGrammarDependencies(
  packages: readonly GrammarPackageWithConfig[],
  workspaceRoot: string
): void {
  if (packages.length === 0) {
    return;
  }

  // --- Update package.json devDependencies ---
  const packageJsonPath = path.resolve(__dirname, '../package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

  const devDeps = packageJson.devDependencies ?? {};
  let packageJsonChanged = false;

  for (const pkg of packages) {
    if (!(pkg.packageName in devDeps)) {
      devDeps[pkg.packageName] = 'workspace:*';
      packageJsonChanged = true;
      console.log(`  Added devDependency: ${pkg.packageName}`);
    }
  }

  if (packageJsonChanged) {
    // Sort devDependencies for deterministic output
    const sorted: Record<string, string> = {};
    for (const key of Object.keys(devDeps).sort()) {
      sorted[key] = devDeps[key];
    }
    packageJson.devDependencies = sorted;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf-8');
    console.log('  Updated: package.json devDependencies');
  } else {
    console.log('  package.json devDependencies already up to date');
  }

  // --- Update tsconfig.json references ---
  const tsconfigPath = path.resolve(__dirname, '../tsconfig.json');
  const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
  const refs: Array<{ path: string }> = tsconfig.references ?? [];
  let tsconfigChanged = false;

  for (const pkg of packages) {
    const grammarName = pkg.packageName.replace('@sanyam-grammar/', '');
    const relativePath = `../grammar-definitions/${grammarName}`;

    const alreadyReferenced = refs.some(
      (ref) => ref.path === relativePath
    );

    if (!alreadyReferenced) {
      refs.push({ path: relativePath });
      tsconfigChanged = true;
      console.log(`  Added tsconfig reference: ${relativePath}`);
    }
  }

  if (tsconfigChanged) {
    tsconfig.references = refs;
    fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + '\n', 'utf-8');
    console.log('  Updated: tsconfig.json references');
  } else {
    console.log('  tsconfig.json references already up to date');
  }
}

async function main(): Promise<void> {
  console.log('=== VSIX Build Script ===\n');

  // Find workspace root
  const workspaceRoot = path.resolve(__dirname, '../../..');

  // Create output directories
  const syntaxesDir = path.resolve(__dirname, '../syntaxes');
  const languageConfigDir = path.resolve(
    __dirname,
    '../language-configurations'
  );

  if (!fs.existsSync(syntaxesDir)) {
    fs.mkdirSync(syntaxesDir, { recursive: true });
  }
  if (!fs.existsSync(languageConfigDir)) {
    fs.mkdirSync(languageConfigDir, { recursive: true });
  }

  // Get grammar packages from application dependencies (not all workspace grammars)
  console.log('Scanning application dependencies for grammar packages...');
  const packages = await getApplicationGrammarPackages(workspaceRoot);

  if (packages.length === 0) {
    console.warn('\nWarning: No @sanyam-grammar/* packages found in application dependencies.');
    console.warn('Add grammar dependencies to applications/electron or applications/browser package.json');
  }

  console.log(`Found ${packages.length} grammar package(s) from application dependencies\n`);
  for (const pkg of packages) {
    console.log(`  - ${pkg.packageName} (${pkg.languageId})`);
  }
  console.log('');

  // Find Langium configurations
  const packagesWithConfig = packages.map(findLangiumConfig);

  // Generate TextMate grammars
  console.log('Generating TextMate grammars...');
  const errors: string[] = [];

  for (const pkg of packagesWithConfig) {
    console.log(`\nProcessing: ${pkg.languageId}`);
    const generateResult = generateTextMateGrammar(pkg, syntaxesDir);
    if (!generateResult.success && generateResult.error) {
      errors.push(`${pkg.languageId}: ${generateResult.error}`);
    }
  }

  // Generate language configurations
  console.log('\nGenerating language configurations...');
  for (const pkg of packagesWithConfig) {
    const configPath = path.join(languageConfigDir, `${pkg.languageId}.json`);
    const config = generateLanguageConfiguration(pkg.languageId);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
    console.log(`  Generated: ${pkg.languageId}.json`);
  }

  // Update package.json
  console.log('\nUpdating package.json...');
  updatePackageJson(packagesWithConfig);

  // Generate vsix-config.ts for extension.ts
  console.log('\nGenerating vsix-config.ts...');
  generateVsixConfig(packagesWithConfig);

  // Generate server-contributions.ts for main.ts
  console.log('\nGenerating server-contributions.ts...');
  generateServerContributions(packagesWithConfig);

  // Ensure grammar packages are declared as devDependencies and tsconfig references
  // so that tsc can resolve the generated imports
  console.log('\nUpdating grammar dependencies...');
  updateGrammarDependencies(packagesWithConfig, workspaceRoot);

  // Report results
  console.log('\n=== Build Summary ===');
  console.log(`Grammar packages processed: ${packagesWithConfig.length}`);
  console.log(
    `TextMate grammars generated: ${packagesWithConfig.length - errors.length}`
  );
  console.log(
    `Language configurations generated: ${packagesWithConfig.length}`
  );

  if (errors.length > 0) {
    console.log(`\nErrors (${errors.length}):`);
    for (const error of errors) {
      console.log(`  - ${error}`);
    }
  }

  console.log('\nVSIX build complete.');
  console.log(
    'Run "vsce package" to create the .vsix file.'
  );
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
