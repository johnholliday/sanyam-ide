# Completed

- [x] Add workspace/executeCommand support via GLSP service (commit 606b01c)
  - Grammar operations now execute via internal RPC channel instead of REST API
  - Fixed API proxy routing to preserve /api prefix
  - Improved command handler URI extraction for file explorer context menus

----

# Diagramming Adjustments

The system must remember the previous layout and restore it automatically if available from the cache.

The grammar-specific diagram styling must support 'ports' for certain entity types, with grammar-specific rules for the kinds of connections that are allowed between diagram nodes.

----
The diagram edges are of two types.  Entity<->Entity and Entity->Child.  Entity<->Entity relationships are rendered as edges.  Entity->Child relationships should be rendered by default as containers with the child nodes inside, but can also be rendered as edges (based on a user preference setting).  Ensure that container nodes can be expanded/collapsed to show/hide child nodes.

----
Add a Supabase Authentication package (packages/theia-extensions/supabase-auth) that allows the user to login to the application using supabase credentials.  The credentials are stored securely and can be used to validate permissions for access to licensed operations.

-----
Create a small vertical floating toolbar in the bottom left corner of the diagram similar to @app-blocks-tools.jpg that includes the zoom in, zoom out, fit view, auto-layout and toggle minimap icon buttons.

<<TEST>>

Remove the diagram editor toolbar from the top of the diagram editor view.

-----
Currently, on startup, if a previously opened file was being edited, the file is reopened in the default text editor instead of the composite editor.  Grammar files must always open in the composite editor

-----
The auto-layout function may be grammar-specific, with a preferred layout style.
Explore how to specify this declaratively as part of the grammar manifest, perhaps using a JSON schema.

-----
Initial diagram display is jarring.  It currently renders nodes and edges immediately before the initial layout, drawing random shapes and edges, and then finally animates the initial layout.  It should instead hide everything until the diagram is ready, before displaying the fully rendered diagram.  Subsequent layout operations can render normally with full animation, etc.

-----
Wire up a canvas double-click handler that opens a quick-pick or mini-menu at the click position. This is how tools like Miro and FigJam work — very low friction.

-----
In response to an API query to get the list of available models, the API should search for all documents currently in the Langium workspace.

-----
Add expand/collapse button on parent nodes in the property view.
Indent child nodes in the property view.

-----
Append a LAYOUT section to the sidebar palette that contains the Orthogonal Routing, Straight Routing, Bezier Routing commands.  Add the 'Export as SVG' command to the ACTIONS section.

-----
Eliminate the Toggle Arrows command entirely, since that is controls by the layout itself.  Configure the Edge Jumps and Snap to Grid commands as new User Preferences options instead of toggle buttons.
