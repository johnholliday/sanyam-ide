/**
 * Vitest Workspace Configuration
 *
 * Defines test projects for the Sanyam IDE monorepo.
 * Each project can have its own configuration for different test types.
 *
 * @see https://vitest.dev/guide/workspace
 */
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  // Unit tests - fast, no external dependencies
  {
    extends: './vitest.config.ts',
    test: {
      name: 'unit',
      include: ['packages/**/src/**/*.test.ts', 'packages/**/*.test.ts'],
      exclude: [
        '**/node_modules/**',
        '**/lib/**',
        '**/*.integration.test.ts',
        '**/tests/integration/**',
      ],
      environment: 'node',
    },
  },

  // Integration tests - require Supabase
  {
    extends: './vitest.config.ts',
    test: {
      name: 'integration',
      include: [
        'packages/**/*.integration.test.ts',
        'packages/**/tests/integration/**/*.test.ts',
      ],
      exclude: ['**/node_modules/**', '**/lib/**'],
      environment: 'node',
      // Integration tests run serially to avoid database conflicts
      pool: 'forks',
      poolOptions: {
        forks: {
          singleFork: true,
        },
      },
      // Longer timeout for database operations
      testTimeout: 30000,
      hookTimeout: 30000,
      // Global setup for Supabase
      globalSetup: ['./packages/test-utils/src/setup/global-setup.ts'],
    },
  },

  // Database tests - RLS, triggers, functions
  {
    extends: './vitest.config.ts',
    test: {
      name: 'database',
      include: ['packages/**/tests/database/**/*.test.ts', 'supabase/**/*.test.ts'],
      exclude: ['**/node_modules/**', '**/lib/**'],
      environment: 'node',
      // Database tests MUST run serially
      pool: 'forks',
      poolOptions: {
        forks: {
          singleFork: true,
        },
      },
      testTimeout: 60000,
      hookTimeout: 60000,
      globalSetup: ['./packages/test-utils/src/setup/global-setup.ts'],
    },
  },
]);
