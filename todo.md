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

- change/update the toolbar icons

----
The diagram edges are of two types.  Entity<->Entity and Entity->Child.  Entity<->Entity relationships are rendered as edges.  Entity->Child relationships are rendered by default as containers with the child nodes inside, but can also be rendered as edges (based on a user preference setting).  Containers can be expanded/collapsed to show/hide child nodes.

----
Add a Supabase Authentication package (packages/theia-extensions/supabase-auth) that allows the user to login to the application using supabase credentials.  The credentials are stored securely and can be used to validate permissions for access to licensed operations.

-----
The diagram view must retain its current state when switching back and forth between the text and diagram views.  Currently, the diagram view resets each time it is shown.

Dragging an item from the Element Palette onto the diagram canvas does not create a new item.  The drop handler does not accept the drop.

-----
Grammar operations should populate the ACTIONS section on the element palette
Rename the element palette to Tools
Users can drag elements either onto the diagram or into the text to create that element.
