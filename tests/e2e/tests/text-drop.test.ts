/**
 * E2E Test: Palette → Text Editor Drop
 *
 * Validates that dragging an element from the sidebar Tools palette
 * onto the Monaco text editor inserts the corresponding DSL text
 * and the diagram view updates accordingly.
 */

import { test, expect } from '../fixtures/sanyam-fixture';

test.describe('Text Drop — Element Palette to Text Editor', () => {

    test.beforeEach(async ({ sanyamApp }) => {
        await sanyamApp.openFile('test.ecml');
    });

    test('should insert element text when dragging palette item onto text editor', async ({
        sanyamApp,
        compositeEditor,
        palette,
    }) => {
        await compositeEditor.waitForVisible();

        // Ensure Text tab is active
        await compositeEditor.switchToTextTab();

        // Open element palette
        await sanyamApp.toggleElementPalette();
        await palette.waitForVisible();

        // Drag "Activity" onto the text editor area
        const textEditor = compositeEditor.getTextEditor();
        await expect(textEditor).toBeVisible();

        await palette.dragItemTo('Activity', textEditor);

        // Wait for the operation to complete
        await compositeEditor.page.waitForTimeout(2_000);

        // Verify Monaco content now includes "Activity"
        const text = await compositeEditor.getTextContent();
        expect(text).toContain('Activity');
    });

    test('should update diagram after text editor drop', async ({
        sanyamApp,
        compositeEditor,
        palette,
        diagram,
    }) => {
        await compositeEditor.waitForVisible();
        await compositeEditor.switchToTextTab();

        // Open palette and drag item onto text
        await sanyamApp.toggleElementPalette();
        await palette.waitForVisible();

        const textEditor = compositeEditor.getTextEditor();
        await palette.dragItemTo('Activity', textEditor);

        // Wait for text edit + auto-save
        await compositeEditor.page.waitForTimeout(3_000);

        // Switch to Diagram and verify the new node appears
        await compositeEditor.switchToDiagramTab();
        await compositeEditor.waitForDiagramLoaded();

        const nodeCount = await diagram.getNodeCount();
        // Original file has 1 Actor; after drop we should have at least 2 elements
        expect(nodeCount).toBeGreaterThanOrEqual(2);
    });

    test('should not insert edge elements on text editor (edges need two endpoints)', async ({
        sanyamApp,
        compositeEditor,
        palette,
    }) => {
        await compositeEditor.waitForVisible();
        await compositeEditor.switchToTextTab();

        const textBefore = await compositeEditor.getTextContent();

        await sanyamApp.toggleElementPalette();
        await palette.waitForVisible();

        // Try to find an edge item — if none exists, skip
        const edgeItem = palette.root.locator('.sanyam-element-palette-item.action-item').first();
        const edgeExists = await edgeItem.isVisible().catch(() => false);
        if (!edgeExists) {
            test.skip();
            return;
        }

        // Attempt to drag it onto the text editor
        const textEditor = compositeEditor.getTextEditor();
        await edgeItem.dragTo(textEditor);

        // Wait and verify no change
        await compositeEditor.page.waitForTimeout(2_000);
        const textAfter = await compositeEditor.getTextContent();
        expect(textAfter).toBe(textBefore);
    });
});
