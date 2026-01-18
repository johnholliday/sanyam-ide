---
description: Generate AI-powered example files for a Langium grammar (.langium file or grammar package name)
---

## User Input

```text
$ARGUMENTS
```

## Overview

Generate syntactically valid, domain-relevant example files for a Langium grammar. Examples are output to the correct grammar workspace folder structure for testing.

## Input Resolution

The argument `$ARGUMENTS` should be one of:
1. **Path to a .langium file** (e.g., `packages/grammar-definitions/grammarName.langium` or absolute path)
2. **Grammar name** to search for in the `packages/grammar-definitions/` directory (e.g., `grammarName`, `spdevkit`, `novel`)

### Step 1: Resolve the Grammar File

1. If `$ARGUMENTS` is empty, ask the user to provide a grammar file path or name
2. If `$ARGUMENTS` ends with `.langium`, treat it as a file path:
   - If relative, resolve from the current working directory
   - Read the file directly
3. If `$ARGUMENTS` doesn't end with `.langium`, search for a matching grammar:
   - Search `packages/grammar-definitions/**/*.langium` and `packages/grammar-definitions/*.langium` for files matching the name (case-insensitive)
   - If multiple matches found, list them and ask the user to specify
   - If no matches found, report the error

### Step 2: Ensure Package Structure Exists

After resolving the grammar file path, ensure the grammar package folder exists:

1. **Read the grammar file** and extract the grammar name (from `grammar <name>` declaration)
2. **Derive the package name**: `@sanyam-grammar/<lowercase-grammar-name>`
   - Example: `grammar TaskList` → `@sanyam-grammar/tasklist`
3. **Check if the package exists**: Look for `packages/grammar-definitions/<name>/src/` directory
   - Use the Glob tool to check: `packages/grammar-definitions/<name>/src/`
4. **If the package doesn't exist**:
   - Inform the user: "Grammar package structure not found. Creating scaffold..."
   - **Prompt the user for the file extension** using AskUserQuestion:
     - Question: "What file extension should be used for this grammar?"
     - Header: "Extension"
     - Options:
       - `.<lowercase-grammar-name>` (e.g., `.tasklist`) - "Use grammar name as extension (Recommended)"
       - `.dsl` - "Generic DSL extension"
       - `.lang` - "Generic language extension"
     - The user can also select "Other" to provide a custom extension
5. **If the package already exists**:
   - Read `langium-config.json` to get the `fileExtensions` array (e.g., `"fileExtensions": [".ecml"]`)
   - Or read `manifest.ts` to get the `fileExtension` property
   - Use that extension for all generated examples
6. **Set the output paths for auto-save**:
   - Individual examples: `workspace/<name>/`
   - Base template: `workspace/<name>/templates/new-file.<ext>`
   - File extension: Use the extension from step 4 (user prompt) or step 5 (existing config)

### Step 3: Analyze the Grammar

Extract key information from the grammar content:

1. Grammar name (from `grammar <Name>` declaration)
2. Entry rule (from `entry <RuleName>:` declaration)
3. All keywords (quoted strings like `'entity'`, `'mapping'`, etc.)
4. Terminal definitions (especially BOOLEAN, INT, STRING types)
5. Main parser rules

### Step 4: Generate, Save, and Validate Examples

Generate **6 example files** following this distribution:
- 3 **basic** examples (single concept, minimal syntax)
- 2 **intermediate** examples (multiple concepts, realistic usage)
- 1 **advanced** example (complex scenarios, best practices)

**For each example** (validation loop - max 3 attempts):

1. **Generate** the content following grammar compliance rules
2. **Save** using the Write tool to:

   ```text
   workspace/<name>/<complexity>-<kebab-name>.<ext>
   ```

3. **Validate** using Langium 4.x programmatic API via the following Node.js script (ESM):

   ```bash
   node --input-type=module -e "
   import { createServicesForGrammar } from 'langium/grammar';
   import { parseHelper } from 'langium/test';
   import { readFileSync } from 'fs';

   async function validate() {
     const grammarText = readFileSync('$GRAMMAR_PATH', 'utf-8');
     const fileText = readFileSync('$FILE_PATH', 'utf-8');

     const services = await createServicesForGrammar({
       grammar: grammarText,
       languageMetaData: {
         languageId: '$LANG_ID',
         fileExtensions: ['.$EXT'],
         caseInsensitive: false
       }
     });

     const parse = parseHelper(services);
     const document = await parse(fileText, { validation: true });

     const diagnostics = document.diagnostics ?? [];
     const errors = diagnostics.filter(d => d.severity === 1);

     console.log(JSON.stringify({
       valid: errors.length === 0,
       errors: errors.map(e => ({ line: e.range.start.line + 1, message: e.message })),
       warnings: diagnostics.filter(d => d.severity === 2).map(w => ({ line: w.range.start.line + 1, message: w.message }))
     }, null, 2));
   }
   validate().catch(e => console.log(JSON.stringify({ valid: false, errors: [{ line: 0, message: e.message }] })));
   "
   ```

   Replace:
   - `$GRAMMAR_PATH` with the resolved grammar file path (absolute path)
   - `$FILE_PATH` with the example file path (absolute path)
   - `$LANG_ID` with the lowercase grammar name (e.g., `spdevkit`)
   - `$EXT` with the file extension without dot (e.g., `spdk`)

