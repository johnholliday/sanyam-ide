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
Add a Supabase Authentication package (packages/theia-extensions/supabase-auth) that allows the user to login to the application using supabase credentials.  The credentials are stored securely and can be used to validate permissions for access to licensed modules.

----
Create a separate tool that generates a custom REST API for a given grammar.  The REST API includes CRUD operations for models + custom operations depending on the target domain.  Create Claude commands for generating the API, the API documentation, and identifying and implementing the CRUD operations.  

The operations are declared in a separate {grammar}.api.json file (using Claude to generate it).  If present, this file is used to expose the API and to generate the OpenAPI UI. We also want the ability to publish the API locally via Docker, or on a target host environment (i.e., Supabase).

Modify the frontend with appropriate command contributions matching the generated API.

---<>
Modify the /grammar.docs skill to generate into the docs/ folder of the grammar package directly instead of into the /docs/{grammar} folder.  Adjust any related pnpm commands.

---<>
Add a /docgen skill that generates an Eleventy documentation site into the root /docs folder, and can be published locally via Docker and then referenced from within the IDE using a standardized URL that includes the ApplicationName from the browser package.json. The /docgen skill must generate a unique documentation URL that is read at runtime from the {applicationName}_DOCS_URL environment variable, emitting the generated environment variable with instructions for the developer to properly configure the environment.  It must also modify the getting-started-widget and about-dialog to retrieve the corresponding URLS from the generated environment variable. CRITICAL REQUIREMENT: The generated documentation must target the IDE USER (NOT the IDE developer) and must include separate sections for any previously generated documentation content for the currently configured grammar packages in the browser application package.json (extracting the documentation directly from packages/grammar-definitions/{primary_grammar}/docs).  If no previously generated documentation content exists for any of the configured grammar packages, then the /docgen skill must terminate immediately with an error message for the user explaining the situation with instructions for correcting it (e.g. first run the /grammar.docs skill, etc.).
