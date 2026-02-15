# Research: Grammar Config Command

**Feature ID**: 001-grammar-config-command
**Created**: 2026-01-15

---

## Research Topics

### R1: Langium Grammar Parsing

**Decision**: Use Langium's grammar language structure to identify entry rules and infer AST types

**Rationale**: Langium 4.x grammars follow a well-defined structure where parser rules define AST types. Entry rules (marked with `entry` keyword) identify root types that can serve as standalone files.

**Key Findings**:

1. **Grammar Structure**:

   ```langium
   grammar MyLanguage

   entry Model:
       elements+=Element*;

   Element:
       'element' name=ID '{' properties+=Property* '}';
   ```

2. **AST Type Inference**: Parser rules automatically generate TypeScript interfaces. A rule like `Person: 'person' name=ID;` generates a `Person` type with `name: string` property.

3. **Entry Rules**: Rules prefixed with `entry` keyword define parsing starting points - these are candidates for rootTypes in the manifest.

4. **Type Patterns**:
   - `=` creates single-value properties
   - `+=` generates array types
   - `?=` produces boolean properties

5. **Declared Types**: Grammar can explicitly declare types using `interface` syntax or `returns` keyword for stability.

**Parsing Strategy**:
Since the `/grammar-config` command runs within Claude Code (not as a programmatic TypeScript tool), we will:

1. Read the `.langium` file as text
2. Use pattern matching to identify:
   - `entry` rules → rootTypes
   - Parser rules (capitalized names followed by `:`) → AST types
   - Property assignments → type structure hints
3. Generate manifest entries based on extracted information

**Alternatives Considered**:

- Use Langium's programmatic API (langium package) - Requires runtime dependencies, overkill for manifest generation
- Write a full parser - Unnecessary complexity for extraction task

**Sources**:

