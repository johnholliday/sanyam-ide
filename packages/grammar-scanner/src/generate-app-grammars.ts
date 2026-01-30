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
import { fileURLToPath } from 'node:url';

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
 * Generate JavaScript code for frontend manifest map module.
 *
 * This creates a simple map of language IDs to grammar manifests,
 * which can be imported by the product extension via webpack alias.
 *
 * Note: This generates JavaScript (not TypeScript) because webpack processes
 * this file directly via the alias and doesn't have ts-loader configured for it.
 *
 * @param packages - Array of grammar package names
 * @param appName - Application name for documentation
 * @returns Generated JavaScript source code
 */
export function generateFrontendManifestsCode(packages: string[], appName?: string): string {
  const appLabel = appName ?? 'this application';

  if (packages.length === 0) {
    return `/**
 * Grammar Manifests Map - AUTO-GENERATED
 *
 * No @sanyam-grammar/* packages found in package.json.
 * Add grammar dependencies to enable language support.
 *
 * Generated at: ${new Date().toISOString()}
 */

/**
 * Map of language IDs to grammar manifests for ${appLabel}.
 * @type {Record<string, import('@sanyam/types').GrammarManifest>}
 */
export const grammarManifests = {};
`;
  }

  const imports = packages
    .map((pkg) => {
      const varName = packageNameToVariable(pkg);
      return `import { manifest as ${varName}Manifest } from '${pkg}/manifest';`;
    })
    .join('\n');

  const entries = packages
    .map((pkg) => {
      const varName = packageNameToVariable(pkg);
      return `  [${varName}Manifest.languageId]: ${varName}Manifest,`;
    })
    .join('\n');

  return `/**
 * Grammar Manifests Map - AUTO-GENERATED
 *
 * This file is generated from @sanyam-grammar/* dependencies in package.json.
 * Do not edit manually - run 'pnpm generate:grammars' to regenerate.
 *
 * This module is imported by the product extension via webpack alias (@app/grammar-manifests).
 *
 * Generated at: ${new Date().toISOString()}
 * Packages: ${packages.length}
 */

${imports}

/**
 * Map of language IDs to grammar manifests for ${appLabel}.
 *
 * These manifests are automatically discovered from @sanyam-grammar/* package.json dependencies.
 * The product extension imports this map and registers it with the GrammarRegistry.
 * @type {Record<string, import('@sanyam/types').GrammarManifest>}
 */
export const grammarManifests = {
${entries}
};
`;
}

/**
 * Generate JavaScript code for the grammars module.
 *
 * ## Why JavaScript Instead of TypeScript?
 *
 * Theia applications have `"include": []` in their tsconfig.json, meaning
 * the `src/` folder is NOT compiled by `tsc`. The build process uses webpack
 * to bundle pre-compiled code from `node_modules/` and Theia-generated files
 * in `src-gen/`. Custom TypeScript in the application's `src/` folder would
 * require additional tsconfig configuration that doesn't exist.
 *
 * By generating JavaScript directly to `lib/`, we bypass TypeScript compilation
 * entirely. The GLSP backend service can `require()` this file immediately.
 *
 * ## Why a Generated File Instead of Runtime Scanning?
 *
 * We considered having the GLSP backend service scan `package.json` and
 * dynamically import grammar packages at runtime. However, this creates a
 * **module resolution context problem**:
 *
 * - The GLSP backend service runs from `@sanyam-ide/glsp` package
 * - Dynamic imports resolve from the GLSP package's `node_modules/`
 * - Grammar packages (e.g., `@sanyam-grammar/ecml`) are dependencies of the
 *   APPLICATION, not the GLSP package
 * - With pnpm's strict isolation, the import would fail because the grammar
 *   package isn't in the GLSP package's dependency tree
 *
 * By generating a file in the APPLICATION's `lib/` folder, the imports
 * execute in the application's module resolution context where grammar
 * packages ARE installed.
 *
 * ## How the GLSP Backend Service Uses This File
 *
 * 1. Service calls `resolveGrammarsModule()` to find the application root
 *    by walking up from `__dirname` looking for `package.json` with `theia` config
 * 2. Service calls `require(appRoot/lib/language-server/grammars.js)`
 * 3. The `grammars.js` file exports `GrammarContributions` array
 * 4. Service registers each contribution with the GLSP server
 *
 * @param packages - Array of grammar package names (e.g., ['@sanyam-grammar/ecml'])
 * @param appName - Application name for documentation comments
 * @returns Generated JavaScript source code
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

/**
 * List of enabled grammar contributions for ${appLabel}.
 * @type {import('@sanyam/types').LanguageContributionInterface[]}
 */
export const ENABLED_GRAMMARS = [];

/**
 * Get the language IDs of all enabled grammars.
 * @returns {string[]}
 */
