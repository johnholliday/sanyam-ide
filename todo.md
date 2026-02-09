
---- The system must remember the previous layout and restore it automatically if available from the cache.

----
The grammar-specific diagram styling must support 'ports' for certain entity types, with grammar-specific rules for the kinds of connections that are allowed between diagram nodes.

----
The diagram edges are of two types.  Entity<->Entity and Entity->Child.  Entity<->Entity relationships are rendered as edges.  Entity->Child relationships should be rendered by default as containers with the child nodes inside, but can also be rendered as edges (based on a user preference setting).  Ensure that container nodes can be expanded/collapsed to show/hide child nodes.

----
Add a Supabase Authentication package (packages/theia-extensions/supabase-auth) that allows the user to login to the application using supabase credentials.  The credentials are stored securely and can be used to validate permissions for access to licensed operations.

-----
The auto-layout function may be grammar-specific, with a preferred layout style.
Explore how to specify this declaratively as part of the grammar manifest, perhaps using a JSON schema.

-----
Wire up a canvas double-click handler that opens a quick-pick or mini-menu at the click position. This is how tools like Miro and FigJam work — very low friction.

-----
In response to an API query to get the list of available models, the API should search for all documents in the active Langium workspace.

-----
Editing property values in the properties panel does not update the model in the text editor or in the diagram canvas.

-----
When the diagram is being loaded, the VS Code progress bar is not visible.

-----
Add expand/collapse button on parent nodes in the property view.
Indent child nodes in the property view.

-----
Eliminate the Toggle Arrows command entirely, since that is controls by the layout itself.  Configure the Edge Jumps and Snap to Grid commands as new User Preferences options instead of toggle buttons.

----- Forms
The IDE will need dynamic forms support.  A given user may want to use a set of custom forms to gather raw data, text files containing notes, Excel spreadsheet, PDFs, DOCX, PowerPoints, etc.  The IDE can include a SurveyJS Form designer they can use to collect the information directly from within the IDE and then save the data to their project file.

----- Import+Conversion
At any point, the user can ingest a data file and use the integrated AI support to generate a grammar file (having the same base name as the data file) that expresses the same information, but following the grammar syntax.  These grammar files can then be referenced from other grammar files as part of the overall model.

----- Projects
This introduces the notion of a "project" that may comprise several model files, which are managed as a group and which can form the basis for various group-level operations, such as generating a graphical dashboard with an integrated pivot table for analyzing properties over time, or slicing and dicing the aggregate data across multiple projects.  The key insight is that the analysis is performed dynamically and produces a JSON data file that conforms to a common schema + custom schema extensions based on the target domain (grammar definition).
