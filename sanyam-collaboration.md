## Architecture

The Theia collaboration feature is built on **Open Collaboration Tools (OCT)**, an open-source project by TypeFox (launched July 2024, integrated into Theia starting with v1.53). The Theia-specific integration is the `@theia/collaboration` npm package, which wraps the OCT libraries.

The system has three components:

1. **OCT Server** — a Node.js application that handles authentication and message brokering between participants. It uses WebSocket connections and holds session data in-memory (no horizontal scaling yet). A public instance runs at `api.open-collab.tools`.

2. **Open Collaboration Protocol** — an extensible, message-based protocol over WebSocket. Clients don't communicate directly; the server brokers messages. This design allows arbitrary editor types (text, graphical, forms) to participate as long as both clients understand each other's message format. Built-in support exists for plain text synchronization; custom editors add their own message types.

3. **Client extensions** — Theia has a built-in extension (`@theia/collaboration`); VS Code gets a separate extension from the marketplace.

## Session Workflow

1. Host clicks the **share button** in the status bar → starts a new collaboration session
2. Server prompts a login (see authentication below) → generates a **room code** copied to clipboard
3. Guest clicks the same share button → chooses "connect to session" → enters the room code
4. Both instances are now connected with real-time cursor tracking, selections, and edit synchronization
5. End-to-end encryption ensures the server cannot read shared content

## Authentication

Authentication is primarily used to generate a username for participants — it's identity, not access control in the traditional sense. The specifics:

- The server supports **OAuth 2.0 providers**, with GitHub and Google as the built-in/hard-coded options on the public instance. When you start or join a session, your browser is redirected to the OAuth provider to authenticate, and the returned identity is used as your display name in the collaboration session.

- For self-hosted deployments, the server can be connected to your own authentication service — the issue requesting generic OIDC/OAuth2 provider support (issue #43) was filed and subsequently closed, suggesting this has been addressed or is in progress.

- End-to-end encryption and extensible user authentication are built in from the start. The encryption means even the server operator can't see the content being shared — only invited participants can decipher messages.

- The public server at `open-collab.tools` is intended for open-source work and evaluation. Companies are advised to deploy their own instances secured with their existing access control measures.

## Key Architectural Notes for Your Work

Given your GLSP + Langium toolchain work, the extensible protocol is the interesting part. OCT explicitly supports collaborative editing beyond plain text — the protocol's brokering mechanism means if you build a GLSP-based graphical editor, you can add synchronization messages for diagram state without modifying the core protocol. The framework supports adding collaborative work on custom UI elements such as diagram editors, terminals, or forms. That's a direct path to collaborative DSL editing where both the textual Langium editor and the GLSP diagram view stay synchronized across participants.
