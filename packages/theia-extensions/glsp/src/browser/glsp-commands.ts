/**
 * GLSP Diagram Commands (T086)
 *
 * Command contributions for diagram operations.
 *
 * @packageDocumentation
 */

import { injectable, inject } from 'inversify';
import { Command, CommandContribution, CommandRegistry } from '@theia/core/lib/common';
import { ApplicationShell } from '@theia/core/lib/browser';

import { GlspContribution } from '../common/glsp-contribution';
import { DiagramWidget } from './diagram-widget';

/**
 * Command IDs for diagram operations.
 */
export namespace DiagramCommands {
  export const OPEN_DIAGRAM: Command = {
    id: 'sanyam.diagram.open',
    label: 'Open Diagram View',
    category: 'Diagram',
  };

  export const CLOSE_DIAGRAM: Command = {
    id: 'sanyam.diagram.close',
    label: 'Close Diagram View',
    category: 'Diagram',
  };

  export const REFRESH_DIAGRAM: Command = {
    id: 'sanyam.diagram.refresh',
    label: 'Refresh Diagram',
    category: 'Diagram',
  };

  export const ZOOM_TO_FIT: Command = {
    id: 'sanyam.diagram.zoomToFit',
    label: 'Zoom to Fit',
    category: 'Diagram',
  };

  export const ZOOM_IN: Command = {
    id: 'sanyam.diagram.zoomIn',
    label: 'Zoom In',
    category: 'Diagram',
  };

  export const ZOOM_OUT: Command = {
    id: 'sanyam.diagram.zoomOut',
    label: 'Zoom Out',
    category: 'Diagram',
  };

  export const DELETE_SELECTED: Command = {
    id: 'sanyam.diagram.delete',
    label: 'Delete Selected Elements',
    category: 'Diagram',
  };

  export const SELECT_ALL: Command = {
    id: 'sanyam.diagram.selectAll',
    label: 'Select All',
    category: 'Diagram',
  };

  export const LAYOUT_DIAGRAM: Command = {
    id: 'sanyam.diagram.layout',
    label: 'Auto-Layout Diagram',
    category: 'Diagram',
  };

  export const EXPORT_SVG: Command = {
    id: 'sanyam.diagram.exportSvg',
    label: 'Export as SVG',
    category: 'Diagram',
  };

  export const EXPORT_PNG: Command = {
    id: 'sanyam.diagram.exportPng',
    label: 'Export as PNG',
    category: 'Diagram',
  };

  export const CENTER_VIEW: Command = {
    id: 'sanyam.diagram.centerView',
    label: 'Center View',
    category: 'Diagram',
  };

  export const TOGGLE_GRID: Command = {
    id: 'sanyam.diagram.toggleGrid',
    label: 'Toggle Grid',
    category: 'Diagram',
  };

  export const ALIGN_LEFT: Command = {
    id: 'sanyam.diagram.alignLeft',
    label: 'Align Left',
    category: 'Diagram',
  };

  export const ALIGN_CENTER: Command = {
    id: 'sanyam.diagram.alignCenter',
    label: 'Align Center',
    category: 'Diagram',
  };

  export const ALIGN_RIGHT: Command = {
    id: 'sanyam.diagram.alignRight',
    label: 'Align Right',
    category: 'Diagram',
  };

  export const ALIGN_TOP: Command = {
    id: 'sanyam.diagram.alignTop',
    label: 'Align Top',
    category: 'Diagram',
  };

  export const ALIGN_MIDDLE: Command = {
    id: 'sanyam.diagram.alignMiddle',
    label: 'Align Middle',
    category: 'Diagram',
  };

  export const ALIGN_BOTTOM: Command = {
    id: 'sanyam.diagram.alignBottom',
    label: 'Align Bottom',
    category: 'Diagram',
  };
}

/**
 * Command contributions for diagram operations.
 */
@injectable()
export class GlspDiagramCommands implements CommandContribution {
  @inject(ApplicationShell)
  protected readonly shell: ApplicationShell;

  @inject(GlspContribution)
  protected readonly glspContribution: GlspContribution;

