/**
 * Billing Webhook Schemas
 *
 * Zod validation schemas for billing webhook endpoints.
 *
 * @packageDocumentation
 */

import { z } from 'zod';

/**
 * Subscription tier values.
 */
export const SUBSCRIPTION_TIERS = ['free', 'pro', 'enterprise'] as const;

/**
 * Subscription tier type.
 */
export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[number];

/**
 * Billing event types from payment provider.
 */
export const BILLING_EVENT_TYPES = [
  'subscription.created',
  'subscription.updated',
  'subscription.deleted',
  'subscription.trial_ended',
  'invoice.paid',
  'invoice.payment_failed',
  'customer.subscription.paused',
  'customer.subscription.resumed',
] as const;

/**
 * Billing event type.
 */
export type BillingEventType = (typeof BILLING_EVENT_TYPES)[number];

/**
 * Stripe-like webhook event schema.
 */
export const billingWebhookEventSchema = z.object({
  /** Event ID */
  id: z.string(),
  /** Event type */
  type: z.enum(BILLING_EVENT_TYPES),
  /** API version */
  api_version: z.string().optional(),
  /** Event timestamp */
  created: z.number(),
  /** Event data */
  data: z.object({
    object: z.object({
      /** Customer ID (maps to Supabase user) */
      customer: z.string(),
      /** Subscription ID */
      id: z.string().optional(),
      /** Current subscription status */
      status: z.string().optional(),
      /** Plan/product metadata */
      metadata: z
        .object({
          tier: z.enum(SUBSCRIPTION_TIERS).optional(),
          supabase_user_id: z.string().uuid().optional(),
        })
        .passthrough()
        .optional(),
      /** Items in subscription */
      items: z
        .object({
          data: z
            .array(
              z.object({
                price: z.object({
                  product: z.string().optional(),
                  metadata: z
                    .object({
                      tier: z.enum(SUBSCRIPTION_TIERS).optional(),
                    })
                    .passthrough()
                    .optional(),
                }).passthrough(),
              }).passthrough()
            )
            .optional(),
        })
        .optional(),
    }).passthrough(),
  }),
  /** Whether this is a live (vs test) event */
  livemode: z.boolean().optional(),
});

/**
 * Tier change request schema (manual tier changes).
 */
export const tierChangeRequestSchema = z.object({
  /** User ID to update */
  userId: z.string().uuid(),
  /** New tier */
  newTier: z.enum(SUBSCRIPTION_TIERS),
  /** Reason for change */
  reason: z.string().max(500).optional(),
  /** Whether to apply degradation policies immediately */
  applyDegradationPolicies: z.boolean().default(true),
});

/**
 * Types for validated requests.
 */
export type BillingWebhookEvent = z.infer<typeof billingWebhookEventSchema>;
export type TierChangeRequest = z.infer<typeof tierChangeRequestSchema>;
