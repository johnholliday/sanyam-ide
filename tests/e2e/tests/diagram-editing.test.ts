/**
 * E2E Test: Diagram Editing Workflow
 *
 * Migrated from the legacy WebdriverIO `tests/e2e/diagram-editing.spec.ts`
 * to Playwright.  Covers opening the diagram view, interacting with nodes,
 * edges, selection, deletion, zoom, and layout operations.
 */

import { test, expect } from '../fixtures/sanyam-fixture';

test.describe('Diagram Editing', () => {

    test.beforeEach(async ({ sanyamApp, compositeEditor }) => {
        await sanyamApp.openFile('test.ecml');
        await compositeEditor.waitForVisible();
        await compositeEditor.switchToDiagramTab();
        await compositeEditor.waitForDiagramLoaded();
    });

    /* -------------------------------------------------------------- */
    /*  Diagram loading                                                */
    /* -------------------------------------------------------------- */

    test('should render diagram with initial nodes', async ({ diagram }) => {
        await diagram.waitForReady();
        const count = await diagram.getNodeCount();
        expect(count).toBeGreaterThanOrEqual(1);
    });

    test('should show node with correct label', async ({ diagram }) => {
        // test.ecml has Actor Admin "Administrator" ...
        const adminNode = diagram.getNodeByLabel('Admin');
        await expect(adminNode).toBeVisible({ timeout: 10_000 });
    });

    /* -------------------------------------------------------------- */
    /*  Node selection                                                  */
    /* -------------------------------------------------------------- */

    test('should select a node on click', async ({ diagram }) => {
        await diagram.selectNode('Admin');

        // Wait for selection to take effect
        await diagram.page.waitForTimeout(500);

        // In GLSP/Sprotty, selection may be indicated by:
        // - A `selected` class on the node or a parent <g> group
        // - Selection handle elements appearing
        // Check broadly for any `selected` class in the SVG
        const selected = diagram.root.locator('.selected').first();
        const handles = diagram.root.locator('[class*="handle"], [class*="resize"]').first();
        const hasSelection = await selected.isVisible().catch(() => false)
            || await handles.isVisible().catch(() => false);
        expect(hasSelection).toBe(true);
    });

    /* -------------------------------------------------------------- */
    /*  Node movement                                                   */
    /* -------------------------------------------------------------- */

    test('should move a node by dragging', async ({ diagram }) => {
        const node = diagram.getNodeByLabel('Admin');
        const initialBox = await node.boundingBox();
        expect(initialBox).not.toBeNull();

        // Drag the node 50px right and 50px down
        await node.dragTo(node, {
            sourcePosition: { x: 10, y: 10 },
            targetPosition: { x: 60, y: 60 },
        });

        // Wait for position update
        await diagram.page.waitForTimeout(500);

        const newBox = await node.boundingBox();
        expect(newBox).not.toBeNull();
        // Position should have changed (allow some tolerance)
        const moved = Math.abs(newBox!.x - initialBox!.x) > 10
            || Math.abs(newBox!.y - initialBox!.y) > 10;
        expect(moved).toBe(true);
    });

    /* -------------------------------------------------------------- */
    /*  Element deletion                                                */
    /* -------------------------------------------------------------- */

    // Delete via keyboard requires a Sprotty KeyListener registered in the DI
    // container that maps Delete → DeleteElementAction.  The current Sprotty DI
    // config (`sprotty-di-config.ts`) does not register such a listener, so the
    // Delete key is a no-op.  Deletion works via the backend API
    // (DiagramLanguageClient.executeOperation with kind:'delete'), but there is
    // no frontend keyboard binding yet.
    test.fixme('should delete a selected element with Delete key', async ({ diagram }) => {
        const initialCount = await diagram.getNodeCount();
        if (initialCount === 0) {
            test.skip();
            return;
        }

        await diagram.selectNode('Admin');
        await diagram.deleteSelected();

        // Wait for deletion to propagate
        await diagram.page.waitForTimeout(1_000);

        const newCount = await diagram.getNodeCount();
        expect(newCount).toBe(initialCount - 1);
    });

    /* -------------------------------------------------------------- */
    /*  Zoom                                                            */
    /* -------------------------------------------------------------- */

    test('should zoom in without errors', async ({ diagram }) => {
        await diagram.zoomIn();
        await diagram.page.waitForTimeout(300);
        // Verify diagram still renders
        await expect(diagram.root).toBeVisible();
    });

    test('should zoom out without errors', async ({ diagram }) => {
        await diagram.zoomOut();
        await diagram.page.waitForTimeout(300);
        await expect(diagram.root).toBeVisible();
    });

    test('should fit diagram to viewport', async ({ diagram }) => {
        await diagram.fitToViewport();
        await diagram.page.waitForTimeout(300);
        await expect(diagram.root).toBeVisible();
    });
});
