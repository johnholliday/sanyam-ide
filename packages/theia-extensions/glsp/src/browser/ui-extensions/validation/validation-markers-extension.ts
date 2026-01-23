/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Validation Markers Extension
 *
 * Renders validation markers (error, warning, info) on diagram elements.
 *
 * @packageDocumentation
 */

import { injectable, inject, optional } from 'inversify';
import { SModelRootImpl, TYPES, IActionDispatcher } from 'sprotty';
import { AbstractUIExtension, DIAGRAM_CONTAINER_ID } from '../base-ui-extension';
import {
    ValidationMarker,
    MarkerSeverity,
    NavigateToMarkerAction,
} from './validation-actions';

/**
 * Validation Markers Extension ID.
 */
export const VALIDATION_MARKERS_ID = 'sanyam-validation-markers';

/**
 * CSS classes for validation markers.
 */
export const ValidationMarkerClasses = {
    CONTAINER: 'sanyam-validation-markers',
    MARKER: 'sanyam-validation-marker',
    MARKER_ERROR: 'sanyam-marker-error',
    MARKER_WARNING: 'sanyam-marker-warning',
    MARKER_INFO: 'sanyam-marker-info',
    MARKER_HINT: 'sanyam-marker-hint',
    MARKER_ICON: 'sanyam-marker-icon',
    MARKER_BADGE: 'sanyam-marker-badge',
    MARKER_TOOLTIP: 'sanyam-marker-tooltip',
    ELEMENT_HAS_ERROR: 'has-validation-error',
    ELEMENT_HAS_WARNING: 'has-validation-warning',
    ELEMENT_HAS_INFO: 'has-validation-info',
} as const;

/**
 * Position of a marker relative to an element.
 */
interface MarkerPosition {
    x: number;
    y: number;
    width?: number;
    height?: number;
}

/**
 * Validation Markers UI Extension.
 *
 * Displays validation markers on diagram elements by rendering
 * decorations (badges, borders) to indicate validation issues.
 */
@injectable()
export class ValidationMarkersExtension extends AbstractUIExtension {
    @inject(DIAGRAM_CONTAINER_ID) @optional()
    protected diagramContainerId: string | undefined;

    @inject(TYPES.IActionDispatcher)
    protected override actionDispatcher: IActionDispatcher;

    /** Current markers by element ID */
    protected markers: Map<string, ValidationMarker[]> = new Map();

    /** Marker decorations by element ID */
    protected decorations: Map<string, HTMLElement[]> = new Map();

    /** Current model reference */
    protected model: SModelRootImpl | undefined;

    /** Parent container element reference */
    protected parentContainerElement: HTMLElement | undefined;

    /** Tooltip element */
    protected tooltipElement: HTMLElement | undefined;

    /** Debounce timer for validation requests */
    protected validationDebounceTimer: ReturnType<typeof setTimeout> | undefined;

    id(): string {
        return VALIDATION_MARKERS_ID;
    }

    containerClass(): string {
        return ValidationMarkerClasses.CONTAINER;
    }

    /**
     * Set the parent container element.
     */
    setParentContainer(element: HTMLElement): void {
        this.parentContainerElement = element;
    }

    protected getParentContainer(): HTMLElement | undefined {
        if (this.parentContainerElement) {
            return this.parentContainerElement;
        }

        if (this.diagramContainerId) {
            const container = document.getElementById(this.diagramContainerId);
            if (container?.parentElement) {
                return container.parentElement;
            }
        }

        return undefined;
    }

    protected initializeContents(containerElement: HTMLElement): void {
        // The container is an overlay for marker decorations
        containerElement.style.pointerEvents = 'none';
        containerElement.style.position = 'absolute';
        containerElement.style.top = '0';
        containerElement.style.left = '0';
        containerElement.style.width = '100%';
        containerElement.style.height = '100%';
        containerElement.style.overflow = 'hidden';

        // Create tooltip element
        this.tooltipElement = document.createElement('div');
        this.tooltipElement.className = ValidationMarkerClasses.MARKER_TOOLTIP;
        this.tooltipElement.style.display = 'none';
        containerElement.appendChild(this.tooltipElement);
    }

    /**
     * Set validation markers.
     */
    setMarkers(markers: ValidationMarker[], replace: boolean = true): void {
        if (replace) {
            this.clearAllDecorations();
            this.markers.clear();
        }

        // Group markers by element ID
        for (const marker of markers) {
            const existing = this.markers.get(marker.elementId) || [];
            existing.push(marker);
            this.markers.set(marker.elementId, existing);
        }

        // Render decorations
        this.renderMarkerDecorations();
    }

    /**
     * Clear markers for specific elements or all markers.
     */
    clearMarkers(elementIds?: string[]): void {
        if (elementIds) {
            for (const id of elementIds) {
                this.markers.delete(id);
                this.clearDecorationsForElement(id);
            }
        } else {
            this.clearAllDecorations();
            this.markers.clear();
        }
    }

