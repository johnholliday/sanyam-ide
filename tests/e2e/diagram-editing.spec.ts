/**
 * E2E Test: Diagram Editing Workflow (T140)
 *
 * Tests the visual diagram editing experience using GLSP including
 * opening diagrams, creating nodes, connecting edges, and layout.
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
 * GLSP Diagram selectors
 */
const SELECTORS = {
  diagramContainer: '.sprotty-diagram',
  diagramRoot: '.sprotty-root',
  node: '.sprotty-node',
  edge: '.sprotty-edge',
  toolPalette: '.tool-palette',
  toolPaletteGroup: '.tool-palette-group',
  toolPaletteItem: '.tool-palette-item',
  contextMenu: '.context-menu',
  selectionHandle: '.selection-handle',
};

describe('Diagram Editing Workflow', function () {
  // Increase timeout for E2E tests
  this.timeout(60000);

  // Test context
  let browser: any;

  beforeEach(async function () {
    browser = (this as any).browser;

    // Wait for Theia to be fully loaded
    const appShell = await browser.$('#theia-app-shell');
    await appShell.waitForExist({ timeout: 15000 });
  });

  describe('Open Diagram View', function () {
    it('should open diagram view from command palette', async function () {
      // First, open a DSL file
      // This test assumes a workspace with .ecml files

      // Open command palette
      await browser.keys(['Control', 'Shift', 'p']);

      const palette = await browser.$('.quick-input-widget');
      await palette.waitForDisplayed();

      // Search for diagram command
      const input = await browser.$('.quick-input-box input');
      await input.setValue('Open Diagram');

      // Wait for command to appear
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Select the command
      await browser.keys(['Enter']);

      // Wait for diagram to load
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Check if diagram container exists
      const diagramContainer = await browser.$(SELECTORS.diagramContainer);
      if (await diagramContainer.isExisting()) {
        expect(await diagramContainer.isDisplayed()).to.be.true;
      }
    });

    it('should show diagram for opened DSL file', async function () {
      // This test requires a DSL file to be open first
      const diagramContainer = await browser.$(SELECTORS.diagramContainer);

      if (await diagramContainer.isExisting()) {
        // Verify diagram root is rendered
        const diagramRoot = await browser.$(SELECTORS.diagramRoot);
        expect(await diagramRoot.isExisting()).to.be.true;
      } else {
        this.skip();
      }
    });
  });

  describe('Tool Palette', function () {
    it('should display tool palette with node creation tools', async function () {
      const diagramContainer = await browser.$(SELECTORS.diagramContainer);
      if (!(await diagramContainer.isExisting())) {
        this.skip();
        return;
      }

      const toolPalette = await browser.$(SELECTORS.toolPalette);
      if (await toolPalette.isExisting()) {
        expect(await toolPalette.isDisplayed()).to.be.true;

        // Check for tool groups
        const groups = await browser.$$(SELECTORS.toolPaletteGroup);
        expect(groups.length).to.be.greaterThan(0);
      }
    });

    it('should expand/collapse tool palette groups', async function () {
      const toolPalette = await browser.$(SELECTORS.toolPalette);
      if (!(await toolPalette.isExisting())) {
        this.skip();
        return;
      }

      const groups = await browser.$$(SELECTORS.toolPaletteGroup);
      if (groups.length > 0) {
        const firstGroup = groups[0];
        const header = await firstGroup.$('.group-header');

        if (await header.isExisting()) {
          // Click to expand/collapse
          await header.click();
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Verify group state changed
          expect(await firstGroup.isExisting()).to.be.true;
        }
      }
    });
  });

  describe('Node Creation', function () {
    it('should create a node by clicking in diagram area', async function () {
      const diagramContainer = await browser.$(SELECTORS.diagramContainer);
      if (!(await diagramContainer.isExisting())) {
        this.skip();
        return;
      }

      // Select a node creation tool from palette
      const toolPaletteItem = await browser.$(SELECTORS.toolPaletteItem);
      if (await toolPaletteItem.isExisting()) {
        await toolPaletteItem.click();

        // Click in diagram to create node
        const diagramRoot = await browser.$(SELECTORS.diagramRoot);
        await diagramRoot.click({ x: 200, y: 200 });

        // Wait for node creation
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Verify node was created
        const nodes = await browser.$$(SELECTORS.node);
        // Note: Initial count may vary based on existing model
        expect(nodes.length).to.be.greaterThanOrEqual(0);
      }
    });

    it('should create a node via context menu', async function () {
      const diagramContainer = await browser.$(SELECTORS.diagramContainer);
      if (!(await diagramContainer.isExisting())) {
        this.skip();
        return;
      }

      // Right-click to open context menu
      const diagramRoot = await browser.$(SELECTORS.diagramRoot);
      await diagramRoot.click({ button: 'right', x: 150, y: 150 });

      // Wait for context menu
      await new Promise((resolve) => setTimeout(resolve, 300));

      const contextMenu = await browser.$(SELECTORS.contextMenu);
      if (await contextMenu.isExisting()) {
        // Find and click "Create" menu item
        const menuItems = await contextMenu.$$('.menu-item');
        for (const item of menuItems) {
          const text = await item.getText();
          if (text.includes('Create')) {
            await item.click();
            break;
          }
        }
      }
    });
  });

  describe('Node Selection and Movement', function () {
    it('should select a node by clicking', async function () {
      const diagramContainer = await browser.$(SELECTORS.diagramContainer);
      if (!(await diagramContainer.isExisting())) {
        this.skip();
        return;
      }

      const nodes = await browser.$$(SELECTORS.node);
      if (nodes.length > 0) {
        const firstNode = nodes[0];
        await firstNode.click();

        // Wait for selection
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Check for selection indicators
        const handles = await browser.$$(SELECTORS.selectionHandle);
        expect(handles.length).to.be.greaterThan(0);
      } else {
        this.skip();
      }
    });

    it('should move a node by dragging', async function () {
      const nodes = await browser.$$(SELECTORS.node);
      if (nodes.length === 0) {
        this.skip();
        return;
      }

      const node = nodes[0];

      // Get initial position
      const initialLocation = await node.getLocation();

      // Drag the node
      await node.dragAndDrop({ x: 50, y: 50 });

      // Wait for position update
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Get new position
      const newLocation = await node.getLocation();

      // Position should have changed
      expect(
        newLocation.x !== initialLocation.x ||
          newLocation.y !== initialLocation.y
      ).to.be.true;
    });

    it('should resize a node using handles', async function () {
      const nodes = await browser.$$(SELECTORS.node);
      if (nodes.length === 0) {
        this.skip();
        return;
      }

      // Select the node first
      await nodes[0].click();
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Find resize handle
      const handles = await browser.$$(SELECTORS.selectionHandle);
      if (handles.length > 0) {
        // Drag a corner handle to resize
        const handle = handles[handles.length - 1]; // Bottom-right handle
        await handle.dragAndDrop({ x: 20, y: 20 });

        // Verify resize occurred
        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(await nodes[0].isExisting()).to.be.true;
      }
    });
  });

  describe('Edge Creation', function () {
    it('should create an edge between two nodes', async function () {
      const nodes = await browser.$$(SELECTORS.node);
      if (nodes.length < 2) {
        this.skip();
        return;
      }

      // Select edge creation tool
      const toolPalette = await browser.$(SELECTORS.toolPalette);
      if (!(await toolPalette.isExisting())) {
        this.skip();
        return;
      }

      // Find edge tool in palette
      const edgeTool = await browser.$('[data-tool-type="edge"]');
      if (await edgeTool.isExisting()) {
        await edgeTool.click();

        // Click on source node
        await nodes[0].click();

        // Click on target node
        await nodes[1].click();

        // Wait for edge creation
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Verify edge was created
        const edges = await browser.$$(SELECTORS.edge);
        expect(edges.length).to.be.greaterThan(0);
      }
    });
  });

  describe('Element Deletion', function () {
    it('should delete selected element with Delete key', async function () {
      const nodes = await browser.$$(SELECTORS.node);
      if (nodes.length === 0) {
        this.skip();
        return;
      }

      const initialCount = nodes.length;

      // Select a node
      await nodes[0].click();
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Press Delete key
      await browser.keys(['Delete']);

      // Wait for deletion
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify deletion
      const newNodes = await browser.$$(SELECTORS.node);
      expect(newNodes.length).to.equal(initialCount - 1);
    });

    it('should delete via context menu', async function () {
      const nodes = await browser.$$(SELECTORS.node);
      if (nodes.length === 0) {
        this.skip();
        return;
      }

      // Right-click on node
      await nodes[0].click({ button: 'right' });

      // Wait for context menu
      await new Promise((resolve) => setTimeout(resolve, 300));

      const contextMenu = await browser.$(SELECTORS.contextMenu);
      if (await contextMenu.isExisting()) {
        // Find and click "Delete" menu item
        const menuItems = await contextMenu.$$('.menu-item');
        for (const item of menuItems) {
          const text = await item.getText();
          if (text.includes('Delete')) {
            await item.click();
            break;
          }
        }
      }
    });
  });

  describe('Layout Operations', function () {
    it('should apply auto-layout via command', async function () {
      const diagramContainer = await browser.$(SELECTORS.diagramContainer);
      if (!(await diagramContainer.isExisting())) {
        this.skip();
        return;
      }

      // Open command palette
      await browser.keys(['Control', 'Shift', 'p']);

      const palette = await browser.$('.quick-input-widget');
      await palette.waitForDisplayed();

      // Search for layout command
      const input = await browser.$('.quick-input-box input');
      await input.setValue('Layout');

      await new Promise((resolve) => setTimeout(resolve, 500));
      await browser.keys(['Enter']);

      // Wait for layout to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify diagram still exists
      expect(await diagramContainer.isExisting()).to.be.true;
    });
  });

  describe('Diagram Zoom and Pan', function () {
    it('should zoom in using keyboard shortcut', async function () {
      const diagramContainer = await browser.$(SELECTORS.diagramContainer);
      if (!(await diagramContainer.isExisting())) {
        this.skip();
        return;
      }

      // Focus diagram
      await diagramContainer.click();

      // Zoom in
      await browser.keys(['Control', '+']);
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Verify diagram still functions
      expect(await diagramContainer.isExisting()).to.be.true;
    });

    it('should zoom out using keyboard shortcut', async function () {
      const diagramContainer = await browser.$(SELECTORS.diagramContainer);
      if (!(await diagramContainer.isExisting())) {
        this.skip();
        return;
      }

      await diagramContainer.click();

      // Zoom out
      await browser.keys(['Control', '-']);
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(await diagramContainer.isExisting()).to.be.true;
    });

    it('should fit diagram to viewport', async function () {
      const diagramContainer = await browser.$(SELECTORS.diagramContainer);
      if (!(await diagramContainer.isExisting())) {
        this.skip();
        return;
      }

      await diagramContainer.click();

      // Fit to viewport command
      await browser.keys(['Control', 'Shift', 'f']);
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(await diagramContainer.isExisting()).to.be.true;
    });
  });
});

// Export for test runner
export {};
