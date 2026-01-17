/**
 * Example Minimal Grammar Manifest
 *
 * Demonstrates the minimal manifest configuration
 * required for SANYAM integration.
 *
 * @packageDocumentation
 */

/**
 * Example Minimal Grammar Manifest
 *
 * Note: This is a minimal/stub example that doesn't fully implement
 * the GrammarManifest interface. For production use, see the ecml
 * package for a complete example.
 */
export const manifest = {
  languageId: 'example-minimal',
  displayName: 'Example Minimal',
  fileExtension: '.exm',
  baseExtension: '.exm',
  diagrammingEnabled: false,
  rootTypes: [] as const,
  disabledFeatures: [] as string[],
};

export default manifest;
