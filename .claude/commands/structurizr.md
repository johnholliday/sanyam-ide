# /structurizr - Generate C4 Architecture Diagrams

Generate a comprehensive Structurizr C4 workspace from the monorepo structure and launch the diagram viewer.

## Instructions

1. **Analyze the monorepo structure**
   - Read the directory tree to identify all packages, applications, and their relationships
   - Examine `package.json` files to understand dependencies between packages
   - Review any existing architecture documentation in `docs/` or `specs/`

2. **Generate `.C4/workspace.dsl`**
   - Create the `.C4` directory at monorepo root if it doesn't exist
   - Generate a Structurizr DSL workspace with:
   - **System Context**: External actors (Language Engineer, Domain Expert) and systems (AI Services, File System, Docker)
   - **Container View**: All packages as containers organized by architectural layer
   - **Component Views**: Internal components for major containers (platform-core, grammar-services, glsp-server, composite-editor, model-server, theia-backend, theia-extensions)
   - **Filtered Views**: Applications, LanguageEngineering, VisualEditing, ModelArchitecture
   - **Styles**: Color-coded by layer/type with appropriate shapes

3. **Architectural Layers** (map packages to these layers):

   | Layer             | Packages                                                                     |
   | ----------------- | ---------------------------------------------------------------------------- |
   | Applications      | browser-app, electron-app, sanyam-cli                                        |
   | Platform Core     | platform-core, platform-protocol, platform-types                             |
   | Language Services | grammar-services, registry-service, lsp-docgen                               |
   | Model             | model-server, model-client                                                   |
   | GLSP              | glsp-server, glsp-\*-diagram, layout-engine                                  |
   | Editors           | composite-editor, diagram-editor, form-editor, property-editor, model-editor |
   | Theia Integration | theia-backend, theia-extensions                                              |
   | Services          | diagram-service, form-service, ai-client, docgen                             |
   | UI/Theming        | branding, themes                                                             |
   | Grammars          | grammars/\*                                                                  |

4. **Create/update launcher script**
   - Ensure `scripts/structurizr.sh` exists (cross-platform bash script)
   - Script should: check Docker, pull structurizr/lite image, mount .C4 folder, open browser

5. **Launch Structurizr**
   - Inform user to run: `pnpm structurizr` or `./scripts/structurizr.sh`
   - Structurizr Lite will be available at <http://localhost:8080>

## Output Files

```
.C4/
├── workspace.dsl      # Generated Structurizr DSL
├── README.md          # Documentation for the C4 workspace
└── structurizr.sh     # Backup of launcher script

scripts/
└── structurizr.sh     # Primary launcher script
```

## User Prompt

$ARGUMENTS
