# SANYAM Platform Constitution

## Purpose

This constitution defines the guiding principles, constraints, and standards that govern all development on the grammar-agnostic platform initiative. Claude Code and all contributors must adhere to these principles.

---

## Phase Gate Protocol

**CRITICAL — These directives govern ALL speckit workflow phases (specify, plan, tasks, implement).**

1. **NEVER advance to the next phase without explicit user approval.** Each phase boundary is a hard gate. The agent MUST stop, present its output, and wait for the user to confirm before proceeding. Silence is NOT approval. A handoff button click IS approval for the next phase only.

2. **At each phase checkpoint, present your reasoning and assumptions as a numbered list for review before proceeding.** This includes:
   - All assumptions made during the phase (with evidence and impact-if-wrong)
   - All decisions taken and their rationale
   - Any deviations from the spec, plan, or prior phase outputs
   - The agent MUST NOT bury assumptions in prose — they must be an explicit, scannable numbered list.

3. **Surface all architectural trade-offs as explicit questions — do not resolve ambiguity autonomously.** When the agent encounters:
   - Multiple valid implementation approaches
   - Ambiguous or underspecified requirements
   - Tensions between competing constraints (e.g., performance vs. simplicity)
   - Technology choices not already locked in by the constitution or spec

   ...it MUST present the trade-off as an explicit question with labeled options, NOT silently pick one. The user decides; the agent advises.

4. **Phase outputs are immutable once approved.** If a later phase reveals a problem with an earlier phase's output, the agent MUST flag this as a "Phase N Revision Request" and get explicit approval before modifying the earlier artifact. It MUST NOT silently patch approved outputs.

5. **Externalize all reasoning — no opaque decisions.** The agent MUST NOT compress architectural reasoning into unexplained conclusions. Specifically:

   a. **Written rationale for every architectural decision in the Plan phase.** Each decision MUST be recorded as an Architectural Decision Record (ADR) with:
      - **Decision**: What was decided
      - **Context**: What problem or requirement drove this decision
      - **Rationale**: Why this option was chosen (concrete, not "it's the best approach")
      - **Alternatives considered**: Every alternative evaluated, with a one-line reason for rejection
      - **Consequences**: What this decision enables and what it constrains

   b. **Explicit enumeration of alternatives considered and rejected.** For every non-trivial decision (technology choice, data model shape, API pattern, architectural boundary), the agent MUST list at least 2 alternatives it considered and explain why each was rejected. A decision with no alternatives listed is presumed to be unexamined.

   c. **Dependency graph for the Tasks phase — not just a flat task list.** The tasks.md output MUST include a structured dependency graph that shows:
      - Which tasks block which other tasks (directed edges)
      - Which tasks can execute in parallel (no shared edges)
      - The critical path (longest chain from start to finish)
      - Cross-story dependencies (if any)

      Format: Use a Mermaid `graph TD` diagram OR a structured adjacency list. A flat numbered list with prose descriptions of ordering is NOT sufficient.

6. **Checkpoint format.** At every phase gate, the agent MUST output:

   ```text
   ## Phase [N] Checkpoint — [Phase Name]

   ### Assumptions (numbered)
   1. ...
   2. ...

   ### Decisions taken
   - ...

   ### Open questions (if any)
   - ...

   ### Trade-offs requiring your input (if any)
   - ...

   ⏸️ AWAITING APPROVAL — Please review the above before I proceed to Phase [N+1].
   ```

---

## Core Principles

### 1. Grammar Agnosticism

All platform code MUST be independent of any specific grammar. Hard-coded AST type names, file extensions, folder names, or diagram configurations are PROHIBITED in platform packages. Grammar-specific knowledge flows ONLY through:

- `GrammarManifest` declarations
- Registry service lookups
- Grammar package registrations

### 2. Backward Compatibility

Existing SANYAM functionality MUST NOT regress. All current tests MUST pass after each phase. Deprecation is preferred over removal. When breaking changes are unavoidable, provide migration paths with clear documentation.

### 3. Declarative Over Imperative

Prefer declarative configuration (JSON manifests) over imperative code for grammar-specific behavior. Grammar developers should express WHAT they want, not HOW to achieve it.

### 4. Extension Over Modification

Platform components MUST be extensible without modification. Grammar packages extend platform behavior through:

- Registry registrations
- Dependency injection bindings
- Component overrides (not patches)

---

## Technology Stack

### Required

| Technology    | Version | Purpose                   |
| ------------- | ------- | ------------------------- |
| TypeScript    | 5.x     | All source code           |
| Langium       | 4.x     | Language server framework |
| Eclipse GLSP  | 2.x     | Diagram framework         |
| Eclipse Theia | 1.x     | IDE framework             |
| Inversify     | 6.x     | Dependency injection      |
| React         | 18.x    | Form components           |

### Prohibited

- Python (use TypeScript for all tooling)
- Direct DOM manipulation in React components
- `any` type without explicit justification
- Circular dependencies between packages
- Runtime `eval()` or dynamic code execution

---

## Architecture Constraints

### Package Boundaries

