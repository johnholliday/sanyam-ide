import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: '.',
    timeout: 60000,
    use: {
        baseURL: 'http://localhost:3002',
        headless: true,
        viewport: { width: 1400, height: 900 },
    },
    reporter: [['list']],
});
