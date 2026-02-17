/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Sanyam Move Command
 *
 * Extends Sprotty's MoveCommand to provide live edge re-routing during
 * node drag operations and obstacle-aware repair on drag completion.
 *
 * Key behaviors:
 * - When BOTH endpoints of an edge move together: shifts routing points
 *   by delta (same as stock MoveCommand)
 * - When ONE endpoint moves: clears routingPoints to force fresh route
 *   computation on every render frame, preventing stale/janky edges
 *
 * @packageDocumentation
 */

import { injectable } from 'inversify';
import type { Point } from 'sprotty-protocol/lib/utils/geometry';
import { MoveCommand } from 'sprotty/lib/features/move/move';
import type { SRoutableElementImpl } from 'sprotty/lib/features/routing/model';
import { isSelectable } from 'sprotty/lib/features/select/model';
import type { ResolvedHandleMove } from 'sprotty/lib/features/move/move';

@injectable()
export class SanyamMoveCommand extends MoveCommand {

    /**
     * Override doMove to clear routing points on partially-moved edges
     * instead of calling cleanupRoutingPoints. This forces the edge
     * router to compute a fresh route on every frame during drag.
     */
    protected override doMove(
        edge2move: Map<SRoutableElementImpl, ResolvedHandleMove[]>,
        attachedEdgeShifts: Map<SRoutableElementImpl, Point>
    ): void {
        // Apply element position changes (same as parent)
        this.resolvedMoves.forEach(res => {
            res.element.position = res.toPosition;
        });

        // Handle directly-moved edges (routing handle drag) — same as parent
        edge2move.forEach((moves, edge) => {
            const router = this.edgeRouterRegistry!.get(edge.routerKind);
            const before = router.takeSnapshot(edge);
            router.applyHandleMoves(edge, moves);
            const after = router.takeSnapshot(edge);
            this.edgeMementi.push({ edge, before, after });
        });

        // Handle edges attached to moved nodes
        attachedEdgeShifts.forEach((delta, edge) => {
            if (!edge2move.get(edge)) {
                const router = this.edgeRouterRegistry!.get(edge.routerKind);
                const before = router.takeSnapshot(edge);

                if (this.isAttachedEdge(edge)) {
                    // Both endpoints move together → shift all routing points by delta
                    edge.routingPoints = edge.routingPoints.map(rp => ({
                        x: rp.x + delta.x,
                        y: rp.y + delta.y,
                    }));
                } else {
                    // Only one endpoint moves → clear routing points to force
                    // the router to compute a fresh route from scratch.
                    // This eliminates janky stale routing during drag.
                    edge.routingPoints = [];

                    // If the edge is selected and drag is finished, let the
                    // router create proper routing handles
                    if (this.action.finished) {
                        const updateHandles = isSelectable(edge) && edge.selected;
                        router.cleanupRoutingPoints(edge, edge.routingPoints, updateHandles, true);
                    }
                }

                const after = router.takeSnapshot(edge);
                this.edgeMementi.push({ edge, before, after });
            }
        });
    }

}
