import { type Page, type Locator } from '@playwright/test';

/**
 * Page object for the Sanyam composite editor widget.
 *
 * The composite editor hosts a Monaco text editor and a Sprotty/GLSP
 * diagram side-by-side in a Lumino DockPanel.  This page object exposes
 * helpers for switching tabs, locating child editors, and waiting for
 * content to be ready.
 */
export class CompositeEditor {
    readonly page: Page;

    /** Root locator for the composite editor widget. */
    readonly root: Locator;

    constructor(page: Page) {
        this.page = page;
        this.root = page.locator('.sanyam-composite-editor').first();
    }

    /* ------------------------------------------------------------------ */
    /*  Visibility                                                         */
    /* ------------------------------------------------------------------ */

    /** Wait for the composite editor to be visible. */
    async waitForVisible(timeout = 10_000): Promise<void> {
        await this.root.waitFor({ state: 'visible', timeout });
    }

    /** Whether the composite editor is currently in the DOM and visible. */
    async isVisible(): Promise<boolean> {
        return this.root.isVisible();
    }

    /* ------------------------------------------------------------------ */
    /*  Tab switching                                                       */
    /* ------------------------------------------------------------------ */

    /**
     * Switch to the Text tab inside the composite editor.
     *
     * Clicks the tab whose label contains "Text" within the dock panel.
     */
    async switchToTextTab(): Promise<void> {
        const textTab = this.root.locator('.lm-TabBar-tab', { hasText: 'Text' });
        await textTab.click();
        // Wait for the Monaco editor to be visible
        await this.getTextEditor().waitFor({ state: 'visible', timeout: 5_000 });
    }

    /**
     * Switch to the Diagram tab inside the composite editor.
     *
     * Clicks the tab whose label contains "Diagram" within the dock panel.
     */
    async switchToDiagramTab(): Promise<void> {
        const diagramTab = this.root.locator('.lm-TabBar-tab', { hasText: 'Diagram' });
        await diagramTab.click();
        // Wait for the Sprotty container to appear
        await this.getDiagramContainer().waitFor({ state: 'visible', timeout: 10_000 });
    }

    /**
     * Determine which tab is currently active.
     * @returns `'text'` or `'diagram'` (or `'unknown'` if neither is clearly active).
     */
    async getActiveTab(): Promise<'text' | 'diagram' | 'unknown'> {
        const activeTab = this.root.locator('.lm-TabBar-tab.lm-mod-current');
        const label = await activeTab.textContent().catch(() => '');
        if (label?.includes('Text')) {
            return 'text';
        }
        if (label?.includes('Diagram')) {
            return 'diagram';
        }
        return 'unknown';
    }

    /* ------------------------------------------------------------------ */
    /*  Child locators                                                     */
    /* ------------------------------------------------------------------ */

    /** Locator for the embedded Monaco text editor. */
    getTextEditor(): Locator {
        return this.root.locator('.monaco-editor').first();
    }

    /**
     * Locator for the Sprotty SVG container.
     *
     * The DOM hierarchy is:
     *   `.sanyam-diagram-widget` → `.sanyam-diagram-container`
     *     → `.sanyam-diagram-svg-container.sprotty` → `svg.sprotty-graph`
     */
    getDiagramContainer(): Locator {
        return this.root.locator('.sanyam-diagram-svg-container').first();
    }

    /** Locator for the SVG element inside the diagram. */
    getSvgElement(): Locator {
        return this.root.locator('svg.sprotty-graph').first();
    }

    /**
     * Locator for the editor's text content area (Monaco `.view-lines`).
     * Useful for reading displayed text.
     */
    getViewLines(): Locator {
        return this.root.locator('.view-lines').first();
    }

    /* ------------------------------------------------------------------ */
    /*  Content helpers                                                    */
    /* ------------------------------------------------------------------ */

    /**
     * Wait for the diagram to finish loading (SVG has child nodes).
     * @param timeout - Maximum wait time in milliseconds.
     */
    async waitForDiagramLoaded(timeout = 30_000): Promise<void> {
        await this.getDiagramContainer().waitFor({ state: 'visible', timeout });
        // Wait until Sprotty has rendered at least one node AND at least one
        // text label.  In GLSP/Sprotty, the <text> elements are NOT children
        // of .sprotty-node — they are siblings in separate SVG groups.
        // So we check for both independently within the diagram SVG container.
        await this.page.waitForFunction(
            () => {
                const container = document.querySelector(
                    '.sanyam-composite-editor .sanyam-diagram-svg-container',
                );
                if (!container) return false;
                const hasNodes = container.querySelectorAll('.sprotty-node').length > 0;
                const texts = container.querySelectorAll('text');
                let hasText = false;
                for (let i = 0; i < texts.length; i++) {
                    if (texts[i].textContent && texts[i].textContent!.trim().length > 0) {
                        hasText = true;
                        break;
                    }
                }
                return hasNodes && hasText;
            },
            { timeout, polling: 500 },
        );
    }

    /**
     * Get the text content of the Monaco editor.
     * Reads from the view-lines container.
     */
    async getTextContent(): Promise<string> {
        const viewLines = this.getViewLines();
        return (await viewLines.textContent()) ?? '';
    }
}