  /**
   * Register commands.
   */
  registerCommands(registry: CommandRegistry): void {
    // Open diagram view
    registry.registerCommand(DiagramCommands.OPEN_DIAGRAM, {
      execute: () => this.openDiagram(),
      isEnabled: () => this.canOpenDiagram(),
      isVisible: () => this.canOpenDiagram(),
    });

    // Close diagram view
    registry.registerCommand(DiagramCommands.CLOSE_DIAGRAM, {
      execute: () => this.closeDiagram(),
      isEnabled: () => this.hasDiagramFocus(),
      isVisible: () => this.hasDiagramFocus(),
    });

    // Refresh diagram
    registry.registerCommand(DiagramCommands.REFRESH_DIAGRAM, {
      execute: () => this.refreshDiagram(),
      isEnabled: () => this.hasDiagramFocus(),
      isVisible: () => this.hasDiagramFocus(),
    });

    // Zoom commands
    registry.registerCommand(DiagramCommands.ZOOM_TO_FIT, {
      execute: () => this.zoomToFit(),
      isEnabled: () => this.hasDiagramFocus(),
    });

    registry.registerCommand(DiagramCommands.ZOOM_IN, {
      execute: () => this.zoomIn(),
      isEnabled: () => this.hasDiagramFocus(),
    });

    registry.registerCommand(DiagramCommands.ZOOM_OUT, {
      execute: () => this.zoomOut(),
      isEnabled: () => this.hasDiagramFocus(),
    });

    // Delete selected
    registry.registerCommand(DiagramCommands.DELETE_SELECTED, {
      execute: () => this.deleteSelected(),
      isEnabled: () => this.hasSelection(),
    });

    // Select all
    registry.registerCommand(DiagramCommands.SELECT_ALL, {
      execute: () => this.selectAll(),
      isEnabled: () => this.hasDiagramFocus(),
    });

    // Auto-layout
    registry.registerCommand(DiagramCommands.LAYOUT_DIAGRAM, {
      execute: () => this.layoutDiagram(),
      isEnabled: () => this.hasDiagramFocus(),
    });

    // Export commands
    registry.registerCommand(DiagramCommands.EXPORT_SVG, {
      execute: () => this.exportSvg(),
      isEnabled: () => this.hasDiagramFocus(),
    });

    registry.registerCommand(DiagramCommands.EXPORT_PNG, {
      execute: () => this.exportPng(),
      isEnabled: () => this.hasDiagramFocus(),
    });

    // View commands
    registry.registerCommand(DiagramCommands.CENTER_VIEW, {
      execute: () => this.centerView(),
      isEnabled: () => this.hasDiagramFocus(),
    });

    registry.registerCommand(DiagramCommands.TOGGLE_GRID, {
      execute: () => this.toggleGrid(),
      isEnabled: () => this.hasDiagramFocus(),
    });

    // Alignment commands
    this.registerAlignmentCommands(registry);
  }

  /**
   * Register alignment commands.
   */
  protected registerAlignmentCommands(registry: CommandRegistry): void {
    const alignmentCommands = [
      { command: DiagramCommands.ALIGN_LEFT, alignment: 'left' },
      { command: DiagramCommands.ALIGN_CENTER, alignment: 'center' },
      { command: DiagramCommands.ALIGN_RIGHT, alignment: 'right' },
      { command: DiagramCommands.ALIGN_TOP, alignment: 'top' },
      { command: DiagramCommands.ALIGN_MIDDLE, alignment: 'middle' },
      { command: DiagramCommands.ALIGN_BOTTOM, alignment: 'bottom' },
    ];

    for (const { command, alignment } of alignmentCommands) {
      registry.registerCommand(command, {
        execute: () => this.alignSelection(alignment),
        isEnabled: () => this.hasMultipleSelection(),
      });
    }
  }

  /**
   * Get active diagram widget.
   */
  protected getActiveDiagram(): DiagramWidget | undefined {
    const widget = this.shell.activeWidget;
    return widget instanceof DiagramWidget ? widget : undefined;
  }

  /**
   * Check if a diagram has focus.
   */
  protected hasDiagramFocus(): boolean {
    return this.getActiveDiagram() !== undefined;
  }

  /**
   * Check if current editor can be opened as diagram.
   */
  protected canOpenDiagram(): boolean {
    const activeWidget = this.shell.activeWidget;
    if (activeWidget && 'uri' in activeWidget) {
      return this.glspContribution.canOpenDiagram((activeWidget as any).uri);
    }
    return false;
  }

  /**
   * Check if there's a selection.
   */
  protected hasSelection(): boolean {
    const diagram = this.getActiveDiagram();
    return diagram ? diagram.getSelection().length > 0 : false;
  }

  /**
   * Check if there's multiple selection.
   */
  protected hasMultipleSelection(): boolean {
    const diagram = this.getActiveDiagram();
    return diagram ? diagram.getSelection().length > 1 : false;
  }

  // Command implementations

  protected async openDiagram(): Promise<void> {
    await this.glspContribution.openView({ activate: true });
  }

  protected closeDiagram(): void {
    const diagram = this.getActiveDiagram();
    diagram?.close();
  }

  protected refreshDiagram(): void {
    const diagram = this.getActiveDiagram();
    diagram?.refresh();
  }

  protected zoomToFit(): void {
    const diagram = this.getActiveDiagram();
    diagram?.zoomToFit();
  }

  protected zoomIn(): void {
    // Placeholder - would adjust zoom level
    console.log('Zoom in');
  }

  protected zoomOut(): void {
    // Placeholder - would adjust zoom level
    console.log('Zoom out');
  }

  protected deleteSelected(): void {
    const diagram = this.getActiveDiagram();
    if (diagram) {
      const selectedIds = diagram.getSelection();
      diagram.executeOperation({
        kind: 'delete',
        elementIds: selectedIds,
      });
    }
  }

  protected selectAll(): void {
    // Placeholder - would select all elements
    console.log('Select all');
  }

  protected layoutDiagram(): void {
    const diagram = this.getActiveDiagram();
    if (diagram) {
      diagram.executeOperation({
        kind: 'layout',
        algorithm: 'tree',
      });
    }
  }

  protected exportSvg(): void {
    // Placeholder - would export diagram as SVG
    console.log('Export SVG');
  }

  protected exportPng(): void {
    // Placeholder - would export diagram as PNG
    console.log('Export PNG');
  }

  protected centerView(): void {
    const diagram = this.getActiveDiagram();
    diagram?.zoomToFit();
  }

  protected toggleGrid(): void {
    // Placeholder - would toggle grid visibility
    console.log('Toggle grid');
  }

  protected alignSelection(alignment: string): void {
    const diagram = this.getActiveDiagram();
    if (diagram) {
      diagram.executeOperation({
        kind: 'align',
        alignment,
        elementIds: diagram.getSelection(),
      });
    }
  }
}
