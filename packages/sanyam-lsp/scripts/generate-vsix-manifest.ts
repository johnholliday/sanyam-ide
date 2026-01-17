#!/usr/bin/env ts-node
/**
 * VSIX Manifest Generator
 *
 * Generates the VS Code extension manifest (package.json) contributions
 * based on discovered grammar packages.
 *
 * Usage:
 *   ts-node --esm scripts/generate-vsix-manifest.ts
 *
 * This script updates the package.json with:
 * - contributes.languages - Language definitions
 * - contributes.grammars - TextMate grammar references
 * - activationEvents - Language activation events
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  scanForGrammarPackages,
  type ScannedGrammarPackage,
} from '../src/discovery/grammar-scanner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Language contribution for VS Code package.json
 */
interface LanguageContribution {
  id: string;
  aliases: string[];
  extensions: string[];
  configuration?: string;
}

/**
 * Grammar contribution for VS Code package.json
 */
interface GrammarContribution {
  language: string;
  scopeName: string;
  path: string;
}

/**
 * Generate language contributions from scanned packages.
 */
function generateLanguageContributions(
  packages: readonly ScannedGrammarPackage[]
): LanguageContribution[] {
  return packages.map((pkg) => ({
    id: pkg.languageId,
    aliases: [pkg.languageId.toUpperCase(), pkg.languageId],
    extensions: getExtensionsForLanguage(pkg.languageId),
    configuration: `./language-configurations/${pkg.languageId}.json`,
  }));
}

/**
 * Generate grammar contributions from scanned packages.
 */
function generateGrammarContributions(
  packages: readonly ScannedGrammarPackage[]
): GrammarContribution[] {
  return packages.map((pkg) => ({
    language: pkg.languageId,
    scopeName: `source.${pkg.languageId}`,
    path: `./syntaxes/${pkg.languageId}.tmLanguage.json`,
  }));
}

/**
 * Generate activation events from scanned packages.
 */
function generateActivationEvents(
  packages: readonly ScannedGrammarPackage[]
): string[] {
  return packages.map((pkg) => `onLanguage:${pkg.languageId}`);
}

/**
 * Get file extensions for a language ID.
 *
 * This is a simple mapping - in a real implementation,
 * this would read from the grammar manifest.
 */
function getExtensionsForLanguage(languageId: string): string[] {
  const extensionMap: Record<string, string[]> = {
    ecml: ['.ecml'],
    spdevkit: ['.spdk', '.task.spdk', '.story.spdk'],
    actone: ['.story', '.character', '.act'],
    'iso-42001': ['.iso42001'],
  };

  return extensionMap[languageId] ?? [`.${languageId}`];
}

/**
 * Generate a language configuration file.
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
        start: new RegExp('^\\s*//\\s*#?region\\b'),
        end: new RegExp('^\\s*//\\s*#?endregion\\b'),
      },
    },
  };
}

async function main(): Promise<void> {
  console.log('Generating VSIX manifest contributions...');

  // Find workspace root
  const workspaceRoot = path.resolve(__dirname, '../../..');

  // Scan for grammar packages
  const result = await scanForGrammarPackages({ workspaceRoot });

  if (result.warnings.length > 0) {
    console.warn('Warnings:');
    for (const warning of result.warnings) {
      console.warn(`  - ${warning}`);
    }
  }

  console.log(`Found ${result.packages.length} grammar package(s)`);

  // Generate contributions
  const languages = generateLanguageContributions(result.packages);
  const grammars = generateGrammarContributions(result.packages);
  const activationEvents = generateActivationEvents(result.packages);

  // Read current package.json
  const packageJsonPath = path.resolve(__dirname, '../package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

  // Update package.json with contributions
  packageJson.activationEvents = activationEvents;
  packageJson.contributes = packageJson.contributes || {};
  packageJson.contributes.languages = languages;
  packageJson.contributes.grammars = grammars;

  // Write updated package.json
  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify(packageJson, null, 2) + '\n',
    'utf-8'
  );
  console.log('Updated: package.json');

  // Create directories for generated files
  const languageConfigDir = path.resolve(__dirname, '../language-configurations');
  const syntaxesDir = path.resolve(__dirname, '../syntaxes');

  if (!fs.existsSync(languageConfigDir)) {
    fs.mkdirSync(languageConfigDir, { recursive: true });
  }
  if (!fs.existsSync(syntaxesDir)) {
    fs.mkdirSync(syntaxesDir, { recursive: true });
  }

  // Generate language configuration files
  for (const pkg of result.packages) {
    const configPath = path.join(languageConfigDir, `${pkg.languageId}.json`);
    const config = generateLanguageConfiguration(pkg.languageId);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
    console.log(`Generated: language-configurations/${pkg.languageId}.json`);
  }

  // Create placeholder TextMate grammar files
  // In a real implementation, these would be generated from Langium
  for (const pkg of result.packages) {
    const grammarPath = path.join(syntaxesDir, `${pkg.languageId}.tmLanguage.json`);
    if (!fs.existsSync(grammarPath)) {
      const placeholderGrammar = {
        $schema: 'https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json',
        name: pkg.languageId,
        scopeName: `source.${pkg.languageId}`,
        patterns: [
          {
            include: '#keywords',
          },
          {
            include: '#strings',
          },
          {
            include: '#comments',
          },
        ],
        repository: {
          keywords: {
            patterns: [
              {
                name: 'keyword.control',
                match: '\\b(if|else|while|for|return)\\b',
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
        },
      };
      fs.writeFileSync(
        grammarPath,
        JSON.stringify(placeholderGrammar, null, 2) + '\n',
        'utf-8'
      );
      console.log(`Generated: syntaxes/${pkg.languageId}.tmLanguage.json (placeholder)`);
    }
  }

  console.log('VSIX manifest generation complete.');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
