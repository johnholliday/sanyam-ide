# Diagramming Adjustments

Opening a diagram view or refreshing the diagram causes the nodes to first appear in a default "jumbled" layout. They are then visibly repositioned by the layout engine.  This is both jarring and unprofessional.  The initial position should be setup invisibly (using the previously saved layout, if available, otherwise using auto-layout with 20% zoom) before the diagram is initially displayed.

The system must remember the previous layout and restore it automatically if available from the cache.

Add an outline contribution based on the hierarchical model structure that shows up in the document outline panel.

Must distinguish between node properties and child nodes.  This is grammar-dependent since some grammars may represent properties and child nodes using similar when children are nested within their parents.  Node properties must be displayed in a shared properties panel that displays a form allowing the user to edit the properties of the currently selected item within the current 'context'.  The selection could be an element in the current diagram, the currently selected element in the text editor, or other objects within the IDE, like selected files or folders in the explorer.  The properties panel must be a standard dockable Theia panel.

Tool palette Nodes section contains only "Node", "Entity" and "Component".  It should contain the hierarchy of available node types from the grammar manifest.  Same for connections.

The grammar-specific diagram styling must support 'ports' for certain entity types, with grammar-specific rules for the kinds of connections that are allowed between diagram nodes.

----

- The 'Snap to Grid' toggle does not affect the diagram and fails to visually convey the state of the toggle button.

----
Let's enhance the custom Sanyam theme to isolate the diagram background color and then add 'Sanyam Blueprint (Dark)' and 'Sanyam Blueprint (Light)' themes where the diagram background color mimics an actual architectural blueprint.
