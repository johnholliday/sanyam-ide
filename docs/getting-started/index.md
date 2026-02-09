---
title: "Getting Started"
layout: layouts/doc.njk
eleventyNavigation:
  key: Getting Started
  order: 2
---

# Getting Started with E C M L

This guide will help you get up and running with E C M L in just a few minutes.

## Creating Your First File

1. **Open the File Explorer** - Click the folder icon in the left sidebar or press `Ctrl+Shift+E`
2. **Create a New File** - Right-click in the explorer and select "New File", or press `Ctrl+N`
3. **Name Your File** - Give it a name ending in `.ecml` (e.g., `my-model.ecml`)

## Understanding the Interface

### The Editor Panel

The main area where you write your E C M L code. Features include:

- **Syntax Highlighting** - Keywords, strings, and identifiers are color-coded
- **Auto-Complete** - Press `Ctrl+Space` to see suggestions
- **Error Indicators** - Red underlines show errors, yellow shows warnings
- **Line Numbers** - Click to set breakpoints or select lines

### The Diagram Panel

View your model as a visual diagram:

- **Open Diagram** - Right-click your `.ecml` file and select "Open Diagram"
- **Pan** - Click and drag on empty space
- **Zoom** - Use the mouse wheel or the zoom controls
- **Select Elements** - Click on any shape to select it

### The Properties Panel

When you select an element (in code or diagram):

- View all properties of the selected element
- Edit values directly in the form
- Changes sync automatically with your code

### The Sidebar

- **Explorer** - Browse and manage your files
- **Outline** - See the structure of your current file
- **Problems** - View all errors and warnings

## Writing Your First Model

Here's a simple E C M L model to get you started:

```ecml
// Define an actor
actor Employee {
    description: "A company employee"
}

// Define some content
content Document {
    description: "A business document"
}

// Define a permission
permission canRead {
    description: "Allows reading documents"
}

// Grant the permission
Employee canRead Document
```

Save this file and you'll see:
- Syntax highlighting applied
- The outline showing your actors, content, and permissions
- No errors (if typed correctly)

## Opening the Diagram View

1. With your `.ecml` file open, right-click in the editor
2. Select **"Open Diagram"** from the context menu
3. A new tab opens showing your model as a diagram

In the diagram:
- **Actors** appear as stick figures
- **Content** appears as document shapes
- **Permissions** appear as connections between elements

## Next Steps

- Explore the [User Guide](/guide/) to learn more features
- Check out [Examples](/examples/) for real-world models
- Reference the [Language Guide](/language/) for syntax details

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| New File | `Ctrl+N` |
| Save | `Ctrl+S` |
| Open File | `Ctrl+O` |
| Auto-Complete | `Ctrl+Space` |
| Go to Definition | `F12` |
| Find | `Ctrl+F` |
| Command Palette | `Ctrl+Shift+P` |
