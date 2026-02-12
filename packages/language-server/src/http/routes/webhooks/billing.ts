/**
 * Billing Webhook Routes
 *
 * Webhook endpoints for payment provider (Stripe) integration.
 *
 * @packageDocumentation
 */

import { Hono } from 'hono';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '@sanyam/logger';
import type { HonoEnv } from '../../types.js';
import { ApiErrors } from '../../middleware/error-handler.js';
import {
  billingWebhookEventSchema,
  type BillingWebhookEvent,
  type SubscriptionTier,
} from './billing.schemas.js';

const logger = createLogger({ name: 'BillingWebhook' });

/**
 * Dependencies for billing webhook routes.
 */
export interface BillingWebhookDependencies {
  /** Function to create admin Supabase client */
  createAdminClient: () => SupabaseClient;
  /** Stripe webhook signing secret */
  webhookSecret?: string;
  /** Tier degradation handler */
  onTierChange?: (
    userId: string,
    oldTier: SubscriptionTier,
    newTier: SubscriptionTier
  ) => Promise<void>;
}

/**
 * Tier hierarchy for determining degradation.
 */
const TIER_HIERARCHY: Record<SubscriptionTier, number> = {
  free: 0,
  pro: 1,
  enterprise: 2,
};

/**
 * Verify Stripe webhook signature.
 *
 * @param payload - Raw request body
 * @param signature - Stripe-Signature header value
 * @param secret - Webhook signing secret
 * @returns Whether signature is valid
 */
function verifyStripeSignature(
  _payload: string,
  _signature: string,
  _secret: string
): boolean {
  // TODO: Implement proper Stripe signature verification
  // This requires the stripe package:
  // import Stripe from 'stripe';
  // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  // const event = stripe.webhooks.constructEvent(payload, signature, secret);

  logger.warn('Stripe signature verification not implemented - accepting all webhooks');
  return true;
}

/**
 * Extract tier from billing event.
 */
function extractTierFromEvent(event: BillingWebhookEvent): SubscriptionTier | undefined {
  // Try metadata first
  if (event.data.object.metadata?.tier) {
    return event.data.object.metadata.tier;
  }

  // Try subscription items
  const items = event.data.object.items?.data;
  if (items && items.length > 0) {
    const tier = items[0]?.price?.metadata?.tier;
    if (tier) {
      return tier;
    }
  }

  return undefined;
}

/**
 * Extract user ID from billing event.
 */
function extractUserIdFromEvent(event: BillingWebhookEvent): string | undefined {
  // Try metadata first
  if (event.data.object.metadata?.supabase_user_id) {
    return event.data.object.metadata.supabase_user_id;
  }

  // Would normally look up by customer ID in a customer mapping table
  return undefined;
}

/**
 * Create billing webhook routes.
 *
 * @param deps - Route dependencies
 * @returns Hono app with billing webhook routes
 */
