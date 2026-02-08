/**
 * E2E Test: Palette → Canvas Drop
 *
 * Validates that dragging an element from the sidebar Tools palette
 * onto the diagram canvas creates a new model element that is reflected
 * in both the diagram and text views.
 */

import { test, expect } from '../fixtures/sanyam-fixture';

test.describe('Canvas Drop — Element Palette to Diagram', () => {

    test.beforeEach(async ({ sanyamApp }) => {
        // Open the test ECML file (triggers the composite editor)
        await sanyamApp.openFile('test.ecml');
    });

    test('should open composite editor with Text and Diagram tabs', async ({ compositeEditor }) => {
        await compositeEditor.waitForVisible();
        const activeTab = await compositeEditor.getActiveTab();
        expect(activeTab).toBe('text');

        // Verify Diagram tab exists (even if not active)
        const diagramTab = compositeEditor.root.locator('.lm-TabBar-tab', { hasText: 'Diagram' });
        await expect(diagramTab).toBeVisible();
    });

    test('should show diagram with initial node when switching to Diagram tab', async ({
        compositeEditor,
        diagram,
    }) => {
        await compositeEditor.waitForVisible();
        await compositeEditor.switchToDiagramTab();
        await compositeEditor.waitForDiagramLoaded();

        // The test.ecml fixture contains one Actor (Admin)
        const nodeCount = await diagram.getNodeCount();
        expect(nodeCount).toBeGreaterThanOrEqual(1);
    });

    test('should display element palette with draggable items', async ({
        sanyamApp,
        palette,
    }) => {
        // Open the Tools sidebar
        await sanyamApp.toggleElementPalette();
        await palette.waitForVisible();

        // Palette should have at least one category with items
        const categories = await palette.getCategoryLabels();
        expect(categories.length).toBeGreaterThan(0);

        const items = await palette.getItemLabels();
        expect(items.length).toBeGreaterThan(0);
    });

    test('should create a new node when dragging palette item onto canvas', async ({
        sanyamApp,
        compositeEditor,
        palette,
        diagram,
    }) => {
        // 1. Switch to Diagram tab and wait for initial model
        await compositeEditor.waitForVisible();
        await compositeEditor.switchToDiagramTab();
        await compositeEditor.waitForDiagramLoaded();

        const initialNodeCount = await diagram.getNodeCount();

        // 2. Open element palette
        await sanyamApp.toggleElementPalette();
        await palette.waitForVisible();

        // 3. Drag "Activity" from palette onto the diagram canvas
        const diagramContainer = compositeEditor.getDiagramContainer();
        const box = await diagramContainer.boundingBox();
        expect(box).not.toBeNull();

        await palette.dragItemTo('Activity', diagramContainer, {
            targetPosition: { x: box!.width / 2, y: box!.height / 2 },
        });

        // 4. Wait for the operation to complete and diagram to update
        await diagram.waitForNodes(initialNodeCount + 1, 15_000);

        // 5. Verify new node appears
        const newNodeCount = await diagram.getNodeCount();
        expect(newNodeCount).toBe(initialNodeCount + 1);
    });

    test('should reflect new element in text editor after canvas drop', async ({
        sanyamApp,
        compositeEditor,
        palette,
        diagram,
    }) => {
        // 1. Switch to Diagram and do the drop
        await compositeEditor.waitForVisible();
        await compositeEditor.switchToDiagramTab();
        await compositeEditor.waitForDiagramLoaded();

        await sanyamApp.toggleElementPalette();
        await palette.waitForVisible();

        const diagramContainer = compositeEditor.getDiagramContainer();
        await palette.dragItemTo('Activity', diagramContainer);

        // Wait for diagram to reflect the change
        await compositeEditor.page.waitForTimeout(3_000);

        // 2. Switch to Text tab and verify the keyword appears
        await compositeEditor.switchToTextTab();
        const text = await compositeEditor.getTextContent();
        expect(text).toContain('Activity');
    });
});
