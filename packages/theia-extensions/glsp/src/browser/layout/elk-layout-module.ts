/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * ELK Layout Module
 *
 * Configures the ELK (Eclipse Layout Kernel) for automatic diagram layout.
 * Provides a layered layout algorithm suitable for most diagram types.
 *
 * @packageDocumentation
 */

import { createLogger } from '@sanyam/logger';
import { ContainerModule } from 'inversify';
import {
    ElkFactory,
    ElkLayoutEngine,
    ILayoutConfigurator,
    IElementFilter,
    DefaultLayoutConfigurator,
    DefaultElementFilter,
} from 'sprotty-elk';
import ElkConstructor from 'elkjs/lib/elk.bundled.js';
import { TYPES, configureActionHandler } from 'sprotty';
import type { LayoutOptions } from 'elkjs/lib/elk-api';
import type { SGraph, SNode, SEdge, SPort, SLabel } from 'sprotty-protocol/lib/model';
import type { SModelIndex } from 'sprotty-protocol/lib/utils/model-utils';
import { LayoutActionHandler } from './layout-action-handler';
import { RequestLayoutAction } from './layout-actions';
import { EdgeRoutingService, EdgeRoutingServiceSymbol } from './edge-routing-service';
import { SanyamElementFilter, EdgeBundlePostprocessor } from './edge-bundle-layout';

/**
 * Symbol for the ELK layout engine.
 */
export const ELK_LAYOUT_ENGINE = Symbol.for('ElkLayoutEngine');

/**
 * Default ELK layout options for Sanyam diagrams.
 */
export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
    'elk.algorithm': 'layered',
    'elk.direction': 'DOWN',
    'elk.spacing.nodeNode': '75',
    'elk.spacing.edgeNode': '45',
    'elk.layered.spacing.nodeNodeBetweenLayers': '105',
    'elk.layered.spacing.edgeNodeBetweenLayers': '45',
    'elk.edgeRouting': 'ORTHOGONAL',
    'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    // Extra crossing reduction pass after layer sweep
    'elk.layered.crossingMinimization.greedySwitch.type': 'TWO_SIDED',
    'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    'elk.padding': '[top=30,left=30,bottom=30,right=30]',
    // Handle disconnected components: place each subgraph independently
    'elk.separateConnectedComponents': 'true',
    'elk.spacing.componentComponent': '75',
    // Preserve document order within layers for intuitive node placement
    'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
};

/**
 * Layout options presets for different diagram types.
 * Valid algorithms: layered, stress, mrtree, radial, force, disco,
 * sporeOverlap, sporeCompaction, rectpacking, vertiflex
 */
export const LayoutPresets = {
    /** Top-to-bottom layered layout (default) */
    LAYERED_DOWN: {
        'elk.algorithm': 'layered',
        'elk.direction': 'DOWN',
    } as LayoutOptions,

    /** Left-to-right layered layout */
    LAYERED_RIGHT: {
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT',
    } as LayoutOptions,

    /** Force-directed layout for organic diagrams */
    FORCE: {
        'elk.algorithm': 'force',
        'elk.force.iterations': '300',
    } as LayoutOptions,

    /** Rectangle packing layout for simple arrangements */
    RECTPACKING: {
        'elk.algorithm': 'rectpacking',
        'elk.spacing.nodeNode': '30',
    } as LayoutOptions,

    /** Radial layout for tree-like structures */
    RADIAL: {
        'elk.algorithm': 'radial',
    } as LayoutOptions,

    /** Stress-based layout */
    STRESS: {
        'elk.algorithm': 'stress',
    } as LayoutOptions,
} as const;

/**
 * Sanyam-specific layout configurator.
 *
 * Extends the default ELK layout configurator to provide
 * custom layout options for different element types.
 */
export class SanyamLayoutConfigurator extends DefaultLayoutConfigurator {
    private edgeRoutingService: EdgeRoutingService | undefined;
    private algorithmOverride: string | undefined;
    private directionOverride: string | undefined;

    /**
     * Set the edge routing service for dynamic edge routing configuration.
     */
    setEdgeRoutingService(service: EdgeRoutingService): void {
        this.edgeRoutingService = service;
    }

    /**
     * Set per-request layout overrides (algorithm and/or direction).
     * Call {@link clearLayoutOverrides} after the layout completes.
     */
    setLayoutOverrides(algorithm?: string, direction?: string): void {
        this.algorithmOverride = algorithm;
        this.directionOverride = direction;
    }

    /**
     * Clear any per-request layout overrides.
     */
    clearLayoutOverrides(): void {
        this.algorithmOverride = undefined;
        this.directionOverride = undefined;
    }

