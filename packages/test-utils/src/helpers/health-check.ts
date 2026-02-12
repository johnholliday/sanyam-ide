/**
 * Health check utilities for integration test readiness detection.
 *
 * Provides polling-based health check to wait for the gateway to be ready.
 */

/**
 * Options for health check polling.
 */
export interface WaitForHealthyOptions {
  /** Maximum wait time in ms (default: 30000) */
  timeout?: number;
  /** Initial polling interval in ms (default: 100) */
  initialInterval?: number;
  /** Maximum polling interval in ms (default: 2000) */
  maxInterval?: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;
}

/**
 * Health endpoint response shape.
 */
export interface HealthResponse {
  /** Overall status */
  status: 'ok';
  /** Supabase connectivity */
  supabase: boolean;
  /** Auth provider availability */
  auth: boolean;
  /** Gateway version */
  version: string;
}

/**
 * Polls /health endpoint until gateway is ready.
 *
 * Uses exponential backoff to avoid overwhelming the server during startup.
 *
 * @param baseUrl - Gateway base URL (default: http://127.0.0.1:54321)
 * @param options - Polling configuration
 * @returns Promise that resolves when healthy or rejects on timeout
 *
 * @example
 * ```typescript
 * // In global setup
 * await waitForHealthy('http://localhost:3000', { timeout: 60000 });
 * ```
 */
export async function waitForHealthy(
  baseUrl = 'http://127.0.0.1:54321',
  options: WaitForHealthyOptions = {}
): Promise<HealthResponse> {
  const {
    timeout = 30000,
    initialInterval = 100,
    maxInterval = 2000,
    backoffMultiplier = 2,
  } = options;

  const healthUrl = `${baseUrl}/health`;
  const startTime = Date.now();
  let interval = initialInterval;
  let lastError: Error | null = null;

  while (Date.now() - startTime < timeout) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = (await response.json()) as HealthResponse;
        if (data.status === 'ok') {
          return data;
        }
      }

      lastError = new Error(`Health check returned non-ok status: ${response.status}`);
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error('Unknown error during health check');
    }

    // Wait before next attempt with exponential backoff
    await sleep(interval);
    interval = Math.min(interval * backoffMultiplier, maxInterval);
  }

  throw new Error(
    `Health check timed out after ${timeout}ms. Last error: ${lastError?.message ?? 'Unknown'}`
  );
}

/**
 * Simple sleep helper.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
