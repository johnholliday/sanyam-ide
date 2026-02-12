/**
 * Unit tests for Stripe signature construction
 */

import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import { constructStripeSignature } from '../../../src/helpers/stripe-signature.js';

describe('constructStripeSignature', () => {
  const testSecret = 'whsec_test_secret_key';

  it('should construct valid signature format', () => {
    const payload = JSON.stringify({ type: 'test.event' });
    const signature = constructStripeSignature(payload, testSecret);

    // Should match format: t=timestamp,v1=signature
    expect(signature).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);
  });

  it('should use provided timestamp', () => {
    const payload = JSON.stringify({ type: 'test.event' });
    const timestamp = 1234567890;
    const signature = constructStripeSignature(payload, testSecret, timestamp);

    expect(signature).toContain(`t=${timestamp}`);
  });

  it('should use current time by default', () => {
    const payload = JSON.stringify({ type: 'test.event' });
    const before = Math.floor(Date.now() / 1000);
    const signature = constructStripeSignature(payload, testSecret);
    const after = Math.floor(Date.now() / 1000);

    const match = signature.match(/t=(\d+)/);
    const timestamp = parseInt(match?.[1] ?? '0', 10);

    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it('should produce correct HMAC signature', () => {
    const payload = JSON.stringify({ type: 'checkout.session.completed' });
    const timestamp = 1609459200; // Fixed timestamp for deterministic test
    const signature = constructStripeSignature(payload, testSecret, timestamp);

    // Manually compute expected signature
    const signedPayload = `${timestamp}.${payload}`;
    const expectedSig = createHmac('sha256', testSecret)
      .update(signedPayload)
      .digest('hex');

    expect(signature).toBe(`t=${timestamp},v1=${expectedSig}`);
  });

  it('should produce different signatures for different payloads', () => {
    const timestamp = 1609459200;
    const sig1 = constructStripeSignature('{"type":"event1"}', testSecret, timestamp);
    const sig2 = constructStripeSignature('{"type":"event2"}', testSecret, timestamp);

    expect(sig1).not.toBe(sig2);
  });

  it('should produce different signatures for different secrets', () => {
    const payload = JSON.stringify({ type: 'test.event' });
    const timestamp = 1609459200;
    const sig1 = constructStripeSignature(payload, 'secret1', timestamp);
    const sig2 = constructStripeSignature(payload, 'secret2', timestamp);

    expect(sig1).not.toBe(sig2);
  });

  it('should produce different signatures for different timestamps', () => {
    const payload = JSON.stringify({ type: 'test.event' });
    const sig1 = constructStripeSignature(payload, testSecret, 1000);
    const sig2 = constructStripeSignature(payload, testSecret, 2000);

    // Timestamps differ
    expect(sig1.split(',')[0]).not.toBe(sig2.split(',')[0]);
    // Signatures also differ because timestamp is part of signed payload
    expect(sig1.split(',')[1]).not.toBe(sig2.split(',')[1]);
  });

  it('should handle empty payload', () => {
    const signature = constructStripeSignature('', testSecret);

    expect(signature).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);
  });

  it('should handle complex JSON payloads', () => {
    const complexPayload = JSON.stringify({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_123',
          items: [
            { id: 'si_123', price: { id: 'price_123' } },
          ],
          metadata: {
            user_id: 'user_456',
          },
        },
      },
    });

    const signature = constructStripeSignature(complexPayload, testSecret);
    expect(signature).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);
  });
});