    /**
     * Apply layout options based on element type.
     */
    protected override graphOptions(
        sgraph: SGraph,
        index: SModelIndex
    ): LayoutOptions | undefined {
        const edgeRouting = this.edgeRoutingService?.getElkEdgeRouting() ?? 'ORTHOGONAL';
        const options: LayoutOptions = {
            ...DEFAULT_LAYOUT_OPTIONS,
            'elk.edgeRouting': edgeRouting,
        };
        // Non-orthogonal modes (polyline/splines) need extra edge-node clearance
        // because diagonal/curved edges don't benefit from the grid-aligned
        // avoidance that orthogonal routing provides.
        if (edgeRouting === 'POLYLINE' || edgeRouting === 'SPLINES') {
            options['elk.spacing.edgeNode'] = '55';
            options['elk.layered.spacing.edgeNodeBetweenLayers'] = '55';
        }
        if (this.algorithmOverride) {
            options['elk.algorithm'] = this.algorithmOverride;
        }
        if (this.directionOverride) {
            options['elk.direction'] = this.directionOverride;
        }
        return options;
    }

    /**
     * Configure node-specific layout options.
     *
     * Detects compound nodes (container nodes with compartment children)
     * and applies larger minimum size and extra top padding for the header bar.
     */
    protected override nodeOptions(
        snode: SNode,
        index: SModelIndex
    ): LayoutOptions | undefined {
        // Detect compound nodes via the 'sanyam-container' CSS class.
        // NOTE: We cannot check child types like 'compartment:header' because
        // the model factory normalizes them to 'compartment' before ELK sees them.
        const isCompound = Array.isArray((snode as any).cssClasses) &&
            (snode as any).cssClasses.includes('sanyam-container');

        if (isCompound) {
            const isCollapsed = Array.isArray((snode as any).cssClasses) &&
                (snode as any).cssClasses.includes('collapsed');

            // Compute minimum width from header label text so the label is
            // never clipped. Header layout:
            //   [pad 8] [icon 16] [gap 6] [label ...] [gap 6] [button 16] [pad 8] = 60 + label
            const HEADER_FIXED_WIDTH = 60;
            const CHAR_WIDTH_ESTIMATE = 10; // conservative estimate for 14px font-weight:600
            const headerComp = (snode.children ?? []).find(
                (c: any) => c.id?.endsWith('_header')
            );
            let labelText = '';
            if (headerComp && Array.isArray((headerComp as any).children)) {
                const label = (headerComp as any).children.find(
                    (c: any) => c.type?.includes('label')
                );
                if (label?.text) {
                    labelText = label.text as string;
                    // Strip surrounding quotes (matching the view's logic)
                    if (labelText.startsWith('"') && labelText.endsWith('"') && labelText.length >= 2) {
                        labelText = labelText.slice(1, -1);
                    }
                }
            }
            const labelMinWidth = Math.ceil(
                HEADER_FIXED_WIDTH + Math.max(labelText.length, 3) * CHAR_WIDTH_ESTIMATE
            );
            const minWidth = Math.max(labelMinWidth, snode.size?.width ?? 160);

            if (isCollapsed) {
                // Collapsed: leaf node sized to header only
                return {
                    'elk.nodeSize.constraints': 'MINIMUM_SIZE',
                    'elk.nodeSize.minimum': `(${minWidth}, 32)`,
                    'elk.portConstraints': 'FIXED_SIDE',
                };
            }

            // Expanded: compound node — ELK positions children with padding.
            // Override spacing because the global values (nodeNode: 75, between-layers: 105)
            // propagate into containers via INCLUDE_CHILDREN and make the body far too tall.
            return {
                'elk.nodeSize.constraints': 'MINIMUM_SIZE NODE_LABELS',
                'elk.nodeSize.minimum': `(${minWidth}, 60)`,
                'elk.portConstraints': 'FIXED_SIDE',
                'elk.padding': '[top=40,left=12,bottom=12,right=12]',
                'elk.nodeLabels.placement': 'INSIDE V_TOP H_LEFT',
                'elk.spacing.nodeNode': '20',
                'elk.layered.spacing.nodeNodeBetweenLayers': '40',
            };
        }

        // Regular nodes
        // NOTE: elk.nodeLabels.placement is a PARENT property — it must be set
        // on the node, NOT on the label (labelOptions() has no effect for this).
        // NODE_LABELS in the size constraints tells ELK to grow the node to fit labels.

        // Non-rectangular shapes need larger bounding boxes because the polygon
        // doesn't fill the entire rectangular area.
        const shape: string = (snode as any).shape ?? 'rectangle';
        let minW = 150;
        let minH = 75;
        if (shape === 'diamond') {
            minW = 270;  // ~1.8×150
            minH = 135;  // ~1.8×75
        } else if (shape === 'hexagon') {
            minW = 210;  // ~1.4×150
            minH = 75;   // height unchanged (hexagon is full-width at center)
        }

        return {
            'elk.nodeSize.constraints': 'MINIMUM_SIZE NODE_LABELS',
            'elk.nodeSize.minimum': `(${minW}, ${minH})`,
            'elk.portConstraints': 'FIXED_SIDE',
            'elk.nodeLabels.placement': 'INSIDE V_CENTER H_CENTER',
        };
    }

