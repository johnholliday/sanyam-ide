#!/usr/bin/env ts-node
/**
 * VSIX Build Script (T137)
 *
 * Builds the complete VSIX package including:
 * - Generated TextMate grammars from Langium grammars
 * - Language configurations
 * - VSIX manifest contributions
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
  scanForGrammarPackages,
  type ScannedGrammarPackage,
} from '../src/grammar-scanner/grammar-scanner.js';

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
 * Find Langium configuration for a grammar package.
 */
function findLangiumConfig(pkg: ScannedGrammarPackage): GrammarPackageWithConfig {
  const packageDir = path.dirname(pkg.packageJsonPath);

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
    const packageDir = path.dirname(pkg.packageJsonPath);

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
 * Get file extensions for a package from its manifest.
 */
function getExtensionsForPackage(pkg: GrammarPackageWithConfig): string[] {
  // Read manifest from package
  const packageDir = path.dirname(pkg.packageJsonPath);
  const manifestPath = path.join(packageDir, 'manifest.ts');

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

  // Default mapping
  const extensionMap: Record<string, string[]> = {
    ecml: ['.ecml'],
    spdevkit: ['.spdk'],
    actone: ['.actone'],
    'iso-42001': ['.iso42001'],
    'example-minimal': ['.example'],
  };

  return extensionMap[pkg.languageId] ?? [`.${pkg.languageId}`];
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

  // Scan for grammar packages
  console.log('Scanning for grammar packages...');
  const result = await scanForGrammarPackages({ workspaceRoot });

  if (result.warnings.length > 0) {
    console.warn('\nWarnings:');
    for (const warning of result.warnings) {
      console.warn(`  - ${warning}`);
    }
  }

  console.log(`Found ${result.packages.length} grammar package(s)\n`);

  // Find Langium configurations
  const packagesWithConfig = result.packages.map(findLangiumConfig);

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
