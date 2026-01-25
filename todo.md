The tools palette should float above the diagram instead of clipping it on the right side.

Opening a diagram view or refreshing the diagram causes the nodes to first appear in a default layout. They are then visibly repositioned by the layout engine.  The animation is fine, but the initial positioning is not, as it is jarring and unprofessional.  The initial position should be set while the diagram is hidden using the previously saved layout, if available.  If not, then the initial positions should be set using the auto-layout function.

Enable 'marquee' selection with Ctrl+Drag to draw a rectangle around the selected elements.

The system must remember the previous layout and restore it automatically if available from the cache.

Add an outline contribution based on the hierarchical model structure that shows up in the document outline panel.

Need a plan to distinguish between node properties and child nodes.  This is grammar-dependent since some grammars may represent properties and child nodes using similar when children are nested within their parents.

Add a shared properties panel that displays a form allowing the user to edit the properties of the currently selected item in the current diagram, the selected element in the text editor, as well as objects across the IDE, like items selected in the explorer.  The properties panel is a standard dockable Theia panel.

Add a 'snap to grid' toggle and icon in toolbar.

Update the /grammar.docs claude command to add/update the <https://johnholliday.github.io/{grammar}> URL as the documentation link in the grammar manifest.

Tool palette Nodes section contains only "Node", "Entity" and "Component".  It should contain the hierarchy of available node types from the grammar manifest.  Same for connections.

----
The grammar-specific diagram styling must support 'ports' for certain entity types, with grammar-specific rules for the kinds of connections that are allowed between diagram nodes.

pnpm dlx @turbo/codemod@latest update
