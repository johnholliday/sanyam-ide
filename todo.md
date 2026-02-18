### Auto-Layout

The auto-layout function may be grammar-specific, with a preferred ELK layout style.
Explore how to specify this declaratively as part of the grammar manifest.

### Click Diagram Canvas

Clicking and releasing the mouse cursor anywhere on the diagram canvas background MUST deselect any selected items, but not when dragging.

### Double-Click Diagram Canvas

Wire up a canvas double-click handler that opens a quick-pick or mini-menu at the click position. This is how tools like Miro and FigJam work — very low friction.

### Double-Click Diagram Node

Double-clicking a node in the diagram should shift focus to the text editor (making it visible if necessary), and then navigate to the corresponding object in the text editor

### Editing Property Values

Editing property values in the properties panel fails to update the model in the text editor or in the diagram canvas.

### Progress Bar

When a long operation is invoked (such as a large diagram being loaded), the VS Code progress bar is not visible.

### Property Hierarchy

Add expand/collapse button on parent nodes in the property view.
Indent child nodes in the property view.

### Tools Palette

Tools palette icons are inconsistent and do not match the node icons.

### Forms

Add dynamic forms support in a licensable @sanyam/forms package and enables users to create one or more custom SurveyJS forms to gather raw JSON data and save it as part of a project.  This is implemented using the SurveyJS forms editor package, which requires a license key.  Suggest the best way to secure the key in production at runtime, since it must be embedded in the bundled app or retrieved from a docuGenix key vault.

### Licensed Importer Packages

Add a licensed runtime import package (@sanyam/import-core) that use the integrated AI support to read a JSON or Markdown data file to produce a validated grammar file that captures the semantic content of the imported data.

Add a licensed import package for Microsoft Word and Excel files (@sanyam/import-msoffice).  Requires @sanyam/import-core for AI integration and import utility functions.

### Context Menus

Add grammar-driven diagram node context menus that present both generic commands and custom operations that are relevant to each node type.  Generic commands include cut/copy/paste/print/goto source.  Custom operations include the ability to insert child objects (filtered by valid child types for the selected node).

### Undo/Redo

Add undo/redo buttons to the floating toolbar in the bottom left corner, and to the tools panel, and enable ctrl+z + ctrl+y as default keymappings.

### Authentication

~~GitHub authentication fails.  Azure authentication is only partially configured.~~
Fixed: GitHub and Azure (Microsoft) OAuth sign-in now working. Sessions persist across page reloads and workspace changes.
