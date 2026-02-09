import * as fs from 'node:fs';
import * as path from 'node:path';
import { test as base } from '@playwright/test';
import { SanyamApp } from '../page-objects/sanyam-app';
import { CompositeEditor } from '../page-objects/composite-editor';
import { ElementPalette } from '../page-objects/element-palette';
import { SanyamDiagram } from '../page-objects/sanyam-diagram';

/**
 * Absolute path to the test workspace directory.
 * Theia reads this from the URL hash fragment to open it as the workspace root.
 */
const TEST_WORKSPACE_PATH = path.resolve(__dirname, '..', 'workspace');

/**
 * Extended fixture types provided to every test.
 */
export interface SanyamFixtures {
    /** Top-level Sanyam IDE page object. */
    sanyamApp: SanyamApp;
    /** Composite editor page object. */
    compositeEditor: CompositeEditor;
    /** Element palette (Tools sidebar) page object. */
    palette: ElementPalette;
    /** GLSP diagram page object. */
    diagram: SanyamDiagram;
}

/**
 * Custom Playwright `test` with Sanyam IDE fixtures.
 *
 * Every test automatically:
 * 1. Navigates to the Sanyam browser app with the test workspace open
 *    (Theia reads the workspace folder from the URL hash fragment)
 * 2. Waits for the Theia shell to be ready
 * 3. Waits for the file explorer to show the workspace contents
 * 4. Instantiates all page objects
 *
 * Tests that modify files should use `page.reload()` or explicitly
 * revert content in their own `afterEach` hooks.
 */
export const test = base.extend<SanyamFixtures>({

    sanyamApp: async ({ page }, use) => {
        // Save workspace file contents before the test so we can restore them
        // after tests that modify files (e.g., canvas-drop, text-drop).
        const testFile = path.join(TEST_WORKSPACE_PATH, 'test.ecml');
        const originalContent = fs.readFileSync(testFile, 'utf-8');

        // Navigate to the Theia browser app with the test workspace.
        // Theia's WorkspaceService reads `window.location.hash` to determine
        // the workspace root folder (see @theia/workspace workspace-service.ts).
        const workspaceUrl = `/#${encodeURI(TEST_WORKSPACE_PATH)}`;
        await page.goto(workspaceUrl);

        const app = new SanyamApp(page);
        await app.waitForShellReady();
        await app.waitForWorkspaceReady();
        // Wait for the language server extension to fully activate.
        // Each fresh page creates a new frontend → plugin host restart → reactivation.
        await app.waitForBackendReady();
        await use(app);

        // Restore the workspace file to its original content.
        fs.writeFileSync(testFile, originalContent, 'utf-8');
    },

    compositeEditor: async ({ page }, use) => {
        await use(new CompositeEditor(page));
    },

    palette: async ({ page }, use) => {
        await use(new ElementPalette(page));
    },

    diagram: async ({ page }, use) => {
        await use(new SanyamDiagram(page));
    },
});

export { expect } from '@playwright/test';
