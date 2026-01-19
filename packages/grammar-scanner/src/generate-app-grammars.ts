#!/usr/bin/env node
/**
 * Generate App Grammars - Build-time Grammar Configuration Generator
 *
 * This script reads an application's package.json, discovers all @sanyam-grammar/*
 * dependencies, and generates a grammars.ts file with proper imports and exports.
 *
 * Usage:
 *   npx generate-app-grammars [--output <path>] [--cwd <path>]
 *
 * Options:
 *   --output, -o   Output file path (default: src/language-server/grammars.ts)
 *   --cwd          Working directory containing package.json (default: process.cwd())
 *   --help, -h     Show help
 *
 * @packageDocumentation
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Package.json structure with dependencies.
 */
interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * CLI options for the generator.
 */
export interface GeneratorOptions {
  /** Working directory containing package.json */
  cwd: string;
  /** Output file path for language server grammars (relative to cwd or absolute) */
  outputPath: string;
  /** Output file path for frontend manifest module (relative to cwd or absolute) */
  frontendOutputPath?: string;
}

/**
 * Result of grammar generation.
 */
export interface GenerationResult {
  /** Whether generation was successful */
  success: boolean;
  /** Path to the generated language server file */
  outputPath: string;
  /** Path to the generated frontend module file (if requested) */
  frontendOutputPath?: string;
  /** Number of grammars found */
  grammarCount: number;
  /** List of grammar package names */
  grammarPackages: string[];
  /** Error message if generation failed */
  error?: string;
}

/**
 * Find all @sanyam-grammar/* packages in package.json dependencies.
 *
 * @param packageJsonPath - Path to package.json
 * @returns Sorted array of grammar package names
 */
export function findGrammarPackages(packageJsonPath: string): string[] {
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`package.json not found: ${packageJsonPath}`);
  }

  const content = fs.readFileSync(packageJsonPath, 'utf-8');
  const pkg: PackageJson = JSON.parse(content);

  const allDeps: Record<string, string> = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };

  return Object.keys(allDeps)
    .filter((name) => name.startsWith('@sanyam-grammar/'))
    .sort();
}

/**
 * Convert a grammar package name to a valid variable name.
 *
 * @example
 * packageNameToVariable('@sanyam-grammar/ecml') // => 'ecml'
 * packageNameToVariable('@sanyam-grammar/nist-csf') // => 'nistcsf'
 */
function packageNameToVariable(packageName: string): string {
  const name = packageName.replace('@sanyam-grammar/', '');
  // Remove hyphens to create valid JavaScript identifier
  return name.replace(/-/g, '');
}

/**
 * Generate TypeScript code for frontend manifest contributions module.
 *
 * This creates a ContainerModule that binds all grammar manifests
 * as GrammarManifestContribution for the frontend registry.
 *
 * @param packages - Array of grammar package names
 * @param appName - Application name for documentation
 * @returns Generated TypeScript source code
 */
export function generateFrontendManifestsCode(packages: string[], appName?: string): string {
  const appLabel = appName ?? 'this application';

  if (packages.length === 0) {
    return `/**
 * Grammar Manifest Contributions - AUTO-GENERATED
 *
 * No @sanyam-grammar/* packages found in package.json.
 * Add grammar dependencies to enable language support.
 *
 * Generated at: ${new Date().toISOString()}
 */

import { ContainerModule } from '@theia/core/shared/inversify';

/**
 * Empty frontend module (no grammars configured).
 */
export default new ContainerModule(() => {
  // No grammar manifests to bind
});
`;
  }

  const imports = packages
    .map((pkg) => {
      const varName = packageNameToVariable(pkg);
      return `import { manifest as ${varName}Manifest } from '${pkg}/manifest';`;
    })
    .join('\n');

  const bindings = packages
    .map((pkg) => {
      const varName = packageNameToVariable(pkg);
      return `  bind(GrammarManifestContribution).toConstantValue({ manifest: ${varName}Manifest });`;
    })
    .join('\n');

  return `/**
 * Grammar Manifest Contributions - AUTO-GENERATED
 *
 * This file is generated from @sanyam-grammar/* dependencies in package.json.
 * Do not edit manually - run 'pnpm generate:grammars' to regenerate.
 *
 * Generated at: ${new Date().toISOString()}
 * Packages: ${packages.length}
 */

import { ContainerModule } from '@theia/core/shared/inversify';
import { GrammarManifestContribution } from '@sanyam/types';

${imports}

/**
 * Frontend module that registers grammar manifests for ${appLabel}.
 *
 * This module binds each grammar's manifest as a GrammarManifestContribution,
 * making them available to the GrammarRegistry for UI features like the
 * Getting Started widget and About dialog.
 */
export default new ContainerModule((bind) => {
${bindings}
});
`;
}

