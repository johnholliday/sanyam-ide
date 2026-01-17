<br/>
<div id="theia-logo" align="center">
    <br />
    <img src="https://raw.githubusercontent.com/eclipse-theia/sanyam-ide/master/theia-extensions/product/src/browser/icons/TheiaIDE.png" alt="Theia Logo" width="300"/>
    <h3>Sanyam IDE</h3>
</div>

<div id="badges" align="center">

The Sanyam IDE is built with this project.\
Sanyam IDE also serves as a template for building desktop-based products based on the Eclipse Theia platform.

</div>

[![Installers](https://img.shields.io/badge/download-installers-blue.svg?style=flat-curved)](https://sanyam-ide.org//#theiaidedownload)
[![Build Status](https://ci.eclipse.org/theia/buildStatus/icon?subject=latest&job=Theia2%2Fmaster)](https://ci.eclipse.org/theia/job/Theia2/job/master/)
<!-- currently we have no working next job because next builds are not published -->
<!-- [![Build Status](https://ci.eclipse.org/theia/buildStatus/icon?subject=next&job=theia-next%2Fmaster)](https://ci.eclipse.org/theia/job/theia-next/job/master/) -->

[Main Theia Repository](https://github.com/eclipse-theia/theia)

[Visit the Theia website](http://www.sanyam-ide.org) for more documentation: [Using the Sanyam IDE](https://sanyam-ide.org/docs/user_getting_started/), [Packaging Theia as a Desktop Product](https://sanyam-ide.org/docs/blueprint_documentation/).

## License

- [MIT](LICENSE)

## Trademark

"Theia" is a trademark of the Eclipse Foundation
<https://www.eclipse.org/theia>

## What is this?

The Eclipse IDE is a modern and open IDE for cloud and desktop. The Sanyam IDE is based on the [Theia platform](https://sanyam-ide.org).
The Sanyam IDE is available as a [downloadable desktop application](https://sanyam-ide.org//#theiaidedownload). You can also try the latest version of the Sanyam IDE online. The online test version is limited to 30 minutes per session and hosted via Theia.cloud. Finally, we provide an [experimental Docker image](#docker) for hosting the Sanyam IDE online.

The Sanyam IDE also serves as a **template** for building desktop-based products based on the Eclipse Theia platform, as well as to showcase Eclipse Theia capabilities. It is made up of a subset of existing Eclipse Theia features and extensions. [Documentation is available](https://sanyam-ide.org/docs/composing_applications/) to help you customize and build your own Eclipse Theia-based product.

## Sanyam IDE vs Theia Blueprint

The Sanyam IDE has been rebranded from its original name "Theia Blueprint". You can therefore assume the terms "Sanyam IDE" and "Theia Blueprint" to be synonymous.

## Development

### Requirements

Please check Theia's [prerequisites](https://github.com/eclipse-theia/theia/blob/master/doc/Developing.md#prerequisites), and keep node versions aligned between Sanyam IDE and that of the referenced Theia version.

### Documentation

Documentation on how to package Theia as a Desktop Product may be found [here](https://sanyam-ide.org/docs/blueprint_documentation/)

### Repository Structure

- Root level configures mono-repo build with lerna
- `applications` groups the different app targets
  - `browser` contains a browser based version of Sanyam IDE that may be packaged as a Docker image
  - `electron` contains the electron app to package, packaging configuration, and E2E tests for the electron target.
- `packages` contains shared packages
  - `types` contains TypeScript type definitions (@sanyam/types)
  - `language-server` contains the unified LSP/GLSP language server
- `grammars` contains DSL grammar packages
  - Each grammar package provides language support via the unified server
- `theia-extensions` groups the various custom theia extensions for the Sanyam IDE
  - `product` contains a Theia extension contributing the product branding (about dialogue and welcome page).
  - `updater` contains a Theia extension contributing the update mechanism and corresponding UI elements (based on the electron updater).
  - `launcher` contains a Theia extension contributing, for AppImage applications, the option to create a script that allows to start the Sanyam IDE from the command line by calling the 'theia' command.
  - `glsp` contains the GLSP diagram frontend integration.

### Unified LSP/GLSP Language Server

Sanyam IDE includes a unified language server that provides both LSP (Language Server Protocol) and GLSP (Graphical Language Server Protocol) support for domain-specific languages.

#### Features

- **Text Editing Support (LSP)**
  - Code completion, hover information, go-to-definition
  - Find references, rename refactoring
  - Diagnostics and validation
  - Semantic highlighting, code folding

- **Visual Diagram Editing (GLSP)**
  - Node and edge creation via tool palette
  - Drag-and-drop positioning
  - Auto-layout support
  - Context menu operations

- **Bidirectional Synchronization**
  - Changes in text automatically update the diagram
  - Changes in diagram automatically update the text
  - Sub-second synchronization (<1s)

#### Adding a New Grammar

To add support for a new domain-specific language:

1. Create a grammar package in `grammars/your-language/`
2. Define the Langium grammar (`.langium` file)
3. Create a `manifest.ts` with GrammarManifest export
4. Create `src/contribution.ts` implementing LanguageContribution
5. Add `"sanyam": { "contribution": "./lib/src/contribution.js" }` to package.json
6. Rebuild the server

See `grammars/example-minimal/` for a minimal reference implementation.

#### Building the Language Server

```sh
# Build the unified server
cd packages/language-server
pnpm build

# Build with VSIX packaging
pnpm build:vsix

# Create VSIX extension package
pnpm package:vsix
```

The generated VSIX can be installed in VS Code or Theia-based IDEs.

### Build

For development and casual testing of the Sanyam IDE, one can build it in "dev" mode. This permits building the IDE on systems with less resources, like a Raspberry Pi 4B with 4GB of RAM.

NOTE: If manually building after updating dependencies or pulling to a newer commit, run `git clean -xfd` to help avoid runtime conflicts.

```sh
# Build "dev" version of the app. Its quicker, uses less resources,
# but the front end app is not "minified"
pnpm install && pnpm build:dev && pnpm download:plugins
```

Production applications:

```sh
# Build production version of the Sanyam IDE app
pnpm install && pnpm build && pnpm download:plugins
```

### Package the Applications

ATM we only produce packages for the Electron application.

```sh
pnpm package:applications
# or
pnpm electron package
```

The packaged application is located in `applications/electron/dist`.

### Create a Preview Electron Electron Application (without packaging it)

```sh
pnpm electron package:preview
```

The packaged application is located in `applications/electron/dist`.

### Running E2E Tests on Electron

The E2E tests basic UI tests of the actual application.
This is done based on the preview of the packaged application.

```sh
pnpm electron package:preview
pnpm electron test
```

### Running Browser app

The browser app may be started with

```sh
pnpm browser start
```

and connect to <http://localhost:3002/>

### Troubleshooting

- [_"Don't expect that you can build app for all platforms on one platform."_](https://www.electron.build/multi-platform-build)

### Reporting Feature Requests and Bugs

The features in the Sanyam IDE are based on Theia and the included extensions/plugins. For bugs in Theia please consider opening an issue in the [Theia project on Github](https://github.com/johnholliday/sanyam-ide/issues/new/choose).
The Sanyam IDE only packages existing functionality into a product and installers for the product. If you believe there is a mistake in packaging, something needs to be added to the packaging or the installers do not work properly, please [open an issue on Github](https://github.com/johnholliday/sanyam-ide/issues/new/choose) to let us know.

### Docker

The Docker image of the Sanyam IDE is currently in _experimental state_. It is built from the same sources and packages as the desktop version, but it is not part of the [preview test](https://github.com/johnholliday/sanyam-ide/blob/master/PUBLISHING.md#preview-testing-and-release-process-for-the-sanyam-ide).
You can find a prebuilt Docker image of the IDE [here](https://github.com/johnholliday/sanyam-ide/pkgs/container/sanyam-ide%2Fsanyam-ide).

You can also create the Docker image for the Sanyam IDE based on the browser app with the following build command:

```sh
docker build -t sanyam-ide -f browser.Dockerfile .
```

You may then run this with

```sh
docker run -p=3002:3002 --rm sanyam-ide
```

and connect to <http://localhost:3002/>
