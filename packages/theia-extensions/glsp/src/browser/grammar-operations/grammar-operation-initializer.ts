/**
 * Grammar Operation Initializer
 *
 * Frontend application contribution that initializes grammar operations
 * when the application starts. Discovers loaded grammars and registers
 * their operations for commands, menus, and toolbars.
 *
 * @packageDocumentation
 */

import { inject, injectable } from 'inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { CommandRegistry } from '@theia/core';
import { GrammarRegistry } from '@sanyam-ide/product/lib/browser/grammar-registry';
import { GrammarOperationCommandContribution } from './grammar-operation-commands';
import { GrammarOperationMenuContribution } from './grammar-operation-menus';
import {
  GrammarOperationToolbarContribution,
  GrammarOperationToolbarContributionInterface,
} from './grammar-operation-toolbar';

/**
 * Symbol for injection.
 */
export const GrammarOperationInitializer = Symbol('GrammarOperationInitializer');

/**
 * Frontend contribution that initializes grammar operations on app start.
 *
 * This contribution:
 * 1. Waits for the GrammarRegistry to be initialized
 * 2. Iterates through all registered grammars
 * 3. Registers commands, menus, and toolbar items for each grammar's operations
 */
@injectable()
export class GrammarOperationInitializerImpl implements FrontendApplicationContribution {
  @inject(GrammarRegistry)
  protected readonly grammarRegistry: GrammarRegistry;

  @inject(GrammarOperationCommandContribution)
  protected readonly commandContribution: GrammarOperationCommandContribution;

  @inject(GrammarOperationMenuContribution)
  protected readonly menuContribution: GrammarOperationMenuContribution;

  @inject(GrammarOperationToolbarContribution)
  protected readonly toolbarContribution: GrammarOperationToolbarContributionInterface;

  @inject(CommandRegistry)
  protected readonly commandRegistry: CommandRegistry;

  /**
   * Called when the frontend application starts.
   * Registers grammar operations for all discovered grammars.
   */
  async onStart(): Promise<void> {
    // Allow time for other contributions to initialize
    // The GrammarRegistry.initialize() is called during app initialization
    await this.registerAllGrammarOperations();
  }

  /**
   * Register operations for all discovered grammars.
   */
  private async registerAllGrammarOperations(): Promise<void> {
    const manifests = this.grammarRegistry.manifests;

    if (manifests.length === 0) {
      console.info('GrammarOperationInitializer: No grammars found');
      return;
    }

    console.info(`GrammarOperationInitializer: Registering operations for ${manifests.length} grammar(s)`);

    for (const manifest of manifests) {
      const languageId = manifest.languageId;
      // Get operations directly from the manifest - available immediately without server dependency
      const operations = manifest.operations ?? [];

      if (operations.length === 0) {
        console.info(`GrammarOperationInitializer: No operations defined for '${languageId}'`);
        continue;
      }

      try {
        // Register commands for this grammar's operations (pass operations directly)
        this.commandContribution.registerLanguageOperations(languageId, operations, this.commandRegistry);

        // Register menu items for this grammar's operations (pass operations directly)
        this.menuContribution.registerLanguageOperationMenus(languageId, operations);

        // Register toolbar items for this grammar's operations (pass operations directly)
        this.toolbarContribution.registerLanguageOperationToolbar(languageId, operations);

        console.info(`GrammarOperationInitializer: Registered ${operations.length} operations for '${languageId}'`);
      } catch (error) {
        console.error(`GrammarOperationInitializer: Failed to register operations for '${languageId}':`, error);
      }
    }
  }
}
