# Completed

- [x] Add workspace/executeCommand support via GLSP service (commit 606b01c)
  - Grammar operations now execute via internal RPC channel instead of REST API
  - Fixed API proxy routing to preserve /api prefix
  - Improved command handler URI extraction for file explorer context menus

----

# Diagramming Adjustments

The system must remember the previous layout and restore it automatically if available from the cache.

Tool palette Nodes section contains only "Node", "Entity" and "Component".  It should contain the hierarchy of available node types from the grammar manifest.  Same for connections.

The grammar-specific diagram styling must support 'ports' for certain entity types, with grammar-specific rules for the kinds of connections that are allowed between diagram nodes.

----

- The 'Snap to Grid' toggle does not affect the diagram and fails to visually convey the state of the toggle button.

----
The diagram edges are of two types.  Entity<->Entity and Entity->Child.  Entity<->Entity relationships are rendered as edges.  Entity->Child relationships are rendered by default as containers with the child nodes inside, but can also be rendered as edges (based on a user preference setting).  Containers can be expanded/collapsed to show/hide child nodes.

----
Add a Supabase Authentication package (packages/theia-extensions/supabase-auth) that allows the user to login to the application using supabase credentials.  The credentials are stored securely and can be used to validate permissions for access to licensed operations.

-----

Dragging an item from the Element Palette onto the diagram canvas does not create a new item.  The drop handler does not accept the drop.

-----
Users must be able to drag elements from the Tools palette either onto the diagram or into the text to create that element.

-----
Create and use custom SVG icons for the diagram editor toolbar instead of the CodeIcon font.

-----
The auto-layout function may be grammar-specific, with a preferred layout style.
Explore how to specify this declaratively as part of the grammar manifest, perhaps using a JSON schema.

-----
Re-opening the IDE, where a previously opened file was being edited, re-opens the file in the default text editor instead of the composite editor.

-----
Initial diagram display is jarring.  It draws random shapes and edges, and then animates the initial layout.  It should hide everything until the diagram is ready, and then display the fully rendered diagram.  Subsequent layout operations can render normally with full animation, etc.

-----
Wire up a canvas double-click handler that opens a quick-pick or mini-menu at the click position. This is how tools like Miro and FigJam work — very low friction.
