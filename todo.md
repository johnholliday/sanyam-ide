# Diagramming Adjustments

The system must remember the previous layout and restore it automatically if available from the cache.

Tool palette Nodes section contains only "Node", "Entity" and "Component".  It should contain the hierarchy of available node types from the grammar manifest.  Same for connections.

The grammar-specific diagram styling must support 'ports' for certain entity types, with grammar-specific rules for the kinds of connections that are allowed between diagram nodes.

----

- The 'Snap to Grid' toggle does not affect the diagram and fails to visually convey the state of the toggle button.

- change/update the toolbar icons

----
Add an outline contribution based on the hierarchical model structure that shows up in the Theia document outline panel.  Note that this is grammar-specific, as some grammars may not support outlining (i.e., may not support nested child elements).
 Verification

 1. cd packages/theia-extensions/glsp && pnpm build — compiles
 2. pnpm start:browser → open a file that uses the composite editor
 3. Switch to text view → outline shows document symbols from LSP
 4. Switch to diagram view → outline shows same symbol hierarchy
 5. Click outline node in text view → editor scrolls to symbol
 6. Click outline node in diagram view → diagram element highlights
 7. Open a regular text file (not composite) → Monaco outline still works normally
 8. Open a grammar without hierarchy → outline is empty, no errors

----
Synchronization between the text and diagram views is not working.  The diagram model seems to be cached, even between sessions - open a file, change the text and save the file (diagram not updated), reload the browser, open the file (changed text does persist) => diagram still contains the original labels.  The user must be able to open a grammar file, make changes in any view, save the file and then immediately see the changes reflected in all other attached views that are visible.

----
Must distinguish between node properties and child nodes.  This is grammar-dependent since some grammars may represent properties and child nodes using similar when children are nested within their parents.  Node properties must be displayed in a shared properties panel that displays a form allowing the user to edit the properties of the currently selected item within the current 'context'.  The selection could be an element in the current diagram, the currently selected element in the text editor, or other objects within the IDE, like selected files or folders in the explorer.  The properties panel must be a standard dockable Theia panel with a contained properties view that is a form view. Initial implementation using built-in Theia-provided forms widget.

The user must be able to select an item in the text editor, or click a node in the diagram and see a properties pane where they can view/edit metadata associated with the currently selected item.  Changes to property values are automatically reflected in the model and propagated to all views.
