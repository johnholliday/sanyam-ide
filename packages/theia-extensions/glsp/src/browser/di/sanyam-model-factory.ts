/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Sanyam Model Factory
 *
 * Custom Sprotty model factory that normalizes grammar-specific element types
 * to base types for view lookup, while preserving the original type for CSS targeting.
 *
 * @packageDocumentation
 */

import { injectable, inject, optional } from 'inversify';
import { createLogger } from '@sanyam/logger';
import {
    SModelFactory,
    SEdgeImpl,
    SCompartmentImpl,
    SParentElementImpl,
    SChildElementImpl,
    SModelRootImpl,
} from 'sprotty';
import type { SModelElement, SModelRoot } from 'sprotty-protocol';
import { EdgeRoutingService, EdgeRoutingServiceSymbol } from '../layout/edge-routing-service';

/**
 * Extended edge class with Sanyam-specific properties.
 */
export class SanyamEdgeImpl extends SEdgeImpl {
    cssClasses?: string[];
    edgeType?: string;
}

/**
 * Extended compartment class with Sanyam-specific properties.
 */
export class SanyamCompartmentImpl extends SCompartmentImpl {
    cssClasses?: string[];
}

/**
 * Custom model factory that normalizes grammar-specific types to base types.
 *
 * This approach:
 * 1. Transforms the schema to normalize types (e.g., "node:entity" -> "node")
 * 2. Preserves the original type in a custom property (nodeType, cssClasses)
 * 3. Lets Sprotty's default factory handle element creation and parent-child relationships
 */
@injectable()
export class SanyamModelFactory extends SModelFactory {
    protected readonly logger = createLogger({ name: 'ModelFactory' });

    @inject(EdgeRoutingServiceSymbol) @optional()
    protected readonly edgeRoutingService: EdgeRoutingService | undefined;

    createElement(schema: SModelElement, parent?: SParentElementImpl): SChildElementImpl {
        const originalType = schema.type;

        // Normalize the type for view lookup
        const normalizedType = this.normalizeTypeForView(originalType);

        // Create a modified schema with normalized type and preserved original
        const normalizedSchema = this.createNormalizedSchema(schema, normalizedType, originalType);

        this.logger.debug({ id: schema.id, originalType, normalizedType, parent: parent?.id ?? 'none' }, 'createElement');

        try {
            // Let Sprotty's default factory handle everything
            const element = super.createElement(normalizedSchema, parent);
            this.logger.debug({ id: element.id, type: element.type, hasParent: !!element.parent }, 'Created element');
            return element;
        } catch (error) {
            this.logger.error({ err: error, id: schema.id }, 'Error creating element');
            throw error;
        }
    }

    createRoot(schema: SModelRoot | SModelRootImpl): SModelRootImpl {
        this.logger.debug({ id: schema.id, type: schema.type, children: (schema as any).children?.length ?? 0 }, 'createRoot');

        try {
            // For root, just pass through (type 'graph' doesn't need normalization)
            const root = super.createRoot(schema);

            this.logger.debug({ childCount: root.children.length }, 'Created root');

            // Log first few children for debugging
            if (root.children.length > 0) {
                this.logger.debug({ id: root.children[0]?.id, type: root.children[0]?.type }, 'First child');
            }

            return root;
        } catch (error) {
            this.logger.error({ err: error }, 'Error in createRoot');
            throw error;
        }
    }

    /**
     * Create a normalized schema with transformed type and preserved original type.
     */
    private createNormalizedSchema(schema: SModelElement, normalizedType: string, originalType: string): SModelElement {
        const normalizedSchema: any = { ...schema, type: normalizedType };

        // Detect container nodes: nodes with 'sanyam-container' CSS class
        const isContainer = this.isNodeType(originalType) &&
            Array.isArray(normalizedSchema.cssClasses) &&
            normalizedSchema.cssClasses.includes('sanyam-container');

        if (isContainer) {
            // Container nodes get their own type for view lookup
            normalizedSchema.type = 'node:container';
        }

        // Preserve original type for CSS targeting
        if (this.isNodeType(originalType) && !this.isButtonType(originalType)) {
            normalizedSchema.nodeType = originalType;
            // Add CSS class based on original type
            const cssClass = originalType.replace(':', '-');
            normalizedSchema.cssClasses = [...(normalizedSchema.cssClasses || []), cssClass];
        } else if (this.isEdgeType(originalType)) {
            normalizedSchema.edgeType = originalType;
            // Add CSS class based on edge subtype (e.g., edge:reference → 'reference')
            const subtype = originalType.includes(':') ? originalType.split(':')[1] : undefined;
            if (subtype) {
                normalizedSchema.cssClasses = [...(normalizedSchema.cssClasses || []), subtype];
            }
            if (this.edgeRoutingService) {
                normalizedSchema.routerKind = this.edgeRoutingService.getSprottyRouterKind();
            }
        }

        // Recursively normalize children
        if (schema.children && schema.children.length > 0) {
            normalizedSchema.children = schema.children.map((child: SModelElement) => {
                const childNormalizedType = this.normalizeTypeForView(child.type);
                return this.createNormalizedSchema(child, childNormalizedType, child.type);
            });
        }

        return normalizedSchema;
    }

    /**
     * Normalize type for view lookup.
     * Maps grammar-specific types to base types that have registered views.
     */
    protected normalizeTypeForView(type: string): string {
        // Button types pass through — they need exact type match for handler registration
        if (this.isButtonType(type)) {
            return type;
        }
        if (this.isNodeType(type)) {
            return 'node';
        }
        if (this.isEdgeType(type)) {
            return 'edge';
        }
        if (this.isLabelType(type)) {
            return 'label';
        }
        if (this.isCompartmentType(type)) {
            return 'compartment';
        }
        if (this.isPortType(type)) {
            return 'port';
        }
        return type;
    }

    /**
     * Check if type represents a button.
     */
    protected isButtonType(type: string): boolean {
        return type === 'button' || type.startsWith('button:');
    }

    /**
     * Check if type represents a node.
     */
    protected isNodeType(type: string): boolean {
        if (type === 'node' || type.startsWith('node:')) {
            return true;
        }
        // Grammar-specific types (e.g., "spdevkit:Application") that aren't edges/labels/etc
        if (type.includes(':') &&
            !this.isEdgeType(type) &&
            !this.isLabelType(type) &&
            !this.isCompartmentType(type) &&
            !this.isPortType(type) &&
            !this.isButtonType(type) &&
            type !== 'graph') {
            return true;
        }
        return false;
    }

    /**
     * Check if type represents an edge.
     */
    protected isEdgeType(type: string): boolean {
        return type === 'edge' || type.startsWith('edge:');
    }

    /**
     * Check if type represents a label.
     */
    protected isLabelType(type: string): boolean {
        return type === 'label' || type.startsWith('label:');
    }

    /**
     * Check if type represents a compartment.
     */
    protected isCompartmentType(type: string): boolean {
        return type === 'compartment' ||
               type.startsWith('comp:') ||
               type.startsWith('compartment:');
    }

    /**
     * Check if type represents a port.
     */
    protected isPortType(type: string): boolean {
        return type === 'port' || type.startsWith('port:');
    }
}
