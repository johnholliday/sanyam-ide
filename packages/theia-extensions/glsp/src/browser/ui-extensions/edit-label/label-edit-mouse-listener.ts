/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Label Edit Mouse Listener
 *
 * Handles double-click events for label editing.
 *
 * @packageDocumentation
 */

import { createLogger } from '@sanyam/logger';
import { injectable, inject } from 'inversify';
import {
    MouseListener,
    SModelElementImpl,
    SLabelImpl,
    TYPES,
    IActionDispatcher,
} from 'sprotty';
import { Action } from 'sprotty-protocol';
import { EditLabelAction } from './edit-label-actions';

/**
 * Mouse listener that handles double-clicks for label editing.
 */
@injectable()
export class LabelEditMouseListener extends MouseListener {
    protected readonly logger = createLogger({ name: 'LabelEditListener' });

    @inject(TYPES.IActionDispatcher)
    protected actionDispatcher!: IActionDispatcher;

    /**
     * Handle double-click events for label editing.
     */
    override doubleClick(target: SModelElementImpl, event: MouseEvent): (Action | Promise<Action>)[] {
        // Find the label element (target or ancestor)
        const label = this.findEditableLabel(target);
        if (label) {
            this.logger.info({ labelId: label.id }, 'Double-click on label');
            // Prevent default browser behavior (text selection)
            event.preventDefault();
            event.stopPropagation();
            return [EditLabelAction.create(label.id)];
        }

        // Also check if the target is a node with a label child
        const nodeLabel = this.findNodeLabel(target);
        if (nodeLabel) {
            this.logger.info({ labelId: nodeLabel.id }, 'Double-click on node, found label');
            event.preventDefault();
            event.stopPropagation();
            return [EditLabelAction.create(nodeLabel.id)];
        }

        return [];
    }

    /**
     * Find an editable label from the target or its ancestors.
     */
    protected findEditableLabel(target: SModelElementImpl): SLabelImpl | undefined {
        let current: SModelElementImpl | undefined = target;
        while (current) {
            if (current instanceof SLabelImpl) {
                return current;
            }
            // Also check for elements with 'label' type
            if (current.type?.includes('label')) {
                return current as unknown as SLabelImpl;
            }
            // Access parent
            const parent = (current as any).parent;
            current = parent as SModelElementImpl | undefined;
        }
        return undefined;
    }

    /**
     * Find a label child of a node.
     */
    protected findNodeLabel(target: SModelElementImpl): SLabelImpl | undefined {
        // Check if target has children that are labels
        const children = (target as any).children as SModelElementImpl[] | undefined;
        if (children) {
            for (const child of children) {
                if (child instanceof SLabelImpl) {
                    return child;
                }
                if (child.type?.includes('label')) {
                    return child as unknown as SLabelImpl;
                }
            }
        }
        return undefined;
    }
}