    /**
     * Get markers for a specific element.
     */
    getMarkersForElement(elementId: string): ValidationMarker[] {
        return this.markers.get(elementId) || [];
    }

    /**
     * Get all markers.
     */
    getAllMarkers(): ValidationMarker[] {
        const allMarkers: ValidationMarker[] = [];
        this.markers.forEach(markers => allMarkers.push(...markers));
        return allMarkers;
    }

    /**
     * Get the highest severity for an element.
     */
    getHighestSeverity(elementId: string): MarkerSeverity | undefined {
        const markers = this.markers.get(elementId);
        if (!markers || markers.length === 0) {
            return undefined;
        }

        const severityOrder: MarkerSeverity[] = ['error', 'warning', 'info', 'hint'];
        for (const severity of severityOrder) {
            if (markers.some(m => m.severity === severity)) {
                return severity;
            }
        }

        return undefined;
    }

    /**
     * Render marker decorations on the SVG.
     */
    protected renderMarkerDecorations(): void {
        if (!this.model || !this.containerElement) {
            return;
        }

        // Find SVG container
        const svgContainer = this.findSvgContainer();
        if (!svgContainer) {
            return;
        }

        // Render decorations for each element with markers
        this.markers.forEach((markers, elementId) => {
            this.renderElementDecorations(elementId, markers, svgContainer);
        });

        // Apply CSS classes to SVG elements
        this.applySvgMarkerClasses();
    }

    /**
     * Find the SVG container element.
     */
    protected findSvgContainer(): SVGSVGElement | undefined {
        if (this.diagramContainerId) {
            const container = document.getElementById(this.diagramContainerId);
            if (container) {
                return container.querySelector('svg.sprotty-graph') as SVGSVGElement;
            }
        }
        return undefined;
    }

    /**
     * Render decorations for a specific element.
     */
    protected renderElementDecorations(
        elementId: string,
        markers: ValidationMarker[],
        svgContainer: SVGSVGElement
    ): void {
        // Find the SVG element
        const svgElement = svgContainer.querySelector(`[id="${elementId}"]`);
        if (!svgElement) {
            return;
        }

        // Get element position
        const position = this.getElementPosition(svgElement);
        if (!position) {
            return;
        }

        // Get the highest severity
        const severity = this.getHighestSeverity(elementId);
        if (!severity) {
            return;
        }

        // Create marker badge
        const badge = this.createMarkerBadge(elementId, markers, severity, position);
        this.containerElement!.appendChild(badge);

        // Store decoration reference
        const existing = this.decorations.get(elementId) || [];
        existing.push(badge);
        this.decorations.set(elementId, existing);
    }

    /**
     * Get element position from SVG element.
     */
    protected getElementPosition(svgElement: Element): MarkerPosition | undefined {
        try {
            const bbox = (svgElement as SVGGraphicsElement).getBBox();
            const ctm = (svgElement as SVGGraphicsElement).getCTM();

            if (!ctm) {
                return { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height };
            }

            // Transform position using CTM
            const svg = (svgElement as SVGElement).ownerSVGElement;
            if (!svg) {
                return undefined;
            }

            const point = svg.createSVGPoint();
            point.x = bbox.x;
            point.y = bbox.y;
            const transformed = point.matrixTransform(ctm);

            return {
                x: transformed.x,
                y: transformed.y,
                width: bbox.width,
                height: bbox.height,
            };
        } catch (e) {
            console.warn(`[ValidationMarkers] Could not get position for element:`, e);
            return undefined;
        }
    }

    /**
     * Create a marker badge element.
     */
    protected createMarkerBadge(
        elementId: string,
        markers: ValidationMarker[],
        severity: MarkerSeverity,
        position: MarkerPosition
    ): HTMLElement {
        const badge = document.createElement('div');
        badge.className = `${ValidationMarkerClasses.MARKER} ${ValidationMarkerClasses.MARKER_BADGE} ${this.getSeverityClass(severity)}`;
        badge.dataset.elementId = elementId;

        // Position in top-right corner of element
        const offsetX = (position.width || 0) - 8;
        const offsetY = -8;
        badge.style.position = 'absolute';
        badge.style.left = `${position.x + offsetX}px`;
        badge.style.top = `${position.y + offsetY}px`;
        badge.style.pointerEvents = 'auto';
        badge.style.zIndex = '100';

        // Icon
        const icon = document.createElement('span');
        icon.className = `${ValidationMarkerClasses.MARKER_ICON} codicon ${this.getSeverityIcon(severity)}`;
        badge.appendChild(icon);

        // Count if multiple markers
        if (markers.length > 1) {
            const count = document.createElement('span');
            count.className = 'marker-count';
            count.textContent = String(markers.length);
            badge.appendChild(count);
        }

        // Event handlers
        badge.addEventListener('mouseenter', (e) => this.showTooltip(markers, e));
        badge.addEventListener('mouseleave', () => this.hideTooltip());
        badge.addEventListener('click', () => this.navigateToMarker(elementId));

        return badge;
    }

