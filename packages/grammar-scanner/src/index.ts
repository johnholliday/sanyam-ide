/**
 * Grammar Discovery - Build-time Package Discovery
 *
 * This package provides tools for discovering grammar packages
 * in a pnpm workspace at build time.
 *
 * @packageDocumentation
 */

export {
  scanForGrammarPackages,
  generateRegistryCode,
  type ScannedGrammarPackage,
  type GrammarScanResult,
  type GrammarScannerOptions,
} from './grammar-scanner.js';

export {
  findGrammarPackages,
  generateGrammarsCode,
  generateAppGrammars,
  type GeneratorOptions,
  type GenerationResult,
} from './generate-app-grammars.js';
