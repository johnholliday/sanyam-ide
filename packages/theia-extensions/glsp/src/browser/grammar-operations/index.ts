/**
 * Grammar Operations Module
 *
 * Exports grammar operation IDE integration components.
 *
 * @packageDocumentation
 */

export {
  GrammarOperationService,
  GrammarOperationServiceImpl,
  GrammarOperationServiceInterface,
  OperationExecutionResult,
  ExecuteOperationOptions,
} from './grammar-operation-service';

export {
  GrammarOperationCommands,
  GrammarOperationCommandContribution,
} from './grammar-operation-commands';

export {
  GrammarOperationMenus,
  GrammarOperationMenuContribution,
} from './grammar-operation-menus';

export {
  GrammarOperationToolbarContribution,
  GrammarOperationToolbarContributionImpl,
  GrammarOperationToolbarContributionInterface,
} from './grammar-operation-toolbar';

export {
  GrammarOperationOutput,
  GrammarOperationOutputService,
  GrammarOperationOutputServiceImpl,
} from './grammar-operation-output';

export {
  GrammarOperationInitializer,
  GrammarOperationInitializerImpl,
} from './grammar-operation-initializer';
