/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Export SVG Action Handler
 *
 * Handles the requestExportSvg action by extracting SVG content from the diagram
 * and triggering a file download.
 *
 * @packageDocumentation
 */

import { injectable, inject, optional } from 'inversify';
import { IActionHandler } from 'sprotty';
import { Action } from 'sprotty-protocol';
import { DIAGRAM_CONTAINER_ID } from '../base-ui-extension';

/**
 * Request Export SVG Action.
 */
export interface RequestExportSvgAction extends Action {
    kind: 'requestExportSvg';
    filename?: string;
}

export namespace RequestExportSvgAction {
    export const KIND = 'requestExportSvg';

    export function create(filename?: string): RequestExportSvgAction {
        return { kind: KIND, filename };
    }
}

/**
 * Action handler for exporting diagrams as SVG files.
 */
@injectable()
export class ExportSvgActionHandler implements IActionHandler {
    @inject(DIAGRAM_CONTAINER_ID) @optional()
    protected diagramContainerId?: string;

    /**
     * Handle the export SVG action.
     */
    handle(action: Action): void {
        if (action.kind === RequestExportSvgAction.KIND) {
            this.handleExportSvg(action as RequestExportSvgAction);
        }
    }

    /**
     * Process the export SVG request.
     */
    protected handleExportSvg(action: RequestExportSvgAction): void {
        console.log('[ExportSvgActionHandler] Handling export SVG action');

        const svg = this.getSvgContent();
        if (svg) {
            const filename = action.filename || this.generateFilename();
            this.downloadSvg(svg, filename);
            console.log('[ExportSvgActionHandler] SVG exported:', filename);
        } else {
            console.warn('[ExportSvgActionHandler] No SVG content found to export');
        }
    }

    /**
     * Extract SVG content from the diagram container.
     */
    protected getSvgContent(): string | undefined {
        // First try the specific diagram container
        let container: HTMLElement | null = null;

        if (this.diagramContainerId) {
            container = document.getElementById(this.diagramContainerId);
        }

        // Fall back to looking for the diagram SVG container class
        if (!container) {
            container = document.querySelector('.sanyam-diagram-svg-container') as HTMLElement;
        }

        // Fall back to looking for any sprotty container
        if (!container) {
            container = document.querySelector('.sprotty') as HTMLElement;
        }

        if (!container) {
            console.warn('[ExportSvgActionHandler] No diagram container found');
            return undefined;
        }

        const svg = container.querySelector('svg');
        if (!svg) {
            console.warn('[ExportSvgActionHandler] No SVG element found in container');
            return undefined;
        }

        // Clone the SVG to avoid modifying the original
        const clone = svg.cloneNode(true) as SVGElement;

        // Ensure proper SVG namespace
        if (!clone.hasAttribute('xmlns')) {
            clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        }

        // Ensure xlink namespace for href attributes
        if (!clone.hasAttribute('xmlns:xlink')) {
            clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
        }

        // Inline computed styles for proper standalone rendering
        this.inlineStyles(clone);

        return new XMLSerializer().serializeToString(clone);
    }

    /**
     * Inline critical CSS styles into the SVG for standalone rendering.
     */
    protected inlineStyles(svg: SVGElement): void {
        // Get all elements in the SVG
        const elements = svg.querySelectorAll('*');

        elements.forEach(element => {
            if (element instanceof SVGElement || element instanceof HTMLElement) {
                const computedStyle = window.getComputedStyle(element);

                // Inline critical style properties for diagram elements
                const criticalProperties = [
                    'fill',
                    'stroke',
                    'stroke-width',
                    'font-family',
                    'font-size',
                    'font-weight',
                    'text-anchor',
                    'dominant-baseline',
                    'opacity',
                ];

                criticalProperties.forEach(prop => {
                    const value = computedStyle.getPropertyValue(prop);
                    if (value && value !== 'none' && value !== 'initial') {
                        (element as HTMLElement).style.setProperty(prop, value);
                    }
                });
            }
        });
    }

    /**
     * Generate a filename for the exported SVG.
     */
    protected generateFilename(): string {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        return `diagram-${timestamp}.svg`;
    }

    /**
     * Download the SVG content as a file.
     */
    protected downloadSvg(svgContent: string, filename: string): void {
        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the object URL after a short delay
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }
}
