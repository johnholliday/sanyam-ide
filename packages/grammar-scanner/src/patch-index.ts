#!/usr/bin/env node
/**
 * Patch Index - Post-build hook to inject grammar manifest loading
 *
 * This script patches the Theia-generated src-gen/frontend/index.js to load
 * the grammar-manifests-module, enabling grammar documentation in the UI.
 *
 * Usage:
 *   npx patch-index [--cwd <path>]
 *
 * This should be run AFTER `theia build` to patch the generated index.js.
 *
 * @packageDocumentation
 */

import { patchGeneratedIndex } from './generate-app-grammars.js';

/**
 * Parse CLI arguments.
 */
function parseArgs(args: string[]): { cwd: string; help: boolean } {
  let cwd = process.cwd();
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg === '--cwd') {
      cwd = args[++i] ?? cwd;
    }
  }

  return { cwd, help };
}

/**
 * Print usage information.
 */
function printHelp(): void {
  console.log(`
patch-index - Patch Theia-generated index.js to load grammar manifests

Usage:
  npx patch-index [options]

Options:
  --cwd <path>    Working directory with src-gen/frontend/index.js (default: cwd)
  --help, -h      Show this help message

This script should be run AFTER 'theia build' to patch the generated index.js
and enable grammar documentation features in the Getting Started widget and
About dialog.

Examples:
  # Patch with defaults (current directory)
  npx patch-index

  # Patch a specific application directory
  npx patch-index --cwd ./applications/electron
`);
}

/**
 * Main CLI entry point.
 */
function main(): void {
  const { cwd, help } = parseArgs(process.argv.slice(2));

  if (help) {
    printHelp();
    process.exit(0);
  }

  console.log('Patching frontend index.js for grammar manifests...');
  console.log(`  Working directory: ${cwd}`);

  const success = patchGeneratedIndex(cwd);

  if (!success) {
    // Don't fail the build - just warn
    console.log('  Patch not applied (this is OK for first build)');
  }
}

// Run if invoked directly
main();
