import { type Page, type Locator } from '@playwright/test';

/**
 * Page object for the sidebar Element Palette (Tools) widget.
 *
 * The palette shows categorised element types that can be dragged onto
 * the diagram canvas or text editor to create new model elements.
 */
export class ElementPalette {
    readonly page: Page;

    /** Root locator for the palette widget. */
    readonly root: Locator;

    constructor(page: Page) {
        this.page = page;
        this.root = page.locator('.sanyam-element-palette').first();
    }

    /* ------------------------------------------------------------------ */
    /*  Visibility                                                         */
    /* ------------------------------------------------------------------ */

    /** Wait for the palette widget to be visible. */
    async waitForVisible(timeout = 10_000): Promise<void> {
        await this.root.waitFor({ state: 'visible', timeout });
    }

    /** Whether the palette is currently visible. */
    async isVisible(): Promise<boolean> {
        return this.root.isVisible();
    }

    /* ------------------------------------------------------------------ */
    /*  Categories                                                         */
    /* ------------------------------------------------------------------ */

    /** Get all category containers. */
    getCategories(): Locator {
        return this.root.locator('.sanyam-element-palette-category');
    }

    /** Get the label text of each category header. */
    async getCategoryLabels(): Promise<string[]> {
        const headers = this.root.locator('.sanyam-element-palette-category-label');
        return headers.allTextContents();
    }

    /**
     * Expand a category by clicking its header.
     * If the category is already expanded this is a no-op.
     */
    async expandCategory(categoryLabel: string): Promise<void> {
        const category = this.root.locator('.sanyam-element-palette-category', { hasText: categoryLabel });
        const chevron = category.locator('.sanyam-element-palette-category-chevron');
        const isCollapsed = await chevron.evaluate(el => el.classList.contains('collapsed'));
        if (isCollapsed) {
            await category.locator('.sanyam-element-palette-category-header').click();
        }
    }

