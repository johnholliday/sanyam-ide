/**
 * Vitest Base Configuration
 *
 * Shared configuration for all test projects in the Sanyam IDE monorepo.
 * Individual projects in vitest.workspace.ts extend this configuration.
 *
 * @see https://vitest.dev/config/
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Reporter configuration
    reporters: ['default'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json'],
      reportsDirectory: './coverage',
      include: [
        'packages/test-utils/src/**/*.ts',
        'packages/document-store/src/**/*.ts',
        'packages/supabase-auth/src/**/*.ts',
        'packages/licensing/src/**/*.ts',
        'packages/language-server/src/http/**/*.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.integration.test.ts',
        '**/index.ts',
        '**/types.ts',
        '**/*.d.ts',
        '**/node_modules/**',
        '**/lib/**',
      ],
    },

    // Global test utilities
    globals: false,

    // Snapshot settings
    snapshotFormat: {
      escapeString: true,
      printBasicPrototype: true,
    },

    // Pool configuration defaults
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        isolate: true,
      },
    },

    // Retry on CI
    retry: process.env.CI ? 2 : 0,

    // Timeouts
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
