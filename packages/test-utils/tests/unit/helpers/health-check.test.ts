/**
 * Unit tests for health check helpers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitForHealthy } from '../../../src/helpers/health-check.js';

describe('waitForHealthy', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should return immediately when healthy', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'ok',
        supabase: true,
        auth: true,
        version: '1.0.0',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const promise = waitForHealthy('http://localhost:3000');
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe('ok');
    expect(result.supabase).toBe(true);
    expect(result.auth).toBe(true);
    expect(result.version).toBe('1.0.0');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount < 3) {
        throw new Error('Connection refused');
      }
      return {
        ok: true,
        json: async () => ({
          status: 'ok',
          supabase: true,
          auth: true,
          version: '1.0.0',
        }),
      };
    });
    vi.stubGlobal('fetch', mockFetch);

    const promise = waitForHealthy('http://localhost:3000', {
      initialInterval: 100,
      timeout: 10000,
    });

    // Run timers to allow retries
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe('ok');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('should timeout after max wait time', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Connection refused'));
    vi.stubGlobal('fetch', mockFetch);

    // Use real timers for this test to properly handle the timeout
    vi.useRealTimers();

    // Use a very short timeout so we can test the timeout behavior
    await expect(
      waitForHealthy('http://localhost:3000', {
        timeout: 100,
        initialInterval: 20,
      })
    ).rejects.toThrow(/timed out/i);

    // Restore fake timers for other tests
    vi.useFakeTimers();
  });

  it('should use default base URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'ok',
        supabase: false,
        auth: false,
        version: '0.0.1',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const promise = waitForHealthy();
    await vi.runAllTimersAsync();
    await promise;

    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:54321/health',
      expect.any(Object)
    );
  });

  it('should handle non-ok response', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount < 2) {
        return { ok: false, status: 503 };
      }
      return {
        ok: true,
        json: async () => ({
          status: 'ok',
          supabase: true,
          auth: true,
          version: '1.0.0',
        }),
      };
    });
    vi.stubGlobal('fetch', mockFetch);

    const promise = waitForHealthy('http://localhost:3000', {
      initialInterval: 100,
      timeout: 10000,
    });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe('ok');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should use exponential backoff', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount < 5) {
        throw new Error('Connection refused');
      }
      return {
        ok: true,
        json: async () => ({
          status: 'ok',
          supabase: true,
          auth: true,
          version: '1.0.0',
        }),
      };
    });
    vi.stubGlobal('fetch', mockFetch);

    const promise = waitForHealthy('http://localhost:3000', {
      timeout: 10000,
      initialInterval: 100,
      maxInterval: 400,
      backoffMultiplier: 2,
    });

    // Run all timers and wait for the promise
    await vi.runAllTimersAsync();
    const result = await promise;

    // Should have made 5 attempts (4 failures + 1 success)
    expect(mockFetch).toHaveBeenCalledTimes(5);
    expect(result.status).toBe('ok');
  });

  it('should handle non-ok status in response body', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount < 2) {
        return {
          ok: true,
          json: async () => ({
            status: 'starting',
            supabase: false,
            auth: false,
            version: '1.0.0',
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          status: 'ok',
          supabase: true,
          auth: true,
          version: '1.0.0',
        }),
      };
    });
    vi.stubGlobal('fetch', mockFetch);

    const promise = waitForHealthy('http://localhost:3000', {
      initialInterval: 100,
      timeout: 10000,
    });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe('ok');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
