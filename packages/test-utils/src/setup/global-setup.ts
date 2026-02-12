/**
 * Global setup for Vitest integration tests.
 *
 * This file is executed once before all integration tests run.
 * It ensures Supabase is available and ready.
 */

import { waitForHealthy } from '../helpers/health-check.js';

/**
 * Global setup function called by Vitest.
 *
 * @returns Teardown function or void
 */
export default async function globalSetup(): Promise<(() => Promise<void>) | void> {
  const supabaseUrl = process.env['SUPABASE_URL'];

  // Skip setup if Supabase is not configured
  if (!supabaseUrl) {
    console.log(
      '⚠️  SUPABASE_URL not set - skipping integration test setup. ' +
        'Integration tests will be skipped.'
    );
    return;
  }

  console.log('🔄 Waiting for Supabase to be ready...');

  try {
    // Wait for the gateway to be healthy
    const health = await waitForHealthy(supabaseUrl, {
      timeout: 60000, // 60s timeout for CI environments
      initialInterval: 200,
      maxInterval: 2000,
    });

    console.log(`✅ Gateway ready (version: ${health.version})`);
    console.log(`   Supabase: ${health.supabase ? '✓' : '✗'}`);
    console.log(`   Auth: ${health.auth ? '✓' : '✗'}`);

    // Return teardown function
    return async () => {
      console.log('🧹 Global teardown: cleaning up test resources...');
      // Import dynamically to avoid initialization issues
      const { cleanupAllTestUsers } = await import('./test-user.js');
      await cleanupAllTestUsers();
      console.log('✅ Teardown complete');
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Failed to connect to gateway: ${message}`);
    console.error('   Make sure Supabase is running: supabase start');
    throw error;
  }
}
