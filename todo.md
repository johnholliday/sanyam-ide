# Diagramming Adjustments

The system must remember the previous layout and restore it automatically if available from the cache.

Tool palette Nodes section contains only "Node", "Entity" and "Component".  It should contain the hierarchy of available node types from the grammar manifest.  Same for connections.

The grammar-specific diagram styling must support 'ports' for certain entity types, with grammar-specific rules for the kinds of connections that are allowed between diagram nodes.

----

- The 'Snap to Grid' toggle does not affect the diagram and fails to visually convey the state of the toggle button.

- change/update the toolbar icons

---->>
Synchronization between the text and diagram views is not working.  The diagram model seems to be cached, even between sessions - open a file, change the text and save the file (diagram not updated), reload the browser, open the file (changed text does persist) => diagram still contains the original labels.  The user must be able to open a grammar file, make changes in any view, save the file and then immediately see the changes reflected in all other attached views that are visible.

Editing in the text or diagram editors must be reflected in the outline view.

----
Move the toolbar from the composite editor window to the diagram view itself so that the diagramming tools appear at the top of the diagram editor (closer to the diagram)

----
Node shapes should expand to accommodate their word-wrapped labels, which should not include double quotes.

----
The IDE should remember the most recent composite editor layout automatically without prompting the user.  Later, we can have a preferences option whether to save the layout automatically or not.  The layout must include the diagram zoom level and the current state of all of the toggles.

----
Must distinguish between node properties and child nodes.  This is grammar-dependent since some grammars may represent properties in different ways.  Node properties are not rendered as entities on the diagram canvas, but are instead displayed in a shared properties panel that displays a form allowing the user to edit the properties of the currently selected item within the current context.  The properties panel operates similarly to the Theia Outline panel, responding to context switches.  The selection could be an element in the current diagram, the currently selected element in the text editor, or other objects within the IDE, such as selected files or folders in the Theia IDE explorer.  The properties panel must be a standard dockable Theia panel with a contained properties view that is a form editor widget. Initial implementation using built-in Theia-provided form editor widget.

The user must be able to select an item in the text editor, or click a node in the diagram and see a properties pane where they can view/edit metadata associated with the currently selected item.  Changes to property values are automatically reflected in the model and propagated to all views.

----
The diagram edges are of two types.  Entity<->Entity and Entity->Child.  Entity<->Entity relationships are rendered as edges.  Entity->Child relationships are rendered by default as containers with the child nodes inside.  Containers can be expanded or collapsed.

----
Add a Supabase Authentication package (packages/theia-extensions/supabase-auth) that allows the user to login to the application using supabase credentials.  The credentials are stored securely and can be used to validate permissions for access to licensed modules.

----
Create a separate tool that generates a custom REST API for a given grammar.  The REST API includes CRUD operations for models + custom operations depending on the target domain.  Create Claude commands for generating the API, the API documentation, and identifying and implementing the CRUD operations.  

The operations are declared in a separate {grammar}.api.json file (using Claude to generate it).  If present, this file is used to expose the API and to generate the OpenAPI UI. We also want the ability to publish the API locally via Docker, or on a target host environment (i.e., Supabase).

Modify the frontend with appropriate command contributions matching the generated API.

---
Modify the documentation generator to output into the docs/ folder of the grammar package directly.  Add a docs:dev command to the grammar package.json to publish locally via Docker. Modify the frontend documentation URL to point to a grammar-specific URL in Docker. [ need a strategy for CI/CD in production ]