    /**
     * Collapse a category by clicking its header.
     * If the category is already collapsed this is a no-op.
     */
    async collapseCategory(categoryLabel: string): Promise<void> {
        const category = this.root.locator('.sanyam-element-palette-category', { hasText: categoryLabel });
        const chevron = category.locator('.sanyam-element-palette-category-chevron');
        const isCollapsed = await chevron.evaluate(el => el.classList.contains('collapsed'));
        if (!isCollapsed) {
            await category.locator('.sanyam-element-palette-category-header').click();
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Items                                                              */
    /* ------------------------------------------------------------------ */

    /** Get all visible element items across all categories. */
    getItems(): Locator {
        return this.root.locator('.sanyam-element-palette-item');
    }

    /**
     * Get element items within a specific category.
     * @param categoryLabel - Label text of the category.
     */
    getItemsInCategory(categoryLabel: string): Locator {
        const category = this.root.locator('.sanyam-element-palette-category', { hasText: categoryLabel });
        return category.locator('.sanyam-element-palette-item');
    }

    /**
     * Get a specific item by its label text.
     * @param itemLabel - The display label of the element type (e.g. "Activity", "Actor").
     */
    getItem(itemLabel: string): Locator {
        return this.root.locator('.sanyam-element-palette-item', { hasText: itemLabel }).first();
    }

    /**
     * Get the labels of all visible items.
     */
    async getItemLabels(): Promise<string[]> {
        const labels = this.root.locator('.sanyam-element-palette-item-label');
        return labels.allTextContents();
    }

    /* ------------------------------------------------------------------ */
    /*  Drag-and-drop                                                      */
    /* ------------------------------------------------------------------ */

    /**
     * Drag an element item onto a target locator.
     *
     * Uses a custom drag simulation instead of Playwright's built-in
     * `dragTo`, because `dragTo` does not set custom MIME types on the
     * `DataTransfer` object.  Our drop handlers require the
     * `application/sanyam-element` MIME type to accept a drop.
     *
     * The simulation:
     * 1. Creates a `DataTransfer` and dispatches `dragstart` on the
     *    palette item — the React `onDragStart` handler fires and
     *    populates the `DataTransfer` with the element payload.
     * 2. Dispatches `dragenter` + `dragover` on the drop target.
     * 3. Dispatches `drop` on the target — the composite editor's
     *    capture-phase listener processes the drop.
     * 4. Dispatches `dragend` on the source to clean up.
     *
     * @param itemLabel  - Label of the palette item to drag.
     * @param target     - Locator of the drop target.
     * @param options    - Optional target position offset.
     */
    async dragItemTo(
        itemLabel: string,
        target: Locator,
        options?: { targetPosition?: { x: number; y: number } },
    ): Promise<void> {
        const item = this.getItem(itemLabel);
        await item.waitFor({ state: 'visible', timeout: 5_000 });

        // Compute absolute drop coordinates from the target's bounding box.
        const targetBbox = await target.boundingBox();
        if (!targetBbox) {
            throw new Error('Target element is not visible — cannot compute drop coordinates');
        }

        const dropX = options?.targetPosition
            ? targetBbox.x + options.targetPosition.x
            : targetBbox.x + targetBbox.width / 2;
        const dropY = options?.targetPosition
            ? targetBbox.y + options.targetPosition.y
            : targetBbox.y + targetBbox.height / 2;

        // Locator.evaluate() passes the matched DOM element as the first
        // argument.  We find the drop target inside the page via
        // document.elementFromPoint() using viewport coordinates.
        await item.evaluate(
            async (source: HTMLElement, { dropX, dropY }: { dropX: number; dropY: number }) => {
                const MIME = 'application/sanyam-element';
                const dt = new DataTransfer();

                const srcRect = source.getBoundingClientRect();
                const srcCX = srcRect.x + srcRect.width / 2;
                const srcCY = srcRect.y + srcRect.height / 2;

                // Step 1: dragstart — React handler populates DataTransfer
                source.dispatchEvent(new DragEvent('dragstart', {
                    dataTransfer: dt,
                    clientX: srcCX,
                    clientY: srcCY,
                    bubbles: true,
                    cancelable: true,
                }));

                if (!Array.from(dt.types).includes(MIME)) {
                    throw new Error(
                        `dragstart handler did not set ${MIME} on DataTransfer. ` +
                        `types: [${Array.from(dt.types).join(', ') || 'none'}]`,
                    );
                }

                await new Promise(r => setTimeout(r, 100));

                // Resolve the target element at the drop point.
                const dropTarget = document.elementFromPoint(dropX, dropY);
                if (!dropTarget) {
                    throw new Error(`No element found at drop point (${dropX}, ${dropY})`);
                }

                // Step 2: dragenter + dragover
                dropTarget.dispatchEvent(new DragEvent('dragenter', {
                    dataTransfer: dt, clientX: dropX, clientY: dropY,
                    bubbles: true, cancelable: true,
                }));
                dropTarget.dispatchEvent(new DragEvent('dragover', {
                    dataTransfer: dt, clientX: dropX, clientY: dropY,
                    bubbles: true, cancelable: true,
                }));

                await new Promise(r => setTimeout(r, 100));

                // Step 3: drop — composite editor's capture-phase listener handles it
                dropTarget.dispatchEvent(new DragEvent('drop', {
                    dataTransfer: dt, clientX: dropX, clientY: dropY,
                    bubbles: true, cancelable: true,
                }));

                // Step 4: dragend on source for cleanup
                source.dispatchEvent(new DragEvent('dragend', {
                    dataTransfer: dt, clientX: dropX, clientY: dropY,
                    bubbles: true, cancelable: true,
                }));
            },
            { dropX, dropY },
        );
    }

    /* ------------------------------------------------------------------ */
    /*  Search                                                             */
    /* ------------------------------------------------------------------ */

    /** Get the search input locator. */
    getSearchInput(): Locator {
        return this.root.locator('.sanyam-element-palette-search-input');
    }

    /** Type into the search field to filter items. */
    async search(query: string): Promise<void> {
        const input = this.getSearchInput();
        await input.fill(query);
    }

    /** Clear the search field. */
    async clearSearch(): Promise<void> {
        const clearBtn = this.root.locator('.sanyam-element-palette-search-clear');
        if (await clearBtn.isVisible()) {
            await clearBtn.click();
        } else {
            await this.getSearchInput().fill('');
        }
    }
}