/**
 * Generate TypeScript code for the grammars.ts file.
 *
 * @param packages - Array of grammar package names
 * @param appName - Application name for documentation
 * @returns Generated TypeScript source code
 */
export function generateGrammarsCode(packages: string[], appName?: string): string {
  const appLabel = appName ?? 'this application';

  if (packages.length === 0) {
    return `/**
 * Grammar Configuration - AUTO-GENERATED
 *
 * No @sanyam-grammar/* packages found in package.json.
 * Add grammar dependencies to enable language support.
 *
 * @example
 * To add a grammar:
 * 1. pnpm add @sanyam-grammar/ecml
 * 2. Run: pnpm generate:grammars
 *
 * Generated at: ${new Date().toISOString()}
 */

import type { LanguageContributionInterface } from '@sanyam/types';

/**
 * List of enabled grammar contributions for ${appLabel}.
 */
export const ENABLED_GRAMMARS: LanguageContributionInterface[] = [];

/**
 * Get the language IDs of all enabled grammars.
 */
export function getEnabledLanguageIds(): string[] {
  return ENABLED_GRAMMARS.map(g => g.languageId);
}

/**
 * Get file extensions supported by enabled grammars.
 */
export function getEnabledFileExtensions(): string[] {
  return ENABLED_GRAMMARS.flatMap(g => g.fileExtensions);
}
`;
  }

  const imports = packages
    .map((pkg) => {
      const varName = packageNameToVariable(pkg);
      return `import { contribution as ${varName} } from '${pkg}/contribution';`;
    })
    .join('\n');

  const entries = packages
    .map((pkg) => {
      const varName = packageNameToVariable(pkg);
      return `  ${varName}, // ${pkg}`;
    })
    .join('\n');

  return `/**
 * Grammar Configuration - AUTO-GENERATED
 *
 * This file is generated from @sanyam-grammar/* dependencies in package.json.
 * Do not edit manually - run 'pnpm generate:grammars' to regenerate.
 *
 * Generated at: ${new Date().toISOString()}
 * Packages: ${packages.length}
 */

import type { LanguageContributionInterface } from '@sanyam/types';

${imports}

/**
 * List of enabled grammar contributions for ${appLabel}.
 *
 * These grammars are automatically discovered from package.json dependencies.
 * To add a grammar:
 * 1. pnpm add @sanyam-grammar/newlang
 * 2. Run: pnpm generate:grammars
 */
export const ENABLED_GRAMMARS: LanguageContributionInterface[] = [
${entries}
];

/**
 * Get the language IDs of all enabled grammars.
 */
export function getEnabledLanguageIds(): string[] {
  return ENABLED_GRAMMARS.map(g => g.languageId);
}

/**
 * Get file extensions supported by enabled grammars.
 */
export function getEnabledFileExtensions(): string[] {
  return ENABLED_GRAMMARS.flatMap(g => g.fileExtensions);
}
`;
}

/**
 * Generate grammars.ts for an application.
 *
 * @param options - Generator options
 * @returns Generation result
 */