export function createBillingWebhookRoutes(deps: BillingWebhookDependencies): Hono<HonoEnv> {
  const app = new Hono<HonoEnv>();

  /**
   * POST /webhooks/billing - Handle Stripe webhook events
   */
  app.post('/', async (c) => {
    // Get raw body for signature verification
    const rawBody = await c.req.text();

    // Verify signature if webhook secret is configured
    if (deps.webhookSecret) {
      const signature = c.req.header('Stripe-Signature');
      if (!signature) {
        logger.warn('Missing Stripe-Signature header');
        return ApiErrors.unauthorized('Missing signature');
      }

      if (!verifyStripeSignature(rawBody, signature, deps.webhookSecret)) {
        logger.warn('Invalid Stripe webhook signature');
        return ApiErrors.unauthorized('Invalid signature');
      }
    }

    // Parse and validate event
    let event: BillingWebhookEvent;
    try {
      const parsed = JSON.parse(rawBody);
      const result = billingWebhookEventSchema.safeParse(parsed);

      if (!result.success) {
        logger.warn({ errors: result.error.errors }, 'Invalid webhook payload');
        return ApiErrors.validationError('Invalid webhook payload');
      }

      event = result.data;
    } catch (err) {
      logger.warn({ err }, 'Failed to parse webhook payload');
      return ApiErrors.validationError('Invalid JSON payload');
    }

    logger.info({ eventId: event.id, type: event.type }, 'Processing billing webhook');

    try {
      const client = deps.createAdminClient();

      switch (event.type) {
        case 'subscription.created':
        case 'subscription.updated': {
          const userId = extractUserIdFromEvent(event);
          const newTier = extractTierFromEvent(event);

          if (!userId) {
            logger.warn({ eventId: event.id }, 'Could not extract user ID from event');
            return c.json({ received: true, warning: 'User ID not found' });
          }

          if (!newTier) {
            logger.warn({ eventId: event.id }, 'Could not extract tier from event');
            return c.json({ received: true, warning: 'Tier not found' });
          }

          // Get current tier
          const { data: profile, error: profileError } = await client
            .from('user_profiles')
            .select('subscription_tier')
            .eq('id', userId)
            .single();

          if (profileError) {
            logger.error({ err: profileError, userId }, 'Failed to get user profile');
            return ApiErrors.internal('Failed to get user profile');
          }

          const oldTier = (profile?.subscription_tier as SubscriptionTier) ?? 'free';

          // Update tier
          const { error: updateError } = await client
            .from('user_profiles')
            .update({
              subscription_tier: newTier,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);

          if (updateError) {
            logger.error({ err: updateError, userId }, 'Failed to update user tier');
            return ApiErrors.internal('Failed to update tier');
          }

          logger.info({ userId, oldTier, newTier }, 'User tier updated');

          // Apply degradation policies if downgrading
          if (
            deps.onTierChange &&
            TIER_HIERARCHY[newTier] < TIER_HIERARCHY[oldTier]
          ) {
            try {
              await deps.onTierChange(userId, oldTier, newTier);
              logger.info({ userId, oldTier, newTier }, 'Degradation policies applied');
            } catch (err) {
              logger.error({ err, userId }, 'Failed to apply degradation policies');
              // Don't fail the webhook - tier was updated successfully
            }
          }

          return c.json({ received: true, userId, oldTier, newTier });
        }

        case 'subscription.deleted':
        case 'subscription.trial_ended': {
          const userId = extractUserIdFromEvent(event);

          if (!userId) {
            logger.warn({ eventId: event.id }, 'Could not extract user ID from event');
            return c.json({ received: true, warning: 'User ID not found' });
          }

          // Get current tier
          const { data: profile } = await client
            .from('user_profiles')
            .select('subscription_tier')
            .eq('id', userId)
            .single();

          const oldTier = (profile?.subscription_tier as SubscriptionTier) ?? 'free';

          // Downgrade to free
          const { error: updateError } = await client
            .from('user_profiles')
            .update({
              subscription_tier: 'free',
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);

          if (updateError) {
            logger.error({ err: updateError, userId }, 'Failed to downgrade user');
            return ApiErrors.internal('Failed to downgrade user');
          }

          logger.info({ userId, oldTier, newTier: 'free' }, 'User downgraded to free tier');

          // Apply degradation policies
          if (deps.onTierChange && oldTier !== 'free') {
            try {
              await deps.onTierChange(userId, oldTier, 'free');
              logger.info({ userId }, 'Degradation policies applied for downgrade');
            } catch (err) {
              logger.error({ err, userId }, 'Failed to apply degradation policies');
            }
          }

          return c.json({ received: true, userId, downgraded: true });
        }

        case 'invoice.payment_failed': {
          // Log but don't immediately downgrade - Stripe will retry
          logger.warn({ eventId: event.id }, 'Payment failed - awaiting retry');
          return c.json({ received: true, action: 'logged' });
        }

        default:
          // Log unknown event types but acknowledge receipt
          logger.info({ type: event.type }, 'Unhandled billing event type');
          return c.json({ received: true, unhandled: true });
      }
    } catch (err) {
      logger.error({ err, eventId: event.id }, 'Error processing billing webhook');
      return ApiErrors.internal('Failed to process webhook');
    }
  });

  return app;
}

/**
 * Default tier degradation policies.
 */
export async function applyDefaultDegradationPolicies(
  client: SupabaseClient,
  userId: string,
  oldTier: SubscriptionTier,
  newTier: SubscriptionTier
): Promise<void> {
  const logger2 = createLogger({ name: 'TierDegradation' });

  logger2.info({ userId, oldTier, newTier }, 'Applying degradation policies');

  // If downgrading below pro, revoke API keys
  if (TIER_HIERARCHY[oldTier] >= TIER_HIERARCHY['pro'] && TIER_HIERARCHY[newTier] < TIER_HIERARCHY['pro']) {
    const { error } = await client
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('revoked_at', null);

    if (error) {
      logger2.error({ err: error, userId }, 'Failed to revoke API keys');
    } else {
      logger2.info({ userId }, 'API keys revoked due to tier downgrade');
    }
  }

  // If downgrading below pro, remove shares (or convert to read-only)
  if (TIER_HIERARCHY[oldTier] >= TIER_HIERARCHY['pro'] && TIER_HIERARCHY[newTier] < TIER_HIERARCHY['pro']) {
    // Get documents owned by user
    const { data: docs } = await client
      .from('documents')
      .select('id')
      .eq('owner_id', userId);

    if (docs && docs.length > 0) {
      const docIds = docs.map((d) => d.id);

      // Delete all shares for these documents
      const { error } = await client
        .from('document_shares')
        .delete()
        .in('document_id', docIds);

      if (error) {
        logger2.error({ err: error, userId }, 'Failed to remove document shares');
      } else {
        logger2.info({ userId, docCount: docs.length }, 'Document shares removed due to tier downgrade');
      }
    }
  }
}