    /**
     * Get CSS class for severity.
     */
    protected getSeverityClass(severity: MarkerSeverity): string {
        switch (severity) {
            case 'error': return ValidationMarkerClasses.MARKER_ERROR;
            case 'warning': return ValidationMarkerClasses.MARKER_WARNING;
            case 'info': return ValidationMarkerClasses.MARKER_INFO;
            case 'hint': return ValidationMarkerClasses.MARKER_HINT;
        }
    }

    /**
     * Get icon class for severity.
     */
    protected getSeverityIcon(severity: MarkerSeverity): string {
        switch (severity) {
            case 'error': return 'codicon-error';
            case 'warning': return 'codicon-warning';
            case 'info': return 'codicon-info';
            case 'hint': return 'codicon-lightbulb';
        }
    }

    /**
     * Apply CSS marker classes to SVG elements.
     */
    protected applySvgMarkerClasses(): void {
        const svgContainer = this.findSvgContainer();
        if (!svgContainer) {
            return;
        }

        // Remove existing marker classes
        const allElements = svgContainer.querySelectorAll(
            `.${ValidationMarkerClasses.ELEMENT_HAS_ERROR}, .${ValidationMarkerClasses.ELEMENT_HAS_WARNING}, .${ValidationMarkerClasses.ELEMENT_HAS_INFO}`
        );
        allElements.forEach(el => {
            el.classList.remove(
                ValidationMarkerClasses.ELEMENT_HAS_ERROR,
                ValidationMarkerClasses.ELEMENT_HAS_WARNING,
                ValidationMarkerClasses.ELEMENT_HAS_INFO
            );
        });

        // Add marker classes to elements with markers
        this.markers.forEach((markers, elementId) => {
            const element = svgContainer.querySelector(`[id="${elementId}"]`);
            if (!element) {
                return;
            }

            const severity = this.getHighestSeverity(elementId);
            if (severity === 'error') {
                element.classList.add(ValidationMarkerClasses.ELEMENT_HAS_ERROR);
            } else if (severity === 'warning') {
                element.classList.add(ValidationMarkerClasses.ELEMENT_HAS_WARNING);
            } else if (severity === 'info' || severity === 'hint') {
                element.classList.add(ValidationMarkerClasses.ELEMENT_HAS_INFO);
            }
        });
    }

    /**
     * Show tooltip with marker details.
     */
    protected showTooltip(markers: ValidationMarker[], event: MouseEvent): void {
        if (!this.tooltipElement) {
            return;
        }

        // Build tooltip content
        const content = markers.map(m => `
            <div class="marker-tooltip-item ${m.severity}">
                <span class="codicon ${this.getSeverityIcon(m.severity)}"></span>
                <span class="message">${this.escapeHtml(m.message)}</span>
            </div>
        `).join('');

        this.tooltipElement.innerHTML = content;
        this.tooltipElement.style.display = 'block';
        this.tooltipElement.style.left = `${event.clientX + 10}px`;
        this.tooltipElement.style.top = `${event.clientY + 10}px`;
    }

    /**
     * Hide tooltip.
     */
    protected hideTooltip(): void {
        if (this.tooltipElement) {
            this.tooltipElement.style.display = 'none';
        }
    }

    /**
     * Navigate to a marker in the source.
     */
    protected navigateToMarker(elementId: string): void {
        this.dispatch(NavigateToMarkerAction.create(elementId));
    }

    /**
     * Clear decorations for a specific element.
     */
    protected clearDecorationsForElement(elementId: string): void {
        const decorations = this.decorations.get(elementId);
        if (decorations) {
            decorations.forEach(d => d.remove());
            this.decorations.delete(elementId);
        }
    }

    /**
     * Clear all decorations.
     */
    protected clearAllDecorations(): void {
        this.decorations.forEach(decorations => {
            decorations.forEach(d => d.remove());
        });
        this.decorations.clear();
    }

    /**
     * Escape HTML for tooltip.
     */
    protected escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Called when model changes.
     */
    override modelChanged(model: SModelRootImpl): void {
        this.model = model;

        // Debounce validation request
        if (this.validationDebounceTimer) {
            clearTimeout(this.validationDebounceTimer);
        }

        this.validationDebounceTimer = setTimeout(() => {
            this.renderMarkerDecorations();
        }, 500);
    }

    /**
     * Dispose the extension.
     */
    override dispose(): void {
        if (this.validationDebounceTimer) {
            clearTimeout(this.validationDebounceTimer);
        }
        this.clearAllDecorations();
        this.markers.clear();
        super.dispose();
    }
}
