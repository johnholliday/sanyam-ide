/**
 * Container test harness for Inversify DI wiring verification.
 *
 * Provides utilities for building and testing container configurations.
 */

import { Container, type ContainerModule, type interfaces } from 'inversify';

type ServiceIdentifier<T = unknown> = interfaces.ServiceIdentifier<T>;

/**
 * Options for creating a container test harness.
 */
export interface ContainerTestHarnessOptions {
  /** Container modules to load */
  modules: ContainerModule[];
}

/**
 * Test harness for verifying inversify DI wiring.
 */
export interface ContainerTestHarness {
  /** The built container */
  readonly container: Container;

  /**
   * Check if a binding exists.
   * @param serviceIdentifier - Service identifier to check
   */
  isBound<T>(serviceIdentifier: ServiceIdentifier<T>): boolean;

  /**
   * Get a bound service (throws if not bound).
   * @param serviceIdentifier - Service identifier to resolve
   */
  get<T>(serviceIdentifier: ServiceIdentifier<T>): T;

  /**
   * Get all bound services for multi-injection.
   * @param serviceIdentifier - Service identifier to resolve
   */
  getAll<T>(serviceIdentifier: ServiceIdentifier<T>): T[];

  /** Dispose the container */
  dispose(): void;
}

/**
 * Creates a test harness for verifying inversify DI wiring.
 *
 * @param options - Configuration with modules to load
 * @returns Container test harness
 *
 * @example
 * ```typescript
 * const harness = createContainerTestHarness({
 *   modules: [MyModule, OtherModule]
 * });
 *
 * expect(harness.isBound(MyService)).toBe(true);
 * const service = harness.get(MyService);
 * expect(service).toBeInstanceOf(MyServiceImpl);
 *
 * harness.dispose();
 * ```
 */
export function createContainerTestHarness(
  options: ContainerTestHarnessOptions
): ContainerTestHarness {
  const container = new Container({
    defaultScope: 'Singleton',
    autoBindInjectable: false,
  });

  // Load all modules
  for (const module of options.modules) {
    container.load(module);
  }

  return {
    get container(): Container {
      return container;
    },

    isBound<T>(serviceIdentifier: ServiceIdentifier<T>): boolean {
      return container.isBound(serviceIdentifier);
    },

    get<T>(serviceIdentifier: ServiceIdentifier<T>): T {
      return container.get<T>(serviceIdentifier);
    },

    getAll<T>(serviceIdentifier: ServiceIdentifier<T>): T[] {
      try {
        return container.getAll<T>(serviceIdentifier);
      } catch {
        // In inversify 6.x, getAll throws if no bindings found
        return [];
      }
    },

    dispose(): void {
      container.unbindAll();
    },
  };
}
