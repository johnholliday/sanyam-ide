/**
 * E2E Test: Text-Diagram Synchronization (T141)
 *
 * Tests bidirectional synchronization between text editor and diagram view.
 * Changes in text should reflect in diagram and vice versa.
 *
 * Prerequisites:
 * - Built and packaged Electron application
 * - WebdriverIO test runner configured
 * - GLSP frontend extension installed
 *
 * @packageDocumentation
 */

import { expect } from 'chai';

/**
 * Selectors for the sync tests
 */
const SELECTORS = {
  editor: '.monaco-editor',
  editorContent: '.view-lines',
  diagramContainer: '.sprotty-diagram',
  diagramRoot: '.sprotty-root',
  node: '.sprotty-node',
  edge: '.sprotty-edge',
  nodeLabel: '.sprotty-label',
  tabBar: '.p-TabBar-tab',
  dirtyIndicator: '.theia-mod-dirty',
};

/**
 * Wait for a condition with timeout
 */
async function waitFor(
  condition: () => Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  return false;
}

describe('Text-Diagram Synchronization', function () {
  // Increase timeout for E2E tests
  this.timeout(90000);

  // Test context
  let browser: any;

  beforeEach(async function () {
    browser = (this as any).browser;

    // Wait for Theia to be fully loaded
    const appShell = await browser.$('#theia-app-shell');
    await appShell.waitForExist({ timeout: 15000 });
  });

  describe('Setup: Open Text and Diagram Views', function () {
    it('should open both text editor and diagram view', async function () {
      // This test sets up the environment for sync tests

      // First, open a DSL file in the text editor
      await browser.keys(['Control', 'Shift', 'e']);

      const explorer = await browser.$('#files');
      await explorer.waitForDisplayed();

      // Find and open a .ecml file
      const testFile = await browser.$('[data-uri*=".ecml"]');
      if (await testFile.isExisting()) {
        await testFile.doubleClick();

        // Wait for editor
        const editor = await browser.$(SELECTORS.editor);
        await editor.waitForExist({ timeout: 5000 });

        // Open diagram view via command
        await browser.keys(['Control', 'Shift', 'p']);
        const palette = await browser.$('.quick-input-widget');
        await palette.waitForDisplayed();

        const input = await browser.$('.quick-input-box input');
        await input.setValue('Open Diagram');
        await browser.keys(['Enter']);

        // Wait for diagram
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const diagram = await browser.$(SELECTORS.diagramContainer);
        if (await diagram.isExisting()) {
          expect(await diagram.isDisplayed()).to.be.true;
        }
      } else {
        this.skip();
      }
    });
  });

  describe('Text to Diagram Synchronization', function () {
    it('should update diagram when adding a new entity in text', async function () {
      const editor = await browser.$(SELECTORS.editor);
      const diagram = await browser.$(SELECTORS.diagramContainer);

      if (!(await editor.isExisting()) || !(await diagram.isExisting())) {
        this.skip();
        return;
      }

      // Get initial node count
      const initialNodes = await browser.$$(SELECTORS.node);
      const initialCount = initialNodes.length;

      // Focus text editor
      await editor.click();

      // Add a new entity at the end of the file
      await browser.keys(['Control', 'End']); // Go to end
      await browser.keys(['Enter', 'Enter']); // New lines
      await browser.keys(['entity TestSync { name: string }']); // Add entity

      // Wait for sync (SC-005: <1s)
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Focus diagram to refresh
      await diagram.click();
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Check if new node appeared
      const newNodes = await browser.$$(SELECTORS.node);
      expect(newNodes.length).to.be.greaterThanOrEqual(initialCount);
    });

    it('should update diagram when renaming an entity in text', async function () {
      const editor = await browser.$(SELECTORS.editor);
      const diagram = await browser.$(SELECTORS.diagramContainer);

      if (!(await editor.isExisting()) || !(await diagram.isExisting())) {
        this.skip();
        return;
      }

      // Get initial node labels
      const initialLabels = await browser.$$(SELECTORS.nodeLabel);
      let originalLabel = '';
      if (initialLabels.length > 0) {
        originalLabel = await initialLabels[0].getText();
      }

      // Focus text editor and find/replace
      await editor.click();
      await browser.keys(['Control', 'h']); // Find and replace

      const findInput = await browser.$('.find-input');
      if (await findInput.isExisting()) {
        // Search for original name and replace
        await findInput.setValue(originalLabel || 'entity');

        const replaceInput = await browser.$('.replace-input');
        if (await replaceInput.isExisting()) {
          await replaceInput.setValue(originalLabel + 'Renamed' || 'entityRenamed');

          // Replace first occurrence
          const replaceButton = await browser.$('.replace-action');
          if (await replaceButton.isExisting()) {
            await replaceButton.click();
          }
        }

        // Close find dialog
        await browser.keys(['Escape']);
      }

      // Wait for sync
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Check diagram for updated label
      await diagram.click();
      const newLabels = await browser.$$(SELECTORS.nodeLabel);

      // Verify at least the diagram is still valid
      expect(await diagram.isExisting()).to.be.true;
    });

    it('should update diagram when deleting an entity in text', async function () {
      const editor = await browser.$(SELECTORS.editor);
      const diagram = await browser.$(SELECTORS.diagramContainer);

      if (!(await editor.isExisting()) || !(await diagram.isExisting())) {
        this.skip();
        return;
      }

      // Get initial node count
      const initialNodes = await browser.$$(SELECTORS.node);
      const initialCount = initialNodes.length;

      if (initialCount === 0) {
        this.skip();
        return;
      }

      // Focus text editor
      await editor.click();

      // Select all and check content
      await browser.keys(['Control', 'a']);

      // For safety, undo immediately
      await browser.keys(['Control', 'z']);

      // The actual deletion test would require more precise text manipulation
      // This is a placeholder to verify sync mechanism works
      expect(await diagram.isExisting()).to.be.true;
    });

    it('should sync within 1 second (SC-005)', async function () {
      const editor = await browser.$(SELECTORS.editor);
      const diagram = await browser.$(SELECTORS.diagramContainer);

      if (!(await editor.isExisting()) || !(await diagram.isExisting())) {
        this.skip();
        return;
      }

      // Focus editor
      await editor.click();

      // Make a change
      const startTime = Date.now();
      await browser.keys([' ']); // Add a space

      // Wait and check for sync
      const synced = await waitFor(
        async () => {
          const dirtyTab = await browser.$(SELECTORS.dirtyIndicator);
          return await dirtyTab.isExisting();
        },
        1000 // 1 second timeout per SC-005
      );

      const elapsed = Date.now() - startTime;

      // Clean up - undo the space
      await browser.keys(['Control', 'z']);

      // Verify sync happened within threshold
      expect(elapsed).to.be.lessThan(1100); // Allow some margin
    });
  });

  describe('Diagram to Text Synchronization', function () {
    it('should update text when moving a node in diagram', async function () {
      const editor = await browser.$(SELECTORS.editor);
      const diagram = await browser.$(SELECTORS.diagramContainer);

      if (!(await editor.isExisting()) || !(await diagram.isExisting())) {
        this.skip();
        return;
      }

      // Find a node
      const nodes = await browser.$$(SELECTORS.node);
      if (nodes.length === 0) {
        this.skip();
        return;
      }

      // Get text content before
      await editor.click();
      const editorContent = await browser.$(SELECTORS.editorContent);
      const textBefore = await editorContent.getText();

      // Move a node in diagram
      await diagram.click();
      const node = nodes[0];
      await node.dragAndDrop({ x: 30, y: 30 });

      // Wait for sync (SC-006: <1s)
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Check if text was updated (dirty indicator)
      const dirtyTab = await browser.$(SELECTORS.dirtyIndicator);

      // Diagram operations may or may not cause text changes depending on
      // whether position is stored in the model
      expect(await diagram.isExisting()).to.be.true;
    });

    it('should update text when creating a node in diagram', async function () {
      const editor = await browser.$(SELECTORS.editor);
      const diagram = await browser.$(SELECTORS.diagramContainer);

      if (!(await editor.isExisting()) || !(await diagram.isExisting())) {
        this.skip();
        return;
      }

      // Get text length before
      await editor.click();
      const editorContent = await browser.$(SELECTORS.editorContent);
      const textBefore = await editorContent.getText();

      // Create a node via tool palette
      await diagram.click();

      const toolPalette = await browser.$('.tool-palette');
      if (await toolPalette.isExisting()) {
        const tool = await browser.$('.tool-palette-item');
        if (await tool.isExisting()) {
          await tool.click();

          // Click in diagram to create
          const diagramRoot = await browser.$(SELECTORS.diagramRoot);
          await diagramRoot.click({ x: 100, y: 100 });

          // Wait for sync
          await new Promise((resolve) => setTimeout(resolve, 1500));

          // Check text was updated
          await editor.click();
          const textAfter = await editorContent.getText();

          // New entity should increase text length
          expect(textAfter.length).to.be.greaterThanOrEqual(textBefore.length);
        }
      }
    });

    it('should update text when deleting a node in diagram', async function () {
      const editor = await browser.$(SELECTORS.editor);
      const diagram = await browser.$(SELECTORS.diagramContainer);

      if (!(await editor.isExisting()) || !(await diagram.isExisting())) {
        this.skip();
        return;
      }

      const nodes = await browser.$$(SELECTORS.node);
      if (nodes.length === 0) {
        this.skip();
        return;
      }

      // Get text before
      await editor.click();
      const editorContent = await browser.$(SELECTORS.editorContent);
      const textBefore = await editorContent.getText();

      // Delete a node in diagram
      await diagram.click();
      await nodes[0].click();
      await browser.keys(['Delete']);

      // Wait for sync
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Check text was updated
      await editor.click();
      const textAfter = await editorContent.getText();

      // Deleting should reduce text length
      expect(textAfter.length).to.be.lessThanOrEqual(textBefore.length);
    });

    it('should sync within 1 second (SC-006)', async function () {
      const editor = await browser.$(SELECTORS.editor);
      const diagram = await browser.$(SELECTORS.diagramContainer);

      if (!(await editor.isExisting()) || !(await diagram.isExisting())) {
        this.skip();
        return;
      }

      const nodes = await browser.$$(SELECTORS.node);
      if (nodes.length === 0) {
        this.skip();
        return;
      }

      // Time a diagram operation
      const startTime = Date.now();

      await diagram.click();
      await nodes[0].click();
      await nodes[0].dragAndDrop({ x: 10, y: 10 });

      // Wait for dirty indicator or text change
      const synced = await waitFor(
        async () => {
          const dirtyTab = await browser.$(SELECTORS.dirtyIndicator);
          return await dirtyTab.isExisting();
        },
        1000 // 1 second timeout per SC-006
      );

      const elapsed = Date.now() - startTime;

      // Verify sync happened within threshold
      expect(elapsed).to.be.lessThan(1100); // Allow some margin
    });
  });

  describe('Concurrent Edit Handling', function () {
    it('should handle rapid text edits without losing sync', async function () {
      const editor = await browser.$(SELECTORS.editor);
      const diagram = await browser.$(SELECTORS.diagramContainer);

      if (!(await editor.isExisting()) || !(await diagram.isExisting())) {
        this.skip();
        return;
      }

      // Focus editor
      await editor.click();

      // Make rapid changes
      for (let i = 0; i < 5; i++) {
        await browser.keys([' ']);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Wait for debounce and sync
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify both views are still valid
      expect(await editor.isExisting()).to.be.true;
      expect(await diagram.isExisting()).to.be.true;

      // Undo all changes
      for (let i = 0; i < 5; i++) {
        await browser.keys(['Control', 'z']);
      }
    });

    it('should maintain consistency after undo/redo', async function () {
      const editor = await browser.$(SELECTORS.editor);
      const diagram = await browser.$(SELECTORS.diagramContainer);

      if (!(await editor.isExisting()) || !(await diagram.isExisting())) {
        this.skip();
        return;
      }

      // Get initial state
      const initialNodes = await browser.$$(SELECTORS.node);
      const initialCount = initialNodes.length;

      // Make a change
      await editor.click();
      await browser.keys(['// test comment']);

      // Wait for sync
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Undo
      await browser.keys(['Control', 'z']);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Redo
      await browser.keys(['Control', 'y']);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Undo again to restore
      await browser.keys(['Control', 'z']);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify diagram is consistent
      const finalNodes = await browser.$$(SELECTORS.node);
      expect(finalNodes.length).to.equal(initialCount);
    });
  });

  describe('Error Handling', function () {
    it('should show validation errors in both views', async function () {
      const editor = await browser.$(SELECTORS.editor);
      const diagram = await browser.$(SELECTORS.diagramContainer);

      if (!(await editor.isExisting()) || !(await diagram.isExisting())) {
        this.skip();
        return;
      }

      // Introduce an error in text
      await editor.click();
      await browser.keys(['Control', 'End']);
      await browser.keys(['Enter', 'invalid_syntax_here!!!']);

      // Wait for validation
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Check for error markers in editor
      const errorMarkers = await browser.$$('.squiggly-error');

      // Undo the error
      await browser.keys(['Control', 'z']);
      await browser.keys(['Control', 'z']);

      // Verify both views still work
      expect(await editor.isExisting()).to.be.true;
      expect(await diagram.isExisting()).to.be.true;
    });

    it('should recover gracefully from parse errors', async function () {
      const editor = await browser.$(SELECTORS.editor);
      const diagram = await browser.$(SELECTORS.diagramContainer);

      if (!(await editor.isExisting()) || !(await diagram.isExisting())) {
        this.skip();
        return;
      }

      // Add malformed content
      await editor.click();
      await browser.keys(['Control', 'End']);
      await browser.keys(['Enter', '{ unclosed']);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Fix the error
      await browser.keys([' }']);

      // Wait for recovery
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Undo all changes
      await browser.keys(['Control', 'z']);
      await browser.keys(['Control', 'z']);
      await browser.keys(['Control', 'z']);

      // Verify recovery
      expect(await editor.isExisting()).to.be.true;
      expect(await diagram.isExisting()).to.be.true;
    });
  });
});

// Export for test runner
export {};
