/**
 * Operation Registry
 *
 * Central registry for grammar operation handlers.
 * Maps operation IDs to their handler implementations.
 *
 * @packageDocumentation
 */

import type {
  GrammarOperation,
  OperationHandler,
  OperationHandlers,
  LanguageContributionInterface,
} from '@sanyam/types';
import { createLogger } from '@sanyam/logger';

const logger = createLogger({ name: 'OperationRegistry' });

/**
 * Information about a registered operation.
 */
export interface RegisteredOperation {
  /** The operation declaration from the manifest */
  readonly declaration: GrammarOperation;

  /** The handler implementation */
  readonly handler: OperationHandler;

  /** The language ID this operation belongs to */
  readonly languageId: string;
}

/**
 * Registry entry for a language's operations.
 */
interface LanguageOperationEntry {
  /** Language ID */
  readonly languageId: string;

  /** Map of operation ID to registered operation */
  readonly operations: Map<string, RegisteredOperation>;
}

/**
 * Central registry for grammar operation handlers.
 *
 * Operations are registered when language contributions are loaded.
 * The registry provides lookup by language ID and operation ID.
 */
export class OperationRegistry {
  /** Map of language ID to operation entries */
  private readonly languages = new Map<string, LanguageOperationEntry>();

  /**
   * Register operations from a language contribution.
   *
   * @param contribution - The language contribution containing operations
   */
  registerLanguage(contribution: LanguageContributionInterface): void {
    const languageId = contribution.languageId;
    const manifest = contribution.manifest;
    const handlers = contribution.operationHandlers ?? {};

    // Skip if no operations declared
    if (!manifest.operations || manifest.operations.length === 0) {
      logger.debug({ languageId }, 'No operations declared in manifest');
      return;
    }

    const operations = new Map<string, RegisteredOperation>();
    let registeredCount = 0;
    let missingCount = 0;

    for (const declaration of manifest.operations) {
      const handler = handlers[declaration.id];

      if (!handler) {
        logger.warn(
          { languageId, operationId: declaration.id },
          'Operation declared in manifest but no handler provided'
        );
        missingCount++;
        continue;
      }

      operations.set(declaration.id, {
        declaration,
        handler,
        languageId,
      });
      registeredCount++;
    }

    this.languages.set(languageId, {
      languageId,
      operations,
    });

    logger.info(
      { languageId, registered: registeredCount, missing: missingCount },
      'Operations registered for language'
    );
  }

  /**
   * Get an operation by language ID and operation ID.
   *
   * @param languageId - The language ID
   * @param operationId - The operation ID
   * @returns The registered operation or undefined
   */
  getOperation(languageId: string, operationId: string): RegisteredOperation | undefined {
    const entry = this.languages.get(languageId);
    if (!entry) {
      return undefined;
    }
    return entry.operations.get(operationId);
  }

  /**
   * Get all operations for a language.
   *
   * @param languageId - The language ID
   * @returns Array of registered operations
   */
  getOperationsForLanguage(languageId: string): RegisteredOperation[] {
    const entry = this.languages.get(languageId);
    if (!entry) {
      return [];
    }
    return Array.from(entry.operations.values());
  }

  /**
   * Get all registered language IDs.
   *
   * @returns Array of language IDs with registered operations
   */
  getAllLanguageIds(): string[] {
    return Array.from(this.languages.keys());
  }

  /**
   * Get operation declarations for a language (for REST/LSP discovery).
   *
   * @param languageId - The language ID
   * @returns Array of operation declarations
   */
  getOperationDeclarations(languageId: string): GrammarOperation[] {
    const entry = this.languages.get(languageId);
    if (!entry) {
      return [];
    }
    return Array.from(entry.operations.values()).map((op) => op.declaration);
  }

  /**
   * Check if an operation exists.
   *
   * @param languageId - The language ID
   * @param operationId - The operation ID
   * @returns True if the operation exists
   */
  hasOperation(languageId: string, operationId: string): boolean {
    return this.getOperation(languageId, operationId) !== undefined;
  }

  /**
   * Get total count of registered operations.
   *
   * @returns Total number of registered operations
   */
  getOperationCount(): number {
    let count = 0;
    for (const entry of this.languages.values()) {
      count += entry.operations.size;
    }
    return count;
  }

  /**
   * Get operations by category for a language.
   *
   * @param languageId - The language ID
   * @returns Map of category to operations
   */
  getOperationsByCategory(languageId: string): Map<string, RegisteredOperation[]> {
    const operations = this.getOperationsForLanguage(languageId);
    const categories = new Map<string, RegisteredOperation[]>();

    for (const op of operations) {
      const category = op.declaration.category ?? 'Other';
      const existing = categories.get(category) ?? [];
      existing.push(op);
      categories.set(category, existing);
    }

    return categories;
  }

  /**
   * Find operations that target specific AST types.
   *
   * @param languageId - The language ID
   * @param astTypes - AST types to match
   * @returns Operations that target any of the specified types
   */
  findOperationsForTypes(languageId: string, astTypes: string[]): RegisteredOperation[] {
    const operations = this.getOperationsForLanguage(languageId);

    return operations.filter((op) => {
      const targetTypes = op.declaration.targetTypes;
      // '*' matches all types
      if (targetTypes.includes('*')) {
        return true;
      }
      // Check for intersection
      return targetTypes.some((t) => astTypes.includes(t));
    });
  }
}
