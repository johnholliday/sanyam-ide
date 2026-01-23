/**
 * Language Registry
 *
 * Runtime registry that manages all loaded language contributions.
 * Provides lookup by language ID, file extension, and URI.
 *
 * @packageDocumentation
 */

import type {
  LangiumServices,
  LangiumSharedServices,
} from 'langium/lsp';
import type {
  LanguageContributionInterface,
  RegisteredLanguage,
  LspFeatureProviders,
  GlspFeatureProviders,
} from '@sanyam/types';
import { URI } from 'vscode-uri';

/**
 * Runtime registry that manages all loaded language contributions.
 *
 * The registry maintains mappings from language IDs and file extensions
 * to registered languages, enabling fast lookup during request handling.
 */
export class LanguageRegistry {
  /**
   * Map from language ID to registered language.
   */
  private readonly languages = new Map<string, RegisteredLanguage>();

  /**
   * Map from file extension to language ID.
   */
  private readonly extensionMap = new Map<string, string>();

  /**
   * Shared Langium services instance.
   */
  private _sharedServices: LangiumSharedServices | undefined;

  /**
   * Get the shared services instance.
   *
   * @throws Error if shared services have not been initialized
   */
  get sharedServices(): LangiumSharedServices {
    if (!this._sharedServices) {
      throw new Error('LanguageRegistry: Shared services not initialized');
    }
    return this._sharedServices;
  }

  /**
   * Set the shared services instance.
   *
   * Called once during server initialization.
   */
  setSharedServices(services: LangiumSharedServices): void {
    if (this._sharedServices) {
      throw new Error('LanguageRegistry: Shared services already initialized');
    }
    this._sharedServices = services;
  }

  /**
   * Register a language contribution.
   *
   * @param contribution - The language contribution to register
   * @param services - The instantiated Langium services for this language
   * @param mergedLspProviders - Merged LSP providers (custom + defaults)
   * @param mergedGlspProviders - Merged GLSP providers (custom + defaults)
   * @throws Error if language ID or file extension is already registered
   */
  register(
    contribution: LanguageContributionInterface,
    services: LangiumServices,
    mergedLspProviders: Required<LspFeatureProviders>,
    mergedGlspProviders: Required<GlspFeatureProviders>
  ): void {
    const { languageId, fileExtensions } = contribution;

    // Check for duplicate language ID
    if (this.languages.has(languageId)) {
      throw new Error(`LanguageRegistry: Duplicate language ID: ${languageId}`);
    }

    // Check for duplicate file extensions
    for (const ext of fileExtensions) {
      const normalizedExt = this.normalizeExtension(ext);
      if (this.extensionMap.has(normalizedExt)) {
        const existingLangId = this.extensionMap.get(normalizedExt);
        throw new Error(
          `LanguageRegistry: Extension '${ext}' already registered by language '${existingLangId}'`
        );
      }
    }

    // Create registered language entry
    const registeredLanguage: RegisteredLanguage = {
      contribution,
      services,
      mergedLspProviders,
      mergedGlspProviders,
    };

    // Register by language ID
    this.languages.set(languageId, registeredLanguage);

    // Register by file extensions
    for (const ext of fileExtensions) {
      const normalizedExt = this.normalizeExtension(ext);
      this.extensionMap.set(normalizedExt, languageId);
    }
  }

  /**
   * Get a registered language by language ID.
   *
   * @param languageId - The language identifier
   * @returns The registered language or undefined if not found
   */
  getByLanguageId(languageId: string): RegisteredLanguage | undefined {
    return this.languages.get(languageId);
  }

  /**
   * Get a registered language by file extension.
   *
   * @param extension - The file extension (with or without leading dot)
   * @returns The registered language or undefined if not found
   */
  getByExtension(extension: string): RegisteredLanguage | undefined {
    const normalizedExt = this.normalizeExtension(extension);
    const languageId = this.extensionMap.get(normalizedExt);
    if (languageId === undefined) {
      return undefined;
    }
    return this.languages.get(languageId);
  }

  /**
   * Get a registered language by document URI.
   *
   * Extracts the file extension from the URI and looks up the language.
   *
   * @param uri - The document URI (string or URI object)
   * @returns The registered language or undefined if not found
   */
  getByUri(uri: string | URI): RegisteredLanguage | undefined {
    const uriObj = typeof uri === 'string' ? URI.parse(uri) : uri;
    const path = uriObj.path;

    // Find the extension - handle compound extensions like .task.spdk
    // Try progressively longer extensions until we find a match
    const parts = path.split('/').pop()?.split('.') ?? [];

    if (parts.length < 2) {
      return undefined; // No extension
    }

    // Try extensions from longest to shortest
    // e.g., for "file.task.spdk" try ".task.spdk" then ".spdk"
    for (let i = 1; i < parts.length; i++) {
      const extension = '.' + parts.slice(i).join('.');
      const language = this.getByExtension(extension);
      if (language) {
        return language;
      }
    }

    return undefined;
  }

  /**
   * Get all registered language IDs.
   *
   * @returns Array of all registered language IDs
   */
  getAllLanguageIds(): string[] {
    return Array.from(this.languages.keys());
  }

  /**
   * Get all registered languages.
   *
   * @returns Array of all registered language entries
   */
  getAllLanguages(): RegisteredLanguage[] {
    return Array.from(this.languages.values());
  }

  /**
   * Get all registered file extensions.
   *
   * @returns Array of all registered file extensions (with leading dot)
   */
  getAllExtensions(): string[] {
    return Array.from(this.extensionMap.keys());
  }

  /**
   * Check if a language is registered.
   *
   * @param languageId - The language identifier
   * @returns True if the language is registered
   */
  hasLanguage(languageId: string): boolean {
    return this.languages.has(languageId);
  }

  /**
   * Check if a file extension is registered.
   *
   * @param extension - The file extension (with or without leading dot)
   * @returns True if the extension is registered
   */
  hasExtension(extension: string): boolean {
    const normalizedExt = this.normalizeExtension(extension);
    return this.extensionMap.has(normalizedExt);
  }

  /**
   * Get the number of registered languages.
   */
  get size(): number {
    return this.languages.size;
  }

  /**
   * Clear all registered languages.
   *
   * Primarily used for testing.
   */
  clear(): void {
    this.languages.clear();
    this.extensionMap.clear();
  }

  /**
   * Normalize a file extension.
   *
   * Ensures the extension starts with a dot and is lowercase.
   *
   * @param extension - The file extension
   * @returns Normalized extension (e.g., '.ecml')
   */
  private normalizeExtension(extension: string): string {
    let normalized = extension.toLowerCase();
    if (!normalized.startsWith('.')) {
      normalized = '.' + normalized;
    }
    return normalized;
  }
}

/**
 * Singleton instance of the language registry.
 *
 * Use this for runtime lookups. It is populated during server startup.
 */
export const languageRegistry = new LanguageRegistry();
