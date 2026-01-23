/**
 * Langium Integration Helper
 *
 * Provides utilities for composing Langium modules and creating services
 * for registered language contributions.
 *
 * @packageDocumentation
 */

import {
  type Module,
  type PartialLangiumCoreServices,
} from 'langium';
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
  contributionModules: readonly Module<LangiumSharedServices, LangiumSharedServices>[]
): LangiumSharedServices {
  // Import inject from langium
  const { inject } = require('langium');

  // Start with Langium defaults, then layer contribution modules
  const defaultModule = createDefaultSharedModule(context);

  // Langium 4.x uses inject with rest parameters
  // Create the base services first, then apply contribution overrides
  let services = inject(defaultModule) as LangiumSharedServices;

  // Apply contribution modules as overrides
  for (const contributionModule of contributionModules) {
    services = inject(defaultModule, contributionModule) as LangiumSharedServices;
  }

  return services;
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
  // Import inject from langium
  const { inject } = require('langium');

  // Langium defaults configured with shared services
  const defaultModule = createDefaultModule({ shared });
  // Generated module from langium generate
  const generatedModule = contribution.generatedModule;

  // Compose modules using inject
  let services: LangiumServices;

  // Add custom module if provided (applied last for overrides)
  if (contribution.customModule) {
    services = inject(defaultModule, generatedModule, contribution.customModule) as LangiumServices;
  } else {
    services = inject(defaultModule, generatedModule) as LangiumServices;
  }

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
  overrides: PartialLangiumCoreServices
): Module<LangiumServices, PartialLangiumCoreServices> {
  return overrides as Module<LangiumServices, PartialLangiumCoreServices>;
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
  ...modules: Module<T, T>[]
): Module<T, T> {
  if (modules.length === 0) {
    return {} as Module<T, T>;
  }
  if (modules.length === 1 && modules[0]) {
    return modules[0];
  }

  // Import inject from langium
  const { inject } = require('langium');

  // Langium 4.x inject returns the composed services, not a module
  // We apply injection at runtime to compose the modules
  return ((ctx: T) => {
    let result = ctx;
    for (const mod of modules) {
      if (typeof mod === 'function') {
        result = (mod as (ctx: T) => T)(result);
      } else {
        // Merge object-style modules
        result = { ...result, ...mod } as T;
      }
    }
    return result;
  }) as unknown as Module<T, T>;
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
