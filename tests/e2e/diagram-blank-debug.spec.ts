/**
 * E2E test for diagram rendering.
 *
 * Opens the Theia IDE, navigates to an .ecml file in the file explorer,
 * switches to the Diagram tab, and verifies the diagram renders correctly.
 *
 * Run with:
 *   npx playwright test tests/e2e/diagram-blank-debug.spec.ts
 */

import { test, expect } from '@playwright/test';

const IDE_URL = 'http://localhost:3002';
const ECML_FILENAME = 'basic-actor.ecml';

test.describe('Diagram rendering', () => {
    test('renders nodes after opening .ecml file and switching to Diagram tab', async ({ page }) => {
        test.setTimeout(90_000);

        // Collect console logs for diagnostics on failure
        const consoleLogs: string[] = [];
        page.on('console', (msg) => {
            consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
        });
        page.on('pageerror', (err) => {
            consoleLogs.push(`[PAGE_ERROR] ${err.message}\n${err.stack}`);
        });

        // Navigate to IDE
        await page.goto(IDE_URL, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForSelector('#theia-app-shell', { timeout: 15000 });

        // Wait for app to be ready
        await page.waitForFunction(() => {
            return document.body.classList.contains('theia-ApplicationShell') ||
                   document.querySelector('.theia-ApplicationShell') !== null;
        }, { timeout: 10000 });
        await page.waitForTimeout(2000);

        // Open the .ecml file via the file explorer tree
        const explorerIcon = await page.$('[id="shell-tab-explorer-view-container"]');
        if (explorerIcon) {
            await explorerIcon.click();
            await page.waitForTimeout(500);
        }

        // Expand tree items and find the file
        const expandAndFind = async (): Promise<boolean> => {
            const treeNodes = await page.$$('.theia-TreeNodeContent');
            for (const node of treeNodes) {
                const text = await node.textContent();
                if (text && text.includes(ECML_FILENAME)) {
                    await node.dblclick();
                    return true;
                }
            }

            // Try expanding directories that might contain .ecml files
            for (const node of treeNodes) {
                const text = await node.textContent();
                if (text && (text.includes('ecml') || text.includes('workspace'))) {
                    await node.click();
                    await page.waitForTimeout(500);
                }
            }

            // Search again after expanding
            const updatedNodes = await page.$$('.theia-TreeNodeContent');
            for (const node of updatedNodes) {
                const text = await node.textContent();
                if (text && text.includes(ECML_FILENAME)) {
                    await node.dblclick();
                    return true;
                }
            }

            return false;
        };

        let fileOpened = await expandAndFind();

        // If file explorer didn't work, try the quick open dialog
        if (!fileOpened) {
            await page.keyboard.press('Control+p');
            await page.waitForTimeout(500);
            await page.keyboard.type(ECML_FILENAME, { delay: 30 });
            await page.waitForTimeout(1000);
            await page.keyboard.press('Enter');
            await page.waitForTimeout(1000);
            fileOpened = true;
        }

        // Wait for the composite editor to load
        await page.waitForTimeout(3000);

        // Switch to the Diagram tab within the CompositeEditorWidget
        const diagramTab = page.locator('.lm-TabBar-tabLabel, .p-TabBar-tabLabel').filter({ hasText: /Diagram|diagram/i });
        const tabCount = await diagramTab.count();

        if (tabCount > 0) {
            await diagramTab.last().click();
        } else {
            const tabElements = page.locator('.lm-TabBar-tab, .p-TabBar-tab').filter({ hasText: /Diagram|diagram/i });
            const tabElCount = await tabElements.count();
            if (tabElCount > 0) {
                await tabElements.last().click();
            }
        }

        // Wait for diagram nodes to appear in the DOM (poll for up to 30 seconds)
        let nodesFound = false;
        for (let i = 0; i < 60; i++) {
            await page.waitForTimeout(500);
            const nodeCount = await page.evaluate(() => {
                return document.querySelectorAll('.sprotty-node, .sanyam-node, .sanyam-container-node').length;
            });
            if (nodeCount > 0) {
                nodesFound = true;
                break;
            }
        }

        // Wait a bit more for layout to complete and reveal transition
        await page.waitForTimeout(3000);

        // Inspect the diagram DOM state
        const domState = await page.evaluate(() => {
            const result: Record<string, unknown> = {};

            const widget = document.querySelector('.sanyam-diagram-widget');
            result.hasWidget = !!widget;

            const svgContainer = document.querySelector('.sanyam-diagram-svg-container');
            result.hasSvgContainer = !!svgContainer;
            if (svgContainer) {
                result.svgContainerClasses = svgContainer.className;
                result.svgContainerDimensions = `${svgContainer.clientWidth}x${svgContainer.clientHeight}`;
                result.hasLayoutPending = svgContainer.classList.contains('layout-pending');
            }

            const svg = svgContainer?.querySelector('svg');
            result.hasSvg = !!svg;

            result.sprottyNodeCount = document.querySelectorAll('.sprotty-node').length;
            result.containerNodeCount = document.querySelectorAll('.sanyam-container-node').length;
            result.sanyamNodeCount = document.querySelectorAll('.sanyam-node').length;

            const typedElements = document.querySelectorAll('[data-element-type]');
            result.typedElementCount = typedElements.length;
            const types: string[] = [];
            typedElements.forEach(el => {
                types.push(`${el.getAttribute('data-element-type')}#${el.id?.substring(0, 16) || 'no-id'}`);
            });
            result.typedElements = types;

            result.hasPlaceholder = !!document.querySelector('.sanyam-diagram-placeholder');

            return result;
        });

        // Log DOM state for debugging
        console.log('\n========== DOM STATE ==========');
        for (const [key, value] of Object.entries(domState)) {
            if (typeof value === 'object' && value !== null) {
                console.log(`  ${key}: ${JSON.stringify(value)}`);
            } else {
                console.log(`  ${key}: ${value}`);
            }
        }

        // Log relevant console messages on failure
        if (!nodesFound) {
            console.log('\n========== PAGE ERRORS ==========');
            const errors = consoleLogs.filter(l => l.includes('PAGE_ERROR') || l.includes('error') || l.includes('Error'));
            for (const log of errors.slice(-30)) {
                console.log(`  ${log}`);
            }
            console.log('\n========== LAST 50 CONSOLE LOGS ==========');
            for (const log of consoleLogs.slice(-50)) {
                console.log(`  ${log}`);
            }
        }

        // Assertions
        expect(domState.hasSvgContainer, 'SVG container must exist').toBe(true);
        expect(domState.hasSvg, 'SVG element must exist').toBe(true);
        expect(domState.hasLayoutPending, 'layout-pending must be removed').toBe(false);

        // The main assertion: diagram must have rendered nodes
        const totalNodes = (domState.sprottyNodeCount as number) + (domState.sanyamNodeCount as number);
        expect(totalNodes, 'Must have rendered diagram nodes (sprotty-node or sanyam-node)').toBeGreaterThan(0);
    });
});
