/**
 * Langium Integration Helper
 *
 * Provides utilities for composing Langium modules and creating services
 * for registered language contributions.
 *
 * @packageDocumentation
 */

import { inject, type Module, type PartialLangiumServices } from 'langium';
import {
  createDefaultModule,
  createDefaultSharedModule,
  type LangiumServices,
  type LangiumSharedServices,
  type DefaultSharedModuleContext,
} from 'langium/lsp';
import type { LanguageContributionInterface } from '@sanyam/types';

/**
 * Result of composing Langium services for a language.
 */
export interface ComposedServices {
  /** The composed language services */
  readonly services: LangiumServices;
  /** The shared services instance */
  readonly shared: LangiumSharedServices;
}

/**
 * Context for creating shared services.
 *
 * This extends Langium's DefaultSharedModuleContext with any
 * additional context needed for the unified server.
 */
export interface SharedServiceContext extends DefaultSharedModuleContext {
  /**
   * Additional configuration for shared services.
   */
  readonly config?: {
    /**
     * Whether to enable logging.
     */
    readonly logging?: boolean;
  };
}

/**
 * Create shared Langium services.
 *
 * The shared services instance is created once and shared across
 * all registered languages. It includes:
 * - Connection handling
 * - Document management
 * - Service registry
 * - Workspace management
 *
 * @param context - Context for creating shared services
 * @param contributionModules - Shared modules from all contributions
 * @returns Composed shared services
 */
export function createSharedServices(
  context: SharedServiceContext,
  contributionModules: readonly Module<LangiumSharedServices>[]
): LangiumSharedServices {
  // Start with Langium defaults, then layer contribution modules
  const modules: Module<LangiumSharedServices>[] = [
    createDefaultSharedModule(context),
    ...contributionModules,
  ];

  return inject(...modules);
}

/**
 * Create language services for a single contribution.
 *
 * Composes the generated and custom modules on top of Langium defaults,
 * using the provided shared services instance.
 *
 * @param contribution - The language contribution
 * @param shared - Shared services instance
 * @returns Composed language services
 */
export function createLanguageServicesFromContribution(
  contribution: LanguageContributionInterface,
  shared: LangiumSharedServices
): LangiumServices {
  const modules: Module<LangiumServices>[] = [
    // Langium defaults configured with shared services
    createDefaultModule({ shared }),
    // Generated module from langium generate
    contribution.generatedModule,
  ];

  // Add custom module if provided (applied last for overrides)
  if (contribution.customModule) {
    modules.push(contribution.customModule);
  }

  // Compose all modules
  const services = inject(...modules);

  // Register with the shared service registry
  shared.ServiceRegistry.register(services);

  return services;
}

/**
 * Create a custom module that overrides specific services.
 *
 * This is a helper for creating modules that override Langium services
 * in a type-safe way.
 *
 * @example
 * ```typescript
 * const customModule = createCustomModule({
 *   references: {
 *     ScopeProvider: (services) => new CustomScopeProvider(services),
 *   },
 *   validation: {
 *     ValidationRegistry: (services) => new CustomValidationRegistry(services),
 *   },
 * });
 * ```
 *
 * @param overrides - Service overrides
 * @returns A Langium module
 */
export function createCustomModule(
  overrides: PartialLangiumServices
): Module<LangiumServices, PartialLangiumServices> {
  return overrides;
}

/**
 * Compose multiple modules into a single module.
 *
 * Later modules override earlier ones.
 *
 * @param modules - Modules to compose
 * @returns A single composed module
 */
export function composeModules<T>(
  ...modules: Module<T>[]
): Module<T> {
  if (modules.length === 0) {
    return {};
  }
  if (modules.length === 1 && modules[0]) {
    return modules[0];
  }

  return inject(...modules);
}

/**
 * Get services for a specific service path.
 *
 * This is a type-safe way to access nested services.
 *
 * @example
 * ```typescript
 * const scopeProvider = getService(services, 'references', 'ScopeProvider');
 * ```
 *
 * @param services - The services container
 * @param path - Path segments to the service
 * @returns The service or undefined if not found
 */
export function getService<T>(
  services: LangiumServices,
  ...path: string[]
): T | undefined {
  let current: unknown = services;

  for (const segment of path) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current as T | undefined;
}

/**
 * Check if a service exists at the given path.
 *
 * @param services - The services container
 * @param path - Path segments to the service
 * @returns True if the service exists
 */
export function hasService(
  services: LangiumServices,
  ...path: string[]
): boolean {
  return getService(services, ...path) !== undefined;
}
