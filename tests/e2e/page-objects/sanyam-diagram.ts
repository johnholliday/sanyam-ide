import { type Page, type Locator } from '@playwright/test';

/**
 * Page object for GLSP diagram interactions within the composite editor.
 *
 * Provides helpers for querying nodes, edges, and performing diagram-level
 * operations like zoom and layout.  The diagram is rendered as an SVG
 * (`svg.sprotty-graph`) inside a `.sanyam-diagram-svg-container` div.
 */
export class SanyamDiagram {
    readonly page: Page;

    /**
     * Root locator scoped to the composite editor's diagram SVG container.
     * All queries are relative to this container.
     *
     * DOM hierarchy:
     *   `.sanyam-diagram-svg-container.sprotty` → `svg.sprotty-graph` → nodes/edges
     */
    readonly root: Locator;

    constructor(page: Page) {
        this.page = page;
        // Scope to the Sprotty SVG container inside the composite editor
        this.root = page.locator('.sanyam-composite-editor .sanyam-diagram-svg-container').first();
    }

    /* ------------------------------------------------------------------ */
    /*  Lifecycle                                                          */
    /* ------------------------------------------------------------------ */

    /** Wait for the diagram SVG to be rendered. */
    async waitForReady(timeout = 15_000): Promise<void> {
        await this.root.waitFor({ state: 'visible', timeout });
    }

    /**
     * Wait until the diagram has at least `minNodes` rendered node elements.
     */
    async waitForNodes(minNodes: number, timeout = 15_000): Promise<void> {
        await this.page.waitForFunction(
            ({ selector, min }) => {
                const container = document.querySelector(selector);
                if (!container) {
                    return false;
                }
                const nodes = container.querySelectorAll('.sprotty-node');
                return nodes.length >= min;
            },
            { selector: '.sanyam-composite-editor .sanyam-diagram-svg-container', min: minNodes },
            { timeout, polling: 500 },
        );
    }

    /* ------------------------------------------------------------------ */
    /*  Nodes                                                              */
    /* ------------------------------------------------------------------ */

    /** Locator for all rendered nodes. */
    getNodes(): Locator {
        return this.root.locator('.sprotty-node');
    }

    /** Get the count of rendered nodes. */
    async getNodeCount(): Promise<number> {
        return this.getNodes().count();
    }

    /**
     * Locate a node's label element by its visible text.
     *
     * In GLSP/Sprotty, `<text>` elements are NOT children of `.sprotty-node`
     * — they are in separate sibling `<g>` groups within the SVG.  So we
     * locate the `<text>` element directly by its content.
     */
    getNodeByLabel(label: string): Locator {
        return this.root.locator('text', { hasText: label }).first();
    }

    /** Click on a node to select it (clicks the label text element). */
    async selectNode(label: string): Promise<void> {
        const textEl = this.getNodeByLabel(label);
        await textEl.click();
    }

    /* ------------------------------------------------------------------ */
    /*  Edges                                                              */
    /* ------------------------------------------------------------------ */

    /** Locator for all rendered edges. */
    getEdges(): Locator {
        return this.root.locator('.sprotty-edge');
    }

    /** Get the count of rendered edges. */
    async getEdgeCount(): Promise<number> {
        return this.getEdges().count();
    }

    /* ------------------------------------------------------------------ */
    /*  SVG container                                                      */
    /* ------------------------------------------------------------------ */

    /** Locator for the SVG element inside the Sprotty graph container. */
    getSvgElement(): Locator {
        return this.root.locator('svg').first();
    }

    /**
     * Get the bounding box of the diagram SVG container.
     * Useful for computing drop coordinates.
     */
    async getBoundingBox(): Promise<{ x: number; y: number; width: number; height: number }> {
        const box = await this.root.boundingBox();
        if (!box) {
            throw new Error('Diagram container is not visible or has no bounding box');
        }
        return box;
    }

    /* ------------------------------------------------------------------ */
    /*  Zoom and layout                                                    */
    /* ------------------------------------------------------------------ */

    /** Zoom in using Ctrl+=. */
    async zoomIn(): Promise<void> {
        await this.root.click(); // Focus diagram
        await this.page.keyboard.press('Control+=');
    }

    /** Zoom out using Ctrl+-. */
    async zoomOut(): Promise<void> {
        await this.root.click();
        await this.page.keyboard.press('Control+-');
    }

    /** Fit diagram to viewport using Ctrl+Shift+F. */
    async fitToViewport(): Promise<void> {
        await this.root.click();
        await this.page.keyboard.press('Control+Shift+F');
    }

    /* ------------------------------------------------------------------ */
    /*  Element deletion                                                   */
    /* ------------------------------------------------------------------ */

    /** Delete the currently selected element via the Delete key. */
    async deleteSelected(): Promise<void> {
        await this.page.keyboard.press('Delete');
    }
}