    /**
     * Configure edge-specific layout options.
     */
    protected override edgeOptions(
        sedge: SEdge,
        index: SModelIndex
    ): LayoutOptions | undefined {
        return {
            'elk.edge.thickness': '1',
        };
    }

    /**
     * Configure port-specific layout options.
     */
    protected override portOptions(
        sport: SPort,
        index: SModelIndex
    ): LayoutOptions | undefined {
        return {
            'elk.port.borderOffset': '3',
        };
    }

    /**
     * Configure label-specific layout options.
     */
    protected override labelOptions(
        slabel: SLabel,
        index: SModelIndex
    ): LayoutOptions | undefined {
        // NOTE: elk.nodeLabels.placement is a PARENT property (set on nodes, not labels).
        // Setting it here has no effect — see nodeOptions() instead.
        return {
            'elk.edgeLabels.placement': 'CENTER',
        };
    }
}

/**
 * Create the ELK layout container module.
 *
 * @param customOptions - Optional custom layout options to merge with defaults
 * @returns Inversify container module with ELK layout bindings
 */
const logger = createLogger({ name: 'ElkLayout' });

export function createElkLayoutModule(customOptions?: LayoutOptions, edgeRoutingService?: EdgeRoutingService): ContainerModule {
    return new ContainerModule((bind, unbind, isBound, rebind) => {
        const context = { bind, unbind, isBound, rebind };

        // Bind ELK factory to create ELK instances
        // Valid algorithms: layered, stress, mrtree, radial, force, disco,
        // sporeOverlap, sporeCompaction, rectpacking, vertiflex
        bind(ElkFactory).toConstantValue(() => {
            logger.info('ElkFactory called, creating ELK instance...');
            try {
                const elk = new ElkConstructor({
                    algorithms: ['layered', 'force', 'rectpacking', 'radial', 'stress'],
                });
                logger.info('ELK instance created successfully');
                return elk;
            } catch (error) {
                logger.error({ err: error }, 'Failed to create ELK instance');
                throw error;
            }
        });

        // Bind element filter — excludes junction nodes and trunk/branch edges
        // from ELK layout (they are positioned by the postprocessor instead)
        bind(IElementFilter).to(SanyamElementFilter).inSingletonScope();

        // Bind layout configurator with our custom one
        bind(SanyamLayoutConfigurator).toSelf().inSingletonScope();
        bind(ILayoutConfigurator).toService(SanyamLayoutConfigurator);

        // Bind edge routing service if provided, and wire it into the configurator
        if (edgeRoutingService) {
            bind(EdgeRoutingServiceSymbol).toConstantValue(edgeRoutingService);
        }

        // Bind ELK layout engine using dynamic value to properly inject dependencies
        bind(ElkLayoutEngine).toDynamicValue(ctx => {
            logger.info('Creating ElkLayoutEngine...');
            try {
                const elkFactory = ctx.container.get<() => any>(ElkFactory);
                logger.info('Got elkFactory');
                const elementFilter = ctx.container.get<any>(IElementFilter);
                logger.info('Got elementFilter');
                const layoutConfigurator = ctx.container.get<SanyamLayoutConfigurator>(SanyamLayoutConfigurator);
                if (edgeRoutingService) {
                    layoutConfigurator.setEdgeRoutingService(edgeRoutingService);
                }
                logger.info('Got layoutConfigurator');
                logger.info('Creating engine instance...');
                const postprocessor = new EdgeBundlePostprocessor();
                const engine = new ElkLayoutEngine(elkFactory, elementFilter, layoutConfigurator, undefined, postprocessor);
                logger.info('ElkLayoutEngine created successfully');
                return engine;
            } catch (error) {
                logger.error({ err: error }, 'Failed to create ElkLayoutEngine');
                throw error;
            }
        }).inSingletonScope();

        bind(ELK_LAYOUT_ENGINE).toService(ElkLayoutEngine);
        bind(TYPES.IModelLayoutEngine).toService(ElkLayoutEngine);

        // Bind layout action handler
        bind(LayoutActionHandler).toSelf().inSingletonScope();
        configureActionHandler(context, RequestLayoutAction.KIND, LayoutActionHandler);
    });
}

/**
 * Re-export sprotty-elk types for convenience.
 */
export {
    ElkFactory,
    ElkLayoutEngine,
    ILayoutConfigurator,
    IElementFilter,
    DefaultLayoutConfigurator,
    DefaultElementFilter,
};
