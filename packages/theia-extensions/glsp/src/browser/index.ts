/**
 * GLSP Browser Package Index
 *
 * Exports all browser-side GLSP components including diagram widget and composite editor.
 *
 * @packageDocumentation
 */

// CSS imports
import './style/index.css';
import './style/sprotty.css';

// Diagram exports
export * from './glsp-frontend-module';
export * from './diagram-widget';
export * from './glsp-commands';
export * from './glsp-menus';

// Composite editor exports
export * from './composite-editor-widget';
export * from './composite-editor-open-handler';
export * from './composite-editor-contribution';
export * from './composite-editor-context-key-service';

// Language client exports
export * from './diagram-language-client';
export * from './sanyam-language-client-provider';

// Diagram preferences exports
export * from './diagram-preferences';

// Sprotty DI configuration exports (excluding GModelRoot to avoid conflict)
export {
    DIAGRAM_ID,
    SanyamModelTypes,
    SanyamNode,
    SanyamEdge,
    SanyamLabel,
    SanyamCompartment,
    DiagramEventCallbacks,
    SanyamMouseListener,
    CreateDiagramContainerOptions,
    createSanyamDiagramContainer,
    SprottyDiagramManager,
    Container,
    TYPES,
    LocalModelSource,
    SGraph,
    SNode,
    SEdge,
    SLabel,
    SCompartment,
    SModelRoot,
    SetModelAction,
    UpdateModelAction,
    Action,
} from './di/sprotty-di-config';

// Re-export GModelRoot from sprotty-di-config with an alias to avoid conflict
export type { GModelRoot as SprottyGModelRoot } from './di/sprotty-di-config';

// UI Extensions exports
export * from './ui-extensions';
