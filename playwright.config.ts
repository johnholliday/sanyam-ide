import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Sanyam IDE E2E tests.
 *
 * Targets the browser app at localhost:3002. The `webServer` block
 * starts the app automatically when running tests.
 */
export default defineConfig({
    testDir: './tests/e2e/tests',
    fullyParallel: false, // Theia tests share a single app instance
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: 1, // Serial execution — single Theia instance
    reporter: [
        ['html', { outputFolder: './tests/e2e/playwright-report', open: 'never' }],
        ['list'],
    ],
    outputDir: './tests/e2e/test-results',
    timeout: 60_000,
    expect: {
        timeout: 10_000,
    },
    use: {
        baseURL: 'http://localhost:3002',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        actionTimeout: 30_000,
        navigationTimeout: 30_000,
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: 'pnpm start:browser',
        url: 'http://localhost:3002',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: 'pipe',
        stderr: 'pipe',
    },
});
