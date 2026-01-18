---
title: "Getting Started"
description: "Set up your first ECML content model"
layout: layouts/doc.njk
eleventyNavigation:
  key: Getting Started
  order: 2
---

# Getting Started with ECML

This guide walks you through creating your first ECML content model.

## Prerequisites

- A text editor with ECML language support
- Basic understanding of content management concepts

## Your First ECML File

Create a new file with the `.ecml` extension:

```ecml
#Title "My First Content Model"
#Author "Your Name"
#Version "1.0"

// Define an actor
Actor Admin "Administrator" "System administrator"

// Define content
Content Report "Monthly Report" "Monthly financial report"
```

## File Structure

An ECML file typically follows this structure:

1. **Pragmas** - File metadata at the top
2. **Actors** - User and role definitions
3. **Security** - Labels, permissions, groups
4. **Content** - Document and data definitions
5. **Activities/Tasks** - Work items
6. **Workflows** - Process orchestration

## Pragmas

Pragmas provide metadata about your content model:

```ecml
#Title "Content Model Name"
#Description "What this model represents"
#Author "Author Name"
#Company "Company Name"
#Version "1.0"
#Created "2024-01-15"
#Updated "2024-01-20"
```

## Defining Actors

Actors represent users and roles:

```ecml
// Basic actor
Actor Editor "Content Editor" "Creates and edits content"

// Actor with properties
Actor Manager "Content Manager" "Manages content lifecycle" {
    department: text "Marketing"
    level: integer
}
```

## Defining Content

Content represents documents and data:

```ecml
// Simple content
Content Invoice "Invoice Document" "Customer invoice"

// Content with attributes
Content [type=Excel, format=XLSX] Budget "Budget Spreadsheet" "Annual budget"

// Content with properties
Content Contract "Contract Document" "Legal contract" {
    effectiveDate: date
    expirationDate: date
    value: currency
}
```

## Next Steps

- [Language Reference](/language/reference/) - Complete syntax documentation
- [Quick Reference](/language/quick-reference/) - Syntax cheatsheet
- [Examples](/examples/) - See ECML patterns in action
