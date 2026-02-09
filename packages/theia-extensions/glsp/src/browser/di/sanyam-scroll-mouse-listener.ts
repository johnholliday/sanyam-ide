/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Custom scroll mouse listener that supports disabling scroll/pan behavior.
 *
 * This is needed to prevent diagram panning while marquee selection is active.
 * Sprotty's MouseTool dispatches events to ALL registered MouseListeners,
 * so returning `[]` from MarqueeMouseListener does not prevent
 * ScrollMouseListener from also handling the event and panning.
 *
 * @packageDocumentation
 */

import { injectable } from 'inversify';
import { ScrollMouseListener } from 'sprotty/lib/features/viewport/scroll';
import { SModelElementImpl } from 'sprotty';
import { Action } from 'sprotty-protocol';

/**
 * Extended ScrollMouseListener with a flag to prevent scrolling.
 *
 * When `preventScrolling` is true, mouseDown returns `[]` so that
 * `lastScrollPosition` is never captured and subsequent mouseMove
 * events do not cause panning.
 *
 * Also ignores right-click (button 2) to allow context menu to work.
 */
@injectable()
export class SanyamScrollMouseListener extends ScrollMouseListener {
    /** When true, mouseDown is suppressed to prevent panning. */
    preventScrolling = false;

    override mouseDown(target: SModelElementImpl, event: MouseEvent): (Action | Promise<Action>)[] {
        if (this.preventScrolling) {
            return [];
        }
        // Ignore right-click (button 2) to allow context menu
        if (event.button === 2) {
            return [];
        }
        return super.mouseDown(target, event);
    }

    override mouseMove(target: SModelElementImpl, event: MouseEvent): Action[] {
        if (this.preventScrolling) {
            return [];
        }
        return super.mouseMove(target, event);
    }
}