export function getEnabledLanguageIds() {
  return ENABLED_GRAMMARS.map(g => g.languageId);
}

/**
 * Get file extensions supported by enabled grammars.
 * @returns {string[]}
 */
export function getEnabledFileExtensions() {
  return ENABLED_GRAMMARS.flatMap(g => g.fileExtensions);
}

/**
 * Alias export for GLSP backend service.
 */
export { ENABLED_GRAMMARS as GrammarContributions };
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
 *
 * ## Why This File Exists
 *
 * The GLSP backend service (\`@sanyam-ide/glsp\`) needs to load grammar contributions
 * but must remain grammar-agnostic (no hardcoded grammar dependencies). This file
 * solves that by:
 *
 * 1. Living in the APPLICATION directory (not the GLSP extension)
 * 2. Importing grammar packages that ARE dependencies of this application
 * 3. Exporting them for the GLSP service to consume via dynamic import()
 *
 * ## Module Resolution Context
 *
 * When the GLSP backend service calls \`import(this-file-url)\`:
 * - Node.js loads this file from the application's lib/language-server/ directory
 * - The import statements below resolve from the application's node_modules/
 * - Grammar packages ARE installed there (they're app dependencies)
 * - This avoids the module resolution problem that would occur if the GLSP
 *   service tried to import grammar packages directly
 *
 * ## How to Change Grammars
 *
 * 1. Edit this application's package.json dependencies
 * 2. Run: pnpm install
 * 3. Run: pnpm generate:grammars (or pnpm build)
 *
 * This file will be regenerated with the new grammar imports.
 */

${imports}

/**
 * List of enabled grammar contributions for ${appLabel}.
 *
 * These grammars are automatically discovered from package.json dependencies.
 * To add a grammar:
 * 1. pnpm add @sanyam-grammar/newlang
 * 2. Run: pnpm generate:grammars
 *
 * @type {import('@sanyam/types').LanguageContributionInterface[]}
 */
export const ENABLED_GRAMMARS = [
${entries}
];

/**
 * Get the language IDs of all enabled grammars.
 * @returns {string[]}
 */
export function getEnabledLanguageIds() {
  return ENABLED_GRAMMARS.map(g => g.languageId);
}

/**
 * Get file extensions supported by enabled grammars.
 * @returns {string[]}
 */
export function getEnabledFileExtensions() {
  return ENABLED_GRAMMARS.flatMap(g => g.fileExtensions);
}

/**
 * Alias export for GLSP backend service.
 *
 * The GLSP backend service looks for this export name when loading grammar
 * contributions. We export both names for compatibility:
 * - ENABLED_GRAMMARS: Original name, used by language server
 * - GrammarContributions: Preferred name for GLSP service
 */
export { ENABLED_GRAMMARS as GrammarContributions };
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
  let outputPath = 'lib/language-server/grammars.js';
  let frontendOutputPath = 'src/frontend/grammar-manifests-module.js';
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
generate-app-grammars - Generate grammars.js from package.json dependencies

Usage:
  npx generate-app-grammars [options]

Options:
  --output, -o <path>   Output file path (default: lib/language-server/grammars.js)
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

/**
 * Patch the Theia-generated frontend index.js to load grammar manifests.
 *
 * This adds an import statement to load the grammar-manifests-module
 * as part of the frontend startup sequence, making manifests available
 * to the GrammarRegistry for UI features like the Getting Started widget.
 *
 * @param cwd - Working directory containing src-gen/frontend/index.js
 * @returns true if patched successfully, false if skipped or failed
 */
export function patchGeneratedIndex(cwd: string): boolean {
  const indexPath = path.resolve(cwd, 'src-gen/frontend/index.js');

  if (!fs.existsSync(indexPath)) {
    console.log('  Skipping index.js patch (run theia build first)');
    return false;
  }

  let content = fs.readFileSync(indexPath, 'utf-8');

  // Already patched?
  if (content.includes('grammar-manifests-module')) {
    console.log('  Already patched');
    return true;
  }

  // Find the insertion point: before 'await start()'
  // This ensures all other modules are loaded before we load grammar manifests
  const marker = 'await start();';
  const insertPoint = content.indexOf(marker);

  if (insertPoint === -1) {
    console.warn('  Could not find insertion point (await start())');
    return false;
  }

  // Insert the load statement for grammar-manifests-module
  // The path is relative from src-gen/frontend/index.js to src/frontend/grammar-manifests-module
  const importLine = "await load(container, import('../../src/frontend/grammar-manifests-module'));\n        ";
  content = content.slice(0, insertPoint) + importLine + content.slice(insertPoint);

  fs.writeFileSync(indexPath, content);
  console.log('  Patched index.js to load grammar manifests');
  return true;
}

// Run if invoked directly (not when imported by another module)
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  main();
}
