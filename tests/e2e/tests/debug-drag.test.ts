/**
 * Debug: Canvas drop smoke test.
 * This file is used for targeted debugging during development.
 */
import { test, expect } from '../fixtures/sanyam-fixture';

test.describe('Debug: Canvas Drop Smoke', () => {
    test('should confirm canvas drop creates a node', async ({
        sanyamApp,
        compositeEditor,
        palette,
        diagram,
    }) => {
        await sanyamApp.openFile('test.ecml');
        await compositeEditor.waitForVisible();
        await compositeEditor.switchToDiagramTab();
        await compositeEditor.waitForDiagramLoaded();
        await sanyamApp.toggleElementPalette();
        await palette.waitForVisible();

        const initialNodeCount = await diagram.getNodeCount();
        const diagramContainer = compositeEditor.getDiagramContainer();
        await palette.dragItemTo('Activity', diagramContainer);

        // Wait for async chain to complete
        await diagram.waitForNodes(initialNodeCount + 1, 15_000);

        const newCount = await diagram.getNodeCount();
        expect(newCount).toBe(initialNodeCount + 1);
    });
});
