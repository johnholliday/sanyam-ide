---
title: "Language Overview"
description: "Overview of the ECML language structure"
layout: layouts/doc.njk
eleventyNavigation:
  key: Language
  order: 3
---

# ECML Language Overview

ECML (Enterprise Content Modeling Language) provides a structured way to define content management systems, workflows, and security policies.

## Language Structure

An ECML file is a **ContentModel** containing:

1. **Pragmas** - Metadata directives (optional)
2. **Statements** - The actual model definitions

```ecml
// Pragmas (metadata)
#Title "My Model"
#Version "1.0"

// Statements (content)
Actor User "User" "System user"
Content Document "Document" "A document"
```

## Statement Types

ECML supports these statement types:

| Statement | Purpose |
|-----------|---------|
| `Actor` | Define users, roles, and participants |
| `Activity` | High-level work items |
| `Task` | Specific actions within activities |
| `Content` | Documents, files, and data |
| `SecurityGroup` | Groups of actors with permissions |
| `Permission` | Access rights definitions |
| `RetentionLabel` | Data retention policies |
| `SensitivityLabel` | Data classification levels |
| `Workflow` | Process orchestration |

## Data Types

Properties use these data types:

| Type | Description | Example |
|------|-------------|---------|
| `text` | String values | `name: text` |
| `integer` | Whole numbers | `count: integer` |
| `decimal` | Decimal numbers | `rate: decimal` |
| `date` | Date values | `created: date` |
| `boolean` | True/false | `active: boolean` |
| `currency` | Money values | `price: currency` |
| `memo` | Long text | `notes: memo` |
| `termset` | Term set reference | `category: termset` |
| `choice(...)` | Enumeration | `status: choice(Draft, Final)` |

## Content Formats

Content can specify file formats:

| Format | Description |
|--------|-------------|
| `TXT` | Plain text |
| `DOCX` | Word document |
| `XLSX` | Excel spreadsheet |
| `CSV` | Comma-separated values |
| `PDF` | PDF document |
| `MD` | Markdown |
| `JSON` | JSON data |
| `XML` | XML data |

## Content Types

Content can be classified by type:

| Type | Description |
|------|-------------|
| `Text` | Plain text content |
| `Word` | Word document |
| `Excel` | Excel spreadsheet |
| `PowerPoint` | Presentation |
| `Pdf` | PDF document |
| `Markdown` | Markdown content |
| `Script` | Script/code |
| `Image` | Image file |
| `Diagram` | Diagram |
| `Flowchart` | Flowchart diagram |
| `OrgChart` | Organization chart |
| `Survey` | Survey form |

## Next Steps

- [Language Reference](/language/reference/) - Complete syntax documentation
- [Quick Reference](/language/quick-reference/) - Syntax cheatsheet
- [Tutorial](/language/tutorial/) - Step-by-step guide
