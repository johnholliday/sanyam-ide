/**
 * Stripe webhook signature construction for testing.
 *
 * Creates valid webhook signatures for verifying Stripe webhook handlers.
 */

import { createHmac } from 'crypto';

/**
 * Constructs a valid Stripe webhook signature for testing.
 *
 * @param payload - JSON stringified webhook payload
 * @param secret - Test-only STRIPE_WEBHOOK_SECRET
 * @param timestamp - Unix timestamp (default: current time)
 * @returns Signature header value in Stripe's format
 *
 * @example
 * ```typescript
 * const payload = JSON.stringify({ type: 'checkout.session.completed', data: { ... } });
 * const signature = constructStripeSignature(payload, 'whsec_test_secret');
 *
 * const response = await fetch('/webhooks/stripe', {
 *   method: 'POST',
 *   headers: {
 *     'stripe-signature': signature,
 *     'content-type': 'application/json',
 *   },
 *   body: payload,
 * });
 * ```
 */
export function constructStripeSignature(
  payload: string,
  secret: string,
  timestamp?: number
): string {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);

  // Stripe signs: timestamp + '.' + payload
  const signedPayload = `${ts}.${payload}`;

  // Create HMAC SHA-256 signature
  const signature = createHmac('sha256', secret).update(signedPayload).digest('hex');

  // Return in Stripe's signature format
  return `t=${ts},v1=${signature}`;
}