4. **Check validation result** (parse JSON output):
   - If `valid: true` → Example is complete, report success, move to next
   - If `valid: false` → Regeneration needed (continue to step 5)
5. **On validation failure** (if attempts < 3):
   - Note the errors from the JSON `errors` array
   - Regenerate the example with this additional context:

     ```text
     VALIDATION FAILED - Previous attempt had these errors:
     - Line X: [error message]
     - Line Y: [error message]

     Fix these specific issues and regenerate a corrected version.
     Pay close attention to the grammar syntax requirements.
     ```

   - Save the corrected content (overwrites previous file)
   - Validate again (loop back to step 3)
6. **After 3 failed attempts**:
   - Report the example as FAILED with the last validation errors
   - Continue to the next example (do not stop the whole process)
   - Do NOT count failed examples in the success summary

**After all examples**, generate and save the base template:

```text
workspace/<name>/templates/new-file.<ext>
```

Note: The base template does NOT require validation (it contains TODO placeholders).

## Critical Grammar Compliance Rules

When generating examples, you MUST follow these rules strictly:

### Keywords
- Use ONLY keywords explicitly defined in the grammar (quoted strings like `'entity'`, `'application'`)
- The entry rule defines what can appear at the top level
- DO NOT invent new keywords - if `'namespace'` is not in the grammar, don't use it
- Look for patterns like `'keyword' name=ID` in the grammar

### Terminal Values
- **BOOLEAN**: MUST be unquoted lowercase `true` or `false` (NOT `"true"`, NOT `'true'`, NOT `True`)
- **INT/NUMBER**: Use unquoted integers like `1`, `42`, `100` (NOT quoted)
- **STRING**: Use quoted strings like `"hello"` or `'world'`
- **ID**: Use valid identifiers (letters, digits, underscores, starting with letter)

### Structure
- Follow the entry rule structure exactly
- Limit recursion/nesting depth to 2-3 levels for readability
- Include helpful comments explaining the example

## Output Format

For each generated example, output in this format:

**For successful examples:**
```
### Example N: [complexity] - [name]

**Description**: [What this example demonstrates]

**Saved to**: `workspace/<name>/[complexity]-[kebab-case-name].[extension]`

**Validation**: ✓ Valid (attempt 1 of 3)

**Content**:
\`\`\`[language-id]
[The actual file content - syntactically valid according to the grammar]
\`\`\`
```

**For examples that required multiple attempts:**
```
### Example N: [complexity] - [name]

**Validation**: ✓ Valid after 2 attempts (previous errors were fixed)

...
```

**For failed examples (after 3 attempts):**
```
### Example N: [complexity] - [name] ⚠️ FAILED

**Validation**: ✗ Failed after 3 attempts

**Last Validation Errors**:
- [error 1]
- [error 2]

**Note**: This example could not be generated with valid syntax. Manual creation may be needed.
```

After all examples, provide:
1. A summary: "Generated X of 6 examples successfully (Y failed validation)"
2. The package location: `workspace/<name>/`

## Example Workflow

If the user runs `/grammar-examples spdevkit`:

1. Search for `spdevkit.langium` in `packages/grammar-definitions/` directory
2. Find `packages/grammar-definitions/spdevkit.langium` (standalone grammar file)
3. Extract grammar name: `SPDevKit` → package `@sanyam-grammar/spdevkit`
4. Check if `packages/grammar-definitions/spdevkit/` exists
5. If package doesn't exist:
   - Prompt user for file extension (options: `.spdevkit`, `.dsl`, `.lang`, or custom)
   - User selects `.spdk` as custom extension
6. If package exists (e.g., `ecml`):
   - Read `packages/grammar-definitions/ecml/langium-config.json`
   - Get extension from `"fileExtensions": [".ecml"]`
7. Read the grammar content
8. Extract: keywords (`application`, `entity`, `service`, `workflow`), entry rule (`Model`), terminals (`ID`, `STRING`, `INT`)
9. For each of the 6 examples:
   - Generate content following grammar rules
   - Save to `workspace/spdevkit/basic-example-name.spdk`
   - Validate using Langium 4.x programmatic API
   - If valid: report success
   - If invalid: regenerate with error feedback (up to 3 attempts)
10. Generate and save base template to `workspace/spdevkit/templates/new-file.spdk`
11. Report completion: "Generated 6 of 6 examples successfully"

**Another example** with existing package structure - `/grammar-examples ecml`:

1. Search for `ecml.langium` in `packages/grammar-definitions/`
2. Find `packages/grammar-definitions/ecml/src/ecml.langium` (inside package)
3. Extract grammar name: `Ecml`
4. Check if `packages/grammar-definitions/ecml/` exists → **YES**
5. Read `packages/grammar-definitions/ecml/langium-config.json` → `"fileExtensions": [".ecml"]`
6. Use `.ecml` extension for all examples
7. Continue with generation and validation...

## Error Handling

- If grammar file not found: List available grammars and ask user to specify
- If grammar is invalid/malformed: Report the parsing issue
- If ambiguous match: List all matches and ask for clarification
- If validation script fails to execute: Check that Langium is installed (`pnpm exec langium --version`), report the error and suggest manual troubleshooting
- If validation fails after 3 attempts: Mark the example as failed, report errors, continue to next example

## Notes

- This command uses your Claude subscription directly - no additional API keys needed
- Examples are **automatically saved** to the grammar workspace folder
- **All examples are validated** using the Langium CLI before being marked as complete