```
@sanyam/types  → Interfaces only, no implementations
@sanyam/platform-core      → Theia integrations, may depend on protocol
@sanyam/diagram-service      → GLSP integrations, may depend on protocol
@sanyam/form-service     → React components, may depend on protocol
@sanyam-grammar/*          → Grammar packages, peerDepend on platform-*
```

### Dependency Rules

1. Platform packages MUST NOT depend on grammar packages
2. Grammar packages MUST use `peerDependencies` for platform packages
3. Circular dependencies are FORBIDDEN
4. Prefer interfaces over concrete types in public APIs

### Service Patterns

1. All services MUST be injectable via Inversify
2. Services MUST be bound in singleton scope unless stateful
3. Services MUST expose interfaces, not implementations
4. Services MUST emit events for state changes (not callbacks)

---

## Code Standards

### TypeScript

```typescript
// REQUIRED: Explicit return types on public methods
public getFolder(astType: string): string { ... }

// REQUIRED: JSDoc on all public APIs
/**
 * Resolves the folder name for an AST type.
 * @param astType - The AST type name from the grammar
 * @returns Folder name or empty string if not found
 */

// REQUIRED: Readonly for immutable data
readonly manifest: GrammarManifest;

// PROHIBITED: any without justification
function process(data: any) { ... } // BAD
function process(data: unknown) { ... } // GOOD

// REQUIRED: Null checks with optional chaining
const folder = config?.rootType?.folder ?? '';
```

### React Components

```tsx
// REQUIRED: Functional components with explicit props interface
interface FormProps {
  model: AstNodeModel;
  onChange: (model: AstNodeModel) => void;
}

export const GenericForm: React.FC<FormProps> = ({ model, onChange }) => {
  // REQUIRED: Hooks at top level only
  const [state, setState] = useState(...);

  // PROHIBITED: Direct DOM manipulation
  // document.getElementById(...) // BAD

  // REQUIRED: Memoization for expensive computations
  const computed = useMemo(() => ..., [deps]);
};
```

### Testing

```typescript
// REQUIRED: Describe blocks match file structure
describe('FileTypeService', () => {
  describe('getFolder', () => {
    it('should return folder for known AST type', () => { ... });
    it('should return empty string for unknown type', () => { ... });
  });
});

// REQUIRED: Arrange-Act-Assert pattern
it('should register grammar', () => {
  // Arrange
  const registry = new GrammarRegistryImpl();

  // Act
  registry.register(manifest, services);

  // Assert
  expect(registry.get('sanyam')).toBeDefined();
});
```

---

## Performance Requirements

| Operation                   | Maximum Latency |
| --------------------------- | --------------- |
| Grammar registration        | 100ms           |
| File type resolution        | 10ms            |
| Tool palette generation     | 50ms            |
| GModel creation (100 nodes) | 200ms           |
| Form render                 | 100ms           |

---

## Documentation Requirements

### Public APIs

- JSDoc on all exported functions, classes, interfaces
- @param for all parameters
- @returns for return values
- @throws for exceptions
- @example for complex usage

### Specifications

- User stories with acceptance criteria
- Functional requirements with code examples
- Test cases for each requirement
- Effort estimates in hours

### README Files

- Each package MUST have README.md
- Include: purpose, installation, usage, API reference

---

## Error Handling

### Principles

1. Fail fast with descriptive errors during development
2. Graceful degradation in production
3. Never swallow errors silently
4. Log errors with context

### Patterns

```typescript
// REQUIRED: Validation at boundaries
register(manifest: GrammarManifest): void {
  const validation = validateManifest(manifest);
  if (!validation.valid) {
    throw new Error(`Invalid manifest: ${validation.errors.join(', ')}`);
  }
  // ...
}

// REQUIRED: Optional chaining for lookups
getRootType(uri: string): RootTypeConfig | undefined {
  return this.grammarRegistry
    .getByUri(uri)
    ?.manifest
    .rootTypes
    .find(rt => uri.endsWith(rt.fileSuffix + manifest.baseExtension));
}
```

---

## Security Constraints

1. NO execution of user-provided code
2. NO file system access outside workspace
3. NO network requests without user consent
4. Sanitize all user input before display
5. Validate manifest content against schema

---

## Accessibility Requirements

1. All form inputs MUST have labels
2. All icons MUST have aria-labels
3. Keyboard navigation MUST work for all interactions
4. Color MUST NOT be the only indicator of state
5. Follow WCAG 2.1 AA guidelines

---

## Version Control

### Commit Messages

```
type(scope): description

- feat: New feature
- fix: Bug fix
- refactor: Code change that neither fixes nor adds
- docs: Documentation only
- test: Adding or updating tests
- chore: Build, CI, tooling changes
```

### Branch Strategy

```
main              ← Production ready
├── develop       ← Integration branch
│   ├── feat/001-extract-protocol    ← Feature branches by phase
│   ├── feat/002-core-services
│   └── fix/file-type-resolution
```

---

## Review Checklist

Before merging any PR:

- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] JSDoc on public APIs
- [ ] No hard-coded grammar-specific values in platform code
- [ ] Performance benchmarks pass
- [ ] Backward compatibility verified
- [ ] Documentation updated

---

## Amendments

This constitution may be amended by:

1. Proposing changes in a specification
2. Discussing impact on existing code
3. Updating this document
4. Communicating changes to all contributors