- [Grammar Language | Langium](https://langium.org/docs/reference/grammar-language/)
- [Semantic Model Inference | Langium](https://langium.org/docs/reference/semantic-model/)
- [Langium 4.0 Release](https://www.typefox.io/blog/langium-release-4.0/)

---

### R2: Claude Code Command Structure

**Decision**: Use YAML frontmatter markdown format with `$ARGUMENTS` placeholder

**Rationale**: Existing commands in `.claude/commands/` follow a consistent pattern that provides Claude Code with execution context and optional handoffs.

**Key Findings**:

1. **File Format**: Markdown with YAML frontmatter

   ```yaml
   ---
   description: Short description shown in command list
   handoffs:
     - label: Button text
       agent: next-command
       prompt: Context for next command
       send: true|false  # auto-send or show in input
   ---
   ```

2. **Execution Context**:
   - `$ARGUMENTS` placeholder receives user input after command name
   - Full filesystem access via Claude Code tools (Read, Write, Bash, etc.)
   - Can invoke other commands via handoffs

3. **Best Practices from Existing Commands**:
   - Parse arguments to determine operation mode (existing commands check for file existence, quoted strings, etc.)
   - Provide clear error messages with guidance
   - Use structured output (JSON from scripts, clear status messages)
   - Create artifacts in well-defined locations

4. **Command Registration**: Commands in `.claude/commands/` are automatically available as `/command-name` in Claude Code

**Template Structure for `/grammar-config`**:

```yaml
---
description: Generate grammar package with GrammarManifest from Langium grammar
handoffs:
  - label: Plan Implementation
    agent: speckit.plan
    prompt: Plan changes for grammar package
---

## User Input
$ARGUMENTS

## Outline
1. Parse argument to determine mode (name, name.langium, quoted string, text file)
2. Check for existing grammar at grammars/{name}/{name}.langium
3. Based on mode:
   - Existing grammar → Parse and generate manifest
   - Simple name → Create starter grammar, then generate manifest
   - Quoted string/text file → AI-generate grammar, then generate manifest
4. Write manifest.ts to grammar package directory
5. Report completion with file paths
```

**Alternatives Considered**:

- Implement as TypeScript CLI tool - More complex deployment, harder to iterate
- Use MCP server - Overkill for file generation task

---

### R3: GrammarManifest Type Design

**Decision**: Design comprehensive type hierarchy based on spec example with clear separation of concerns

**Rationale**: The example manifest in the spec provides a complete reference. The type design should support all documented features while remaining extensible.

**Type Hierarchy**:

```typescript
// Core manifest type
interface GrammarManifest {
  languageId: string;           // e.g., 'spdevkit'
  displayName: string;          // e.g., 'SPDevKit'
  fileExtension: string;        // e.g., '.spdk'
  baseExtension: string;        // e.g., '.spdk'

  packageFile?: PackageFileConfig;
  rootTypes: RootTypeConfig[];

  diagrammingEnabled: boolean;
  diagramTypes?: DiagramTypeConfig[];
}

// Package file for grammar-wide model
interface PackageFileConfig {
  fileName: string;
  displayName: string;
  icon: string;
}

// Root type (AST node that can be a file)
interface RootTypeConfig {
  astType: string;              // AST type name from grammar
  displayName: string;          // Human-readable name
  fileSuffix: string;           // e.g., '.application'
  folder: string;               // e.g., 'applications'
  icon: string;                 // VS Code icon name
  template: string;             // Default content template
  templateInputs?: TemplateInput[];
  diagramNode?: DiagramNodeConfig;
}

// Template input for file creation wizard
interface TemplateInput {
  id: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  required: boolean;
  options?: string[];           // For select type
  default?: string | number | boolean;
}

// Diagram node configuration
interface DiagramNodeConfig {
  glspType: string;             // e.g., 'node:application'
  shape: 'rectangle' | 'ellipse' | 'diamond' | 'hexagon';
  cssClass: string;
  defaultSize: { width: number; height: number };
}

// Diagram type (view configuration)
interface DiagramTypeConfig {
  id: string;
  displayName: string;
  fileType: string;
  nodeTypes: NodeTypeConfig[];
  edgeTypes: EdgeTypeConfig[];
  toolPalette: ToolPaletteConfig;
}

// Node type in diagram
interface NodeTypeConfig {
  glspType: string;
  creatable: boolean;
  showable: boolean;
}

// Edge type in diagram
interface EdgeTypeConfig {
  glspType: string;
  creatable: boolean;
  showable: boolean;
}

// Tool palette configuration
interface ToolPaletteConfig {
  groups: ToolPaletteGroup[];
}

// Tool palette group
interface ToolPaletteGroup {
  id: string;
  label: string;
  items: ToolPaletteItem[];
}

// Tool palette item
interface ToolPaletteItem {
  id: string;
  label: string;
  icon: string;
  action: ToolAction;
}

// Tool action
interface ToolAction {
  type: 'create-node' | 'create-edge';
  glspType: string;
}
```

**Alternatives Considered**:

- Flatter structure - Would lose semantic grouping
- Separate files per type - Adds complexity for import management

---

### R4: AI Grammar Generation Strategy

**Decision**: Use structured prompting with validation and fallback to starter template

**Rationale**: AI-generated grammars need validation to ensure syntactic correctness. A retry with refined prompt plus fallback ensures users always get a working result.

**Strategy**:

1. **Initial Prompt Structure**:

   ```
   Generate a Langium grammar for the following DSL:

   Description: {user description}

   Requirements:
   - Use Langium 4.x syntax
   - Include an entry rule named 'Model'
   - Define at least 3 AST types based on the domain concepts
   - Include common terminal rules (ID, STRING, INT, WS)
   - Add comments explaining each rule

   Output format:
   - Start with `grammar {GrammarName}`
   - Use proper Langium syntax with entry, parser rules, and terminals
   ```

2. **Validation Checks**:
   - Grammar starts with `grammar` declaration
   - Has at least one `entry` rule
   - Contains terminal rules for basic types (ID, STRING)
   - No obvious syntax errors (balanced braces, proper rule structure)

3. **Retry Strategy**:
   - If validation fails, retry with additional guidance highlighting the specific issue
   - Maximum 2 attempts (initial + 1 retry)

4. **Fallback**:
   - If both attempts fail, use starter workflow grammar template
   - Notify user that AI generation failed and starter template was used
   - Include original description as comment in the grammar file

**Starter Grammar Template**:

```langium
grammar ${GrammarName}

// Entry point - defines the overall structure
entry Model:
    elements+=Element*;

// Base element type - customize as needed
Element:
    Task | Workflow;

// Task definition
Task:
    'task' name=ID '{'
        ('description' description=STRING)?
    '}';

// Workflow with tasks
Workflow:
    'workflow' name=ID '{'
        tasks+=[Task]*
    '}';

// Terminals
hidden terminal WS: /\s+/;
hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;

terminal ID: /[_a-zA-Z][\w_]*/;
terminal STRING: /"[^"]*"|'[^']*'/;
terminal INT returns number: /[0-9]+/;
```

**Alternatives Considered**:

- No AI generation - Limits accessibility for non-experts
- Always require manual grammar - Reduces value proposition
- Multiple AI providers - Adds complexity, Claude is already available

---

### R5: Icon Mapping Strategy

**Decision**: Use heuristic mapping based on AST type names with sensible defaults

**Rationale**: VS Code provides a standard icon set. Type names often suggest appropriate icons (e.g., "Workflow" → workflow, "Entity" → symbol-class).

**Heuristic Mapping Table**:

| Pattern in Type Name | Suggested Icon | Reason |
|---------------------|----------------|--------|
| `Workflow`, `Flow`, `Process` | `workflow` | Flow/process concept |
| `Task`, `Step`, `Action` | `checklist` | Actionable item |
| `Entity`, `Class`, `Type` | `symbol-class` | Type/class concept |
| `Property`, `Field`, `Attribute` | `symbol-field` | Field/property |
| `Function`, `Method`, `Operation` | `symbol-method` | Callable |
| `Event`, `Trigger`, `Signal` | `zap` | Event-based |
| `State`, `Status` | `circle-filled` | State indicator |
| `Connection`, `Link`, `Edge` | `link` | Relationship |
| `Group`, `Container`, `Package` | `folder` | Container |
| `Config`, `Settings`, `Options` | `gear` | Configuration |
| `User`, `Person`, `Actor` | `person` | Human actor |
| `Security`, `Permission`, `Role` | `shield` | Security-related |
| `Data`, `Record`, `Document` | `file` | Data/document |
| `List`, `Array`, `Collection` | `list-flat` | Collection |
| `Default` | `symbol-namespace` | Fallback icon |

**Implementation**:

```typescript
function suggestIcon(typeName: string): string {
  const name = typeName.toLowerCase();

  if (/workflow|flow|process/.test(name)) return 'workflow';
  if (/task|step|action/.test(name)) return 'checklist';
  if (/entity|class|type/.test(name)) return 'symbol-class';
  if (/property|field|attribute/.test(name)) return 'symbol-field';
  if (/function|method|operation/.test(name)) return 'symbol-method';
  if (/event|trigger|signal/.test(name)) return 'zap';
  if (/state|status/.test(name)) return 'circle-filled';
  if (/connection|link|edge/.test(name)) return 'link';
  if (/group|container|package/.test(name)) return 'folder';
  if (/config|settings|options/.test(name)) return 'gear';
  if (/user|person|actor/.test(name)) return 'person';
  if (/security|permission|role/.test(name)) return 'shield';
  if (/data|record|document/.test(name)) return 'file';
  if (/list|array|collection/.test(name)) return 'list-flat';

  return 'symbol-namespace'; // Default
}
```

**VS Code Icon Reference**: Icons come from the Codicons set used by VS Code. Full list at [microsoft/vscode-codicons](https://github.com/microsoft/vscode-codicons).

**Alternatives Considered**:

- Require manual icon specification - Increases friction
- Use ML-based icon selection - Overkill, heuristics work well
- Random assignment - Poor UX

---

## Summary

All research topics have been resolved. Key decisions:

1. **Langium Parsing**: Text-based pattern matching to extract entry rules and AST types
2. **Command Structure**: YAML frontmatter markdown with mode detection in outline
3. **Type Design**: Hierarchical TypeScript interfaces matching spec example
4. **AI Generation**: Structured prompting with validation, retry, and fallback
5. **Icon Mapping**: Heuristic-based assignment with sensible defaults

Ready for Phase 1: Design & Contracts.
