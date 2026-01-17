#!/usr/bin/env ts-node
/**
 * Grammar Registry Generator
 *
 * Scans the pnpm workspace for grammar packages and generates
 * a static registry file for runtime loading.
 *
 * Usage:
 *   ts-node --esm scripts/generate-grammar-registry.ts
 *
 * Output:
 *   src/generated/grammar-registry.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  scanForGrammarPackages,
  generateRegistryCode,
} from '../src/discovery/grammar-scanner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main(): Promise<void> {
  console.log('Scanning for grammar packages...');

  // Find workspace root (go up from packages/language-server/scripts to root)
  const workspaceRoot = path.resolve(__dirname, '../../..');

  const result = await scanForGrammarPackages({ workspaceRoot });

  // Log warnings
  if (result.warnings.length > 0) {
    console.warn('Warnings:');
    for (const warning of result.warnings) {
      console.warn(`  - ${warning}`);
    }
  }

  // Log discovered packages
  console.log(`Found ${result.packages.length} grammar package(s):`);
  for (const pkg of result.packages) {
    console.log(`  - ${pkg.languageId} (${pkg.packageName})`);
  }

  // Generate registry code
  const registryCode = generateRegistryCode(result.packages);

  // Write to output file
  const outputDir = path.resolve(__dirname, '../src/generated');
  const outputPath = path.join(outputDir, 'grammar-registry.ts');

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, registryCode, 'utf-8');
  console.log(`Generated: ${outputPath}`);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
