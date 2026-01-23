/**
 * Grammar Scanner - Build-time Package Discovery
 *
 * Scans the pnpm workspace to discover grammar packages and generates
 * a static registry file for runtime loading.
 *
 * @packageDocumentation
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { GrammarPackageJson } from '@sanyam/types';

/**
 * Result of scanning a single grammar package.
 */
export interface ScannedGrammarPackage {
  /** Package name (e.g., '@sanyam-grammar/ecml') */
  readonly packageName: string;
  /** Language identifier */
  readonly languageId: string;
  /** Path to contribution export (relative to package) */
  readonly contributionPath: string;
  /** Absolute path to the package directory */
  readonly packagePath: string;
  /** Package version */
  readonly version: string;
}

/**
 * Result of scanning the entire workspace.
 */
export interface GrammarScanResult {
  /** All discovered grammar packages */
  readonly packages: readonly ScannedGrammarPackage[];
  /** Warnings encountered during scanning */
  readonly warnings: readonly string[];
}

/**
 * Options for the grammar scanner.
 */
export interface GrammarScannerOptions {
  /** Root path of the workspace (defaults to cwd) */
  readonly workspaceRoot?: string;
  /** Path to pnpm-workspace.yaml (relative to workspace root) */
  readonly workspaceConfigPath?: string;
}

/**
 * Scans the pnpm workspace to discover grammar packages.
 *
 * Grammar packages are identified by having a `sanyam.grammar: true` field in package.json.
 * The `@sanyam-grammar/*` naming convention alone is NOT sufficient.
 *
 * @param options - Scanner options
 * @returns Scan result with discovered packages and any warnings
 */
export async function scanForGrammarPackages(
  options: GrammarScannerOptions = {}
): Promise<GrammarScanResult> {
  const workspaceRoot = options.workspaceRoot ?? process.cwd();
  const workspaceConfigPath = options.workspaceConfigPath ?? 'pnpm-workspace.yaml';

  const warnings: string[] = [];
  const packages: ScannedGrammarPackage[] = [];

  // Read workspace configuration
  const workspaceConfigFullPath = path.join(workspaceRoot, workspaceConfigPath);

  if (!fs.existsSync(workspaceConfigFullPath)) {
    warnings.push(`Workspace config not found: ${workspaceConfigFullPath}`);
    return { packages: [], warnings };
  }

  const workspaceConfigContent = fs.readFileSync(workspaceConfigFullPath, 'utf-8');
  const workspaceConfig = parseYaml(workspaceConfigContent) as { packages?: string[] };

  if (!workspaceConfig.packages || !Array.isArray(workspaceConfig.packages)) {
    warnings.push('No packages array found in workspace config');
    return { packages: [], warnings };
  }

  // Find all packages matching the workspace globs
  for (const globPattern of workspaceConfig.packages) {
    // Simple glob handling - expand * patterns
    const packageDirs = expandGlobPattern(workspaceRoot, globPattern);

    for (const packageDir of packageDirs) {
      const packageJsonPath = path.join(packageDir, 'package.json');

      if (!fs.existsSync(packageJsonPath)) {
        continue;
      }

      try {
        const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageJsonContent) as GrammarPackageJson;

        const scanned = tryParseGrammarPackage(packageJson, packageDir);
        if (scanned) {
          packages.push(scanned);
        }
      } catch (error) {
        warnings.push(`Error reading ${packageJsonPath}: ${String(error)}`);
      }
    }
  }

  return { packages, warnings };
}

/**
 * Try to parse a package.json as a grammar package.
 *
 * Grammar packages MUST have `sanyam.grammar: true` in package.json.
 * The `@sanyam-grammar/*` naming convention alone is not sufficient.
 *
 * @param packageJson - Parsed package.json
 * @param packagePath - Absolute path to the package
 * @returns Scanned package info or undefined if not a grammar package
 */
function tryParseGrammarPackage(
  packageJson: GrammarPackageJson,
  packagePath: string
): ScannedGrammarPackage | undefined {
  const { name, version, sanyam } = packageJson;

  // REQUIRE explicit sanyam.grammar flag - naming convention alone is insufficient
  // This prevents non-grammar packages (like documentation sites) with @sanyam-grammar/ prefix
  // from being included in the registry
  if (sanyam?.grammar === true) {
    return {
      packageName: name,
      languageId: sanyam.languageId ?? extractLanguageIdFromName(name),
      contributionPath: sanyam.contribution ?? './lib/contribution.js',
      packagePath,
      version,
    };
  }

  return undefined;
}

/**
 * Extract language ID from package name.
 *
 * @example
 * extractLanguageIdFromName('@sanyam-grammar/ecml') // => 'ecml'
 * extractLanguageIdFromName('@sanyam-grammar/iso-42001') // => 'iso-42001'
 */
function extractLanguageIdFromName(packageName: string): string {
  const match = packageName.match(/@sanyam\/grammar-(.+)/);
  return match?.[1] ?? packageName;
}

/**
 * Expand a simple glob pattern to actual directories.
 *
 * Supports basic patterns like 'packages/*', 'grammars/*'
 *
 * @param rootDir - Root directory
 * @param pattern - Glob pattern
 * @returns Array of matching directory paths
 */
function expandGlobPattern(rootDir: string, pattern: string): string[] {
  // Handle simple wildcard at end: 'packages/*'
  if (pattern.endsWith('/*')) {
    const baseDir = pattern.slice(0, -2);
    const fullBasePath = path.join(rootDir, baseDir);

    if (!fs.existsSync(fullBasePath)) {
      return [];
    }

    try {
      const entries = fs.readdirSync(fullBasePath, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(fullBasePath, entry.name));
    } catch {
      return [];
    }
  }

  // Handle exact path
  const fullPath = path.join(rootDir, pattern);
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
    return [fullPath];
  }

  return [];
}

/**
 * Generate TypeScript code for the grammar registry.
 *
 * @param packages - Scanned grammar packages
 * @returns TypeScript source code
 */
export function generateRegistryCode(packages: readonly ScannedGrammarPackage[]): string {
  const imports = packages
    .map(
      (pkg, index) =>
        `import { contribution as contribution${index} } from '${pkg.packageName}/contribution';`
    )
    .join('\n');

  const registryEntries = packages
    .map(
      (pkg, index) =>
        `  contribution${index}, // ${pkg.languageId} from ${pkg.packageName}`
    )
    .join('\n');

  return `/**
 * Grammar Registry - AUTO-GENERATED
 *
 * This file is generated by the grammar scanner during build.
 * Do not edit manually.
 *
 * Generated at: ${new Date().toISOString()}
 * Packages: ${packages.length}
 */

import type { LanguageContributionInterface } from '@sanyam/types';

${imports}

/**
 * All discovered language contributions.
 *
 * This array is populated at build time from grammar packages
 * discovered in the pnpm workspace.
 */
export const GRAMMAR_REGISTRY: readonly LanguageContributionInterface[] = [
${registryEntries}
];

/**
 * Map of language IDs to contributions for fast lookup.
 */
export const GRAMMAR_BY_ID: ReadonlyMap<string, LanguageContributionInterface> = new Map(
  GRAMMAR_REGISTRY.map((c) => [c.languageId, c])
);

/**
 * Get a contribution by language ID.
 */
export function getContribution(languageId: string): LanguageContributionInterface | undefined {
  return GRAMMAR_BY_ID.get(languageId);
}
`;
}
