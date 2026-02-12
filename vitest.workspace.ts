/**
 * Vitest Workspace Configuration
 *
 * Defines test projects for the Sanyam IDE monorepo.
 * Each project can have its own configuration for different test types.
 *
 * Timeout Configuration (FR-050-053):
 * - Unit tests: 5s per test
 * - Integration tests: 15s per test
 * - Database tests: 10s per test
 * - Global suite timeout: 5 minutes (via --bail)
 *
 * Coverage Thresholds (FR-054-058):
 * - Core packages (document-store, licensing, test-utils): 90%
 * - Auth/HTTP packages (supabase-auth, language-server routes): 85%
 *
 * @see https://vitest.dev/guide/workspace
 */
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  // Unit tests - fast, no external dependencies
  {
    extends: './vitest.config.ts',
    esbuild: {
      tsconfigRaw: {
        compilerOptions: {
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
        },
      },
    },
    test: {
      name: 'unit',
      include: [
        'packages/**/src/**/*.test.ts',
        'packages/**/tests/unit/**/*.test.ts',
        'packages/**/*.test.ts',
      ],
      exclude: [
        '**/node_modules/**',
        '**/lib/**',
        '**/*.integration.test.ts',
        '**/tests/integration/**',
        '**/supabase/**',
      ],
      environment: 'node',
      setupFiles: ['reflect-metadata'],
      // Unit test timeout: 5s (FR-050)
      testTimeout: 5000,
      hookTimeout: 5000,
      // Coverage thresholds for unit tests
      coverage: {
        thresholds: {
          // Core packages: 90% (FR-054-056)
          'packages/document-store/src/**/*.ts': {
            statements: 90,
            branches: 85,
            functions: 90,
            lines: 90,
          },
          'packages/licensing/src/**/*.ts': {
            statements: 90,
            branches: 85,
            functions: 90,
            lines: 90,
          },
          'packages/test-utils/src/**/*.ts': {
            statements: 90,
            branches: 85,
            functions: 90,
            lines: 90,
          },
          // Auth/HTTP packages: 85% (FR-057-058)
          'packages/supabase-auth/src/**/*.ts': {
            statements: 85,
            branches: 80,
            functions: 85,
            lines: 85,
          },
          'packages/language-server/src/http/**/*.ts': {
            statements: 85,
            branches: 80,
            functions: 85,
            lines: 85,
          },
        },
      },
    },
  },

  // Integration tests - require Supabase
  {
    extends: './vitest.config.ts',
    esbuild: {
      tsconfigRaw: {
        compilerOptions: {
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
        },
      },
    },
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
      // Integration test timeout: 15s (FR-052)
      testTimeout: 15000,
      hookTimeout: 15000,
      // Global setup for Supabase
      globalSetup: ['./packages/test-utils/src/setup/global-setup.ts'],
      setupFiles: ['reflect-metadata'],
      // Run tests sequentially within files
      sequence: {
        concurrent: false,
      },
    },
  },

  // Database tests - RLS, triggers, functions
  {
    extends: './vitest.config.ts',
    esbuild: {
      tsconfigRaw: {
        compilerOptions: {
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
        },
      },
    },
    test: {
      name: 'database',
      include: ['packages/**/tests/database/**/*.test.ts', 'supabase/**/*.test.ts'],
      exclude: ['**/node_modules/**', '**/lib/**'],
      environment: 'node',
      // Database tests MUST run serially to avoid conflicts
      pool: 'forks',
      poolOptions: {
        forks: {
          singleFork: true,
        },
      },
      // Database test timeout: 10s per test, 60s for setup/teardown (FR-053)
      testTimeout: 10000,
      hookTimeout: 60000,
      globalSetup: ['./packages/test-utils/src/setup/global-setup.ts'],
      setupFiles: ['reflect-metadata'],
      // Run tests sequentially - CRITICAL for database isolation
      sequence: {
        concurrent: false,
      },
    },
  },
]);
