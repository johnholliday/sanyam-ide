---
title: "User Guide"
layout: layouts/doc.njk
eleventyNavigation:
  key: User Guide
  order: 3
---

# User Guide

This guide covers all the features of the E C M L IDE to help you work efficiently.

## Working with Files

### Creating Files

- **New File**: `Ctrl+N` or right-click in Explorer > New File
- **File Extension**: Always use `.ecml` for E C M L files
- **Templates**: Start with a blank file or copy from examples

### Opening Files

- **From Explorer**: Double-click any file
- **Quick Open**: `Ctrl+P` to search by filename
- **Recent Files**: `Ctrl+R` for recently opened files

### Saving Files

- **Save**: `Ctrl+S`
- **Save All**: `Ctrl+Shift+S`
- **Auto-Save**: Enable in Preferences for automatic saving

## Using the Text Editor

### Code Completion

Press `Ctrl+Space` anywhere to see suggestions:
- **Keywords**: All E C M L language keywords
- **References**: Names of actors, content, permissions you've defined
- **Snippets**: Common code patterns

### Navigation

- **Go to Definition**: `F12` - Jump to where something is defined
- **Find References**: `Shift+F12` - See everywhere something is used
- **Outline View**: See and jump to any element in your file

### Refactoring

- **Rename**: `F2` - Rename an element and all its references
- **Format Document**: `Shift+Alt+F` - Auto-format your code

### Error Handling

Errors appear as:
- **Red underline**: Syntax or semantic errors
- **Yellow underline**: Warnings (code works but may have issues)
- **Blue underline**: Information or suggestions

Hover over any underline to see the message. Click the lightbulb for quick fixes.

## Using the Diagram Editor

### Opening Diagrams

1. Right-click an `.ecml` file
2. Select "Open Diagram"
3. Or use the diagram icon in the editor toolbar

### Diagram Navigation

- **Pan**: Click and drag on empty space
- **Zoom In/Out**: Mouse wheel or `+`/`-` keys
- **Fit to Screen**: Press `F` or use the toolbar button
- **Center Selection**: Select an element and press `C`

### Editing in the Diagram

- **Select**: Click an element
- **Multi-Select**: `Ctrl+Click` or drag a selection box
- **Move**: Drag selected elements
- **Delete**: Select and press `Delete`

### Creating Elements

- Use the palette on the left side of the diagram
- Click a tool, then click in the diagram to place it
- Or drag from the palette directly into the diagram

### Connections

- Select the connection tool from the palette
- Click the source element
- Click the target element
- The connection is created and synced to your code

## Using the Properties Panel

### Accessing Properties

1. Select any element in the editor or diagram
2. The Properties panel shows on the right (or open via View menu)
3. Edit values directly in the form

### Property Types

- **Text fields**: Type directly
- **Dropdowns**: Select from available options
- **Checkboxes**: Toggle boolean values
- **References**: Select from existing elements

### Syncing

All changes in the Properties panel immediately update:
- The text editor
- The diagram view
- Any validation

## Keyboard Shortcuts

### General

| Action | Shortcut |
|--------|----------|
| Command Palette | `Ctrl+Shift+P` |
| Quick Open | `Ctrl+P` |
| New File | `Ctrl+N` |
| Save | `Ctrl+S` |
| Close Tab | `Ctrl+W` |
| Undo | `Ctrl+Z` |
| Redo | `Ctrl+Y` |

### Editor

| Action | Shortcut |
|--------|----------|
| Auto-Complete | `Ctrl+Space` |
| Go to Definition | `F12` |
| Find References | `Shift+F12` |
| Rename | `F2` |
| Format | `Shift+Alt+F` |
| Find | `Ctrl+F` |
| Replace | `Ctrl+H` |

### Diagram

| Action | Shortcut |
|--------|----------|
| Fit to Screen | `F` |
| Center Selection | `C` |
| Delete | `Delete` |
| Select All | `Ctrl+A` |
| Zoom In | `+` |
| Zoom Out | `-` |

## Preferences and Settings

Access settings via `Ctrl+,` or File > Preferences > Settings.

### Recommended Settings

- **Auto Save**: `files.autoSave` - Automatically save files
- **Font Size**: `editor.fontSize` - Adjust text size
- **Theme**: `workbench.colorTheme` - Light or dark mode
- **Word Wrap**: `editor.wordWrap` - Wrap long lines

## Tips and Tricks

1. **Use the Outline**: Quickly navigate large files
2. **Split Editors**: View code and diagram side by side
3. **Keyboard Shortcuts**: Learn them for faster work
4. **Auto-Complete**: Let the IDE help you write correct code
5. **Check Problems**: Fix errors before they accumulate
