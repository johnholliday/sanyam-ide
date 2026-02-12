/**
 * Test user management for integration tests.
 *
 * Creates ephemeral users via Supabase auth admin API with cleanup tracking.
 */

import type { SubscriptionTier } from '../types.js';

/**
 * Represents an ephemeral test user with Supabase credentials.
 */
export interface TestUser {
  /** Supabase auth user ID (UUID) */
  readonly id: string;
  /** Email in format {uuid}@test.com */
  readonly email: string;
  /** JWT access token from GoTrue */
  readonly accessToken: string;
  /** Refresh token for session renewal */
  readonly refreshToken: string;
  /** User's subscription tier */
  readonly tier: SubscriptionTier;
}

/**
 * Set of active test users for cleanup tracking.
 */
const activeTestUsers = new Set<string>();

/**
 * Get the Supabase admin client for user management.
 * Lazily loaded to avoid initialization issues.
 */
async function getAdminClient(): Promise<{
  auth: {
    admin: {
      createUser(options: {
        email: string;
        password: string;
        email_confirm: boolean;
        user_metadata: Record<string, unknown>;
      }): Promise<{ data: { user: { id: string } | null }; error: Error | null }>;
      deleteUser(userId: string): Promise<{ error: Error | null }>;
    };
  };
}> {
  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for integration tests'
    );
  }

  const { createClient } = await import('@supabase/supabase-js');
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Get a regular Supabase client for user sign-in.
 */
async function getAnonClient(): Promise<{
  auth: {
    signInWithPassword(credentials: {
      email: string;
      password: string;
    }): Promise<{
      data: {
        session: {
          access_token: string;
          refresh_token: string;
        } | null;
      };
      error: Error | null;
    }>;
  };
}> {
  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseAnonKey = process.env['SUPABASE_ANON_KEY'];

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set for integration tests');
  }

  const { createClient } = await import('@supabase/supabase-js');
  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Creates an ephemeral test user via Supabase auth admin API.
 * User is registered in module-level Set for cleanup tracking.
 *
 * @param tier - Subscription tier (default: 'free')
 * @returns Promise resolving to TestUser with valid credentials
 *
 * @example
 * ```typescript
 * const user = await createTestUser('pro');
 * // Use user.accessToken for authenticated requests
 * // ...
 * await cleanupTestUser(user);
 * ```
 */
export async function createTestUser(tier: SubscriptionTier = 'free'): Promise<TestUser> {
  const adminClient = await getAdminClient();
  const anonClient = await getAnonClient();

  const userId = crypto.randomUUID();
  const email = `${userId}@test.com`;
  const password = `test-password-${userId}`;

  // Create user via admin API
  const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      tier,
      test_user: true,
    },
  });

  if (createError || !createData.user) {
    throw new Error(`Failed to create test user: ${createError?.message ?? 'Unknown error'}`);
  }

  // Sign in to get access token
  const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError || !signInData.session) {
    // Clean up the created user
    await adminClient.auth.admin.deleteUser(createData.user.id);
    throw new Error(`Failed to sign in test user: ${signInError?.message ?? 'Unknown error'}`);
  }

  const testUser: TestUser = {
    id: createData.user.id,
    email,
    accessToken: signInData.session.access_token,
    refreshToken: signInData.session.refresh_token,
    tier,
  };

  // Track for cleanup
  activeTestUsers.add(testUser.id);

  return testUser;
}

/**
 * Deletes a test user and all owned data via foreign key cascade.
 * Removes user from tracking Set.
 *
 * @param user - TestUser to delete
 */
export async function cleanupTestUser(user: TestUser): Promise<void> {
  const adminClient = await getAdminClient();

  const { error } = await adminClient.auth.admin.deleteUser(user.id);

  if (error) {
    console.warn(`Warning: Failed to delete test user ${user.id}: ${error.message}`);
  }

  activeTestUsers.delete(user.id);
}

/**
 * Cleanup all tracked test users (for use in global teardown).
 * @internal
 */
export async function cleanupAllTestUsers(): Promise<void> {
  const adminClient = await getAdminClient();

  const errors: string[] = [];

  for (const userId of activeTestUsers) {
    const { error } = await adminClient.auth.admin.deleteUser(userId);
    if (error) {
      errors.push(`${userId}: ${error.message}`);
    }
  }

  activeTestUsers.clear();

  if (errors.length > 0) {
    console.warn(`Warning: Failed to delete some test users:\n${errors.join('\n')}`);
  }
}

/**
 * Get count of active test users (for debugging).
 * @internal
 */
export function getActiveTestUserCount(): number {
  return activeTestUsers.size;
}
