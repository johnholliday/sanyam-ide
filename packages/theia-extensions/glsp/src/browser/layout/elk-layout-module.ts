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
    ILayoutPreprocessor,
    ILayoutPostprocessor,
} from 'sprotty-elk';
import ElkConstructor from 'elkjs/lib/elk.bundled.js';
import { TYPES, configureActionHandler } from 'sprotty';
import type { LayoutOptions } from 'elkjs/lib/elk-api';
import type { SGraph, SNode, SEdge, SPort, SLabel } from 'sprotty-protocol/lib/model';
import type { SModelIndex } from 'sprotty-protocol/lib/utils/model-utils';
import { LayoutActionHandler } from './layout-action-handler';
import { RequestLayoutAction } from './layout-actions';
import { EdgeRoutingService, EdgeRoutingServiceSymbol } from './edge-routing-service';

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
    'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    'elk.padding': '[top=30,left=30,bottom=30,right=30]',
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

    /**
     * Set the edge routing service for dynamic edge routing configuration.
     */
    setEdgeRoutingService(service: EdgeRoutingService): void {
        this.edgeRoutingService = service;
    }

    /**
     * Apply layout options based on element type.
     */
    protected override graphOptions(
        sgraph: SGraph,
        index: SModelIndex
    ): LayoutOptions | undefined {
        const edgeRouting = this.edgeRoutingService?.getElkEdgeRouting() ?? 'ORTHOGONAL';
        return {
            ...DEFAULT_LAYOUT_OPTIONS,
            'elk.edgeRouting': edgeRouting,
        };
    }

    /**
     * Configure node-specific layout options.
     */
    protected override nodeOptions(
        snode: SNode,
        index: SModelIndex
    ): LayoutOptions | undefined {
        // Nodes should have consistent sizing
        return {
            'elk.nodeSize.constraints': 'MINIMUM_SIZE',
            'elk.nodeSize.minimum': '(150, 75)',
            'elk.portConstraints': 'FIXED_SIDE',
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
        return {
            'elk.nodeLabels.placement': 'INSIDE V_CENTER H_CENTER',
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

        // Bind element filter
        bind(IElementFilter).to(DefaultElementFilter).inSingletonScope();

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
                const layoutPreprocessor = ctx.container.isBound(ILayoutPreprocessor)
                    ? ctx.container.get<any>(ILayoutPreprocessor) : undefined;
                const layoutPostprocessor = ctx.container.isBound(ILayoutPostprocessor)
                    ? ctx.container.get<any>(ILayoutPostprocessor) : undefined;
                logger.info('Creating engine instance...');
                const engine = new ElkLayoutEngine(elkFactory, elementFilter, layoutConfigurator, layoutPreprocessor, layoutPostprocessor);
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