export function generateAppGrammars(options: GeneratorOptions): GenerationResult {
  const { cwd, outputPath, frontendOutputPath } = options;

  try {
    const packageJsonPath = path.resolve(cwd, 'package.json');
    const packages = findGrammarPackages(packageJsonPath);

    // Read app name from package.json
    const pkgContent = fs.readFileSync(packageJsonPath, 'utf-8');
    const pkg: PackageJson = JSON.parse(pkgContent);
    const appName = pkg.name ?? 'this application';

    // Generate language server grammars file
    const code = generateGrammarsCode(packages, appName);

    // Determine output path for language server file
    const fullOutputPath = path.isAbsolute(outputPath)
      ? outputPath
      : path.resolve(cwd, outputPath);

    // Ensure output directory exists
    const outputDir = path.dirname(fullOutputPath);
    fs.mkdirSync(outputDir, { recursive: true });

    // Write the language server file
    fs.writeFileSync(fullOutputPath, code);

    // Generate frontend manifests module if path is provided
    let fullFrontendPath: string | undefined;
    if (frontendOutputPath) {
      const frontendCode = generateFrontendManifestsCode(packages, appName);
      fullFrontendPath = path.isAbsolute(frontendOutputPath)
        ? frontendOutputPath
        : path.resolve(cwd, frontendOutputPath);

      const frontendDir = path.dirname(fullFrontendPath);
      fs.mkdirSync(frontendDir, { recursive: true });
      fs.writeFileSync(fullFrontendPath, frontendCode);
    }

    const result: GenerationResult = {
      success: true,
      outputPath: fullOutputPath,
      grammarCount: packages.length,
      grammarPackages: packages,
    };
    if (fullFrontendPath) {
      result.frontendOutputPath = fullFrontendPath;
    }
    return result;
  } catch (error) {
    return {
      success: false,
      outputPath: path.resolve(cwd, outputPath),
      grammarCount: 0,
      grammarPackages: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Parse CLI arguments.
 */
function parseArgs(args: string[]): { cwd: string; outputPath: string; frontendOutputPath: string; help: boolean } {
  let cwd = process.cwd();
  let outputPath = 'src/language-server/grammars.ts';
  let frontendOutputPath = 'src/frontend/grammar-manifests-module.ts';
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg === '--output' || arg === '-o') {
      outputPath = args[++i] ?? outputPath;
    } else if (arg === '--frontend-output' || arg === '-f') {
      frontendOutputPath = args[++i] ?? frontendOutputPath;
    } else if (arg === '--cwd') {
      cwd = args[++i] ?? cwd;
    }
  }

  return { cwd, outputPath, frontendOutputPath, help };
}

/**
 * Print usage information.
 */
function printHelp(): void {
  console.log(`
generate-app-grammars - Generate grammars.ts from package.json dependencies

Usage:
  npx generate-app-grammars [options]

Options:
  --output, -o <path>   Output file path (default: src/language-server/grammars.ts)
  --cwd <path>          Working directory with package.json (default: cwd)
  --help, -h            Show this help message

Examples:
  # Generate with defaults
  npx generate-app-grammars

  # Custom output path
  npx generate-app-grammars -o src/grammars.ts

  # Different working directory
  npx generate-app-grammars --cwd ./applications/electron
`);
}

/**
 * Main CLI entry point.
 */
function main(): void {
  const { cwd, outputPath, frontendOutputPath, help } = parseArgs(process.argv.slice(2));

  if (help) {
    printHelp();
    process.exit(0);
  }

  console.log('Generating grammar configuration...');
  console.log(`  Working directory: ${cwd}`);
  console.log(`  Output: ${outputPath}`);
  console.log(`  Frontend output: ${frontendOutputPath}`);

  const result = generateAppGrammars({ cwd, outputPath, frontendOutputPath });

  if (result.success) {
    console.log(`\nGenerated ${result.outputPath}`);
    if (result.frontendOutputPath) {
      console.log(`Generated ${result.frontendOutputPath}`);
    }
    console.log(`  Found ${result.grammarCount} grammar(s):`);
    for (const pkg of result.grammarPackages) {
      console.log(`    - ${pkg}`);
    }
    if (result.grammarCount === 0) {
      console.log('    (none - add @sanyam-grammar/* dependencies to package.json)');
    }
  } else {
    console.error(`\nFailed to generate grammars: ${result.error}`);
    process.exit(1);
  }
}

// Run if invoked directly
main();
