# Diagramming Adjustments

1. Opening a diagram view or refreshing the diagram causes the nodes to first appear in a default layout. They are then visibly repositioned by the layout engine.  The animation is fine, but the initial positioning is not, as it is jarring and unprofessional.  The initial position should be set while the diagram is hidden using the previously saved layout, if available.  If not, then the initial positions should be set using the auto-layout function.

2. Enable 'marquee' selection with Ctrl+Drag to draw a rectangle around the selected elements.

3. The system must remember the previous layout and restore it automatically if available from the cache.

4. Add an outline contribution based on the hierarchical model structure that shows up in the document outline panel.

5. Must distinguish between node properties and child nodes.  This is grammar-dependent since some grammars may represent properties and child nodes using similar when children are nested within their parents.  Node properties must be displayed in a shared properties panel that displays a form allowing the user to edit the properties of the currently selected item within the current 'context'.  The selection could be an element in the current diagram, the currently selected element in the text editor, or other objects within the IDE, like selected files or folders in the explorer.  The properties panel must be a standard dockable Theia panel.

6. Add a 'snap to grid' toggle and icon in the diagram editor toolbar.

7. Tool palette Nodes section contains only "Node", "Entity" and "Component".  It should contain the hierarchy of available node types from the grammar manifest.  Same for connections.

8. The grammar-specific diagram styling must support 'ports' for certain entity types, with grammar-specific rules for the kinds of connections that are allowed between diagram nodes.

----

- The 'Snap to Grid' toggle does not affect the diagram and fails to visually convey the state of the toggle button.

----
Set the browser title to the application product name, regardless of which view is currently open.  As an example, for the ecml grammar it should be simply "E C M L".

Can we allow the user to dock the text or diagram views within the composite editor frame in the same way that Theia supports docking windows?  For example, if the composite editor has tabs for 'Text' and 'Diagram', can we allow the user to drag either tab to dock the associated view within the composite editor frame?  Conversely, if the text or diagram view is currently docked, can we allow the user to drag a view to the top or bottom of the frame?
