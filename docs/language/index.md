---
title: "Language Reference"
description: "Complete E C M L syntax reference"
layout: layouts/doc.njk
eleventyNavigation:
  key: Language Reference
  order: 4
---

# E C M L Language Reference

Complete reference for all E C M L constructs and syntax.

## File Structure

Every E C M L file is a **ContentModel** that contains pragmas (metadata) and statements:

```ecml
#Title "My Content Model"
#Description "Model description"

Actor User "User" "A system user"
Content Document "Document" "A document"
```

## Pragmas (Metadata)

Pragmas are metadata directives starting with `#`:

```ecml
#Title "Document Title"
#Description "Description text"
#Author "Author Name"
#Company "Company Name"
#Created "2024-01-15"
#Updated "2024-01-20"
#Version "1.0"
#Copyright "Copyright notice"
#License "License text"
```

## Core Elements

### Actor

Defines users, roles, or participants in your system:

```ecml
Actor name "Title" "Description" "Notes"
Actor name "Title" "Description" {
    property: type
}
```

**Example:**
```ecml
Actor employee "Employee" "A company employee"
Actor manager "Manager" "Department manager" {
    department: string
    level: number
}
```

### Activity

Defines high-level work items or processes:

```ecml
Activity name "Title" "Description"
Activity [Role1, Role2] name "Title" "Description" {
    Task subtask "Subtask" "Description"
}
```

**Example:**
```ecml
Activity [manager] reviewDocument "Review Document" "Manager reviews submitted document" {
    Task checkContent "Check Content" "Review document content"
    Task approve "Approve" "Approve or reject document"
}
```

### Task

Defines specific actions within activities:

```ecml
Task name "Title" "Description"
Task [Role] name "Title" "Description" {
    property: type
}
```

### Content

Defines documents, data, and content items:

```ecml
Content name "Title" "Description"
Content [type=Word] name "Title" "Description"
Content [format=DOCX, template=MyTemplate] name "Title" "Description"
```

**Attributes:**
- `template` - Reference to a template
- `format` - File format: TXT, DOCX, CSV, XLSX, PDF, MD, JSON, XML
- `type` - Content type classification
- `schema` - Schema reference

**Example:**
```ecml
Content [format=DOCX] report "Monthly Report" "Monthly status report"
Content [format=PDF] invoice "Invoice" "Customer invoice" {
    amount: decimal
    dueDate: date
}
```

### SecurityGroup

Defines groups of actors with shared permissions:

```ecml
SecurityGroup [Actor1, Actor2] name "Title" "Description"
SecurityGroup [Actor1] name "Title" "Description" = [Permission1, Permission2]
```

**Example:**
```ecml
SecurityGroup [employee, manager] staff "Staff" "All staff members"
SecurityGroup [manager] admins "Administrators" "Admin users" = [canEdit, canDelete]
```

### Permission

Defines access rights that can be assigned to actors or groups:

```ecml
Permission name "Title" "Description" "Notes"
```

**Example:**
```ecml
Permission canRead "Read" "Can view documents"
Permission canEdit "Edit" "Can modify documents"
Permission canDelete "Delete" "Can remove documents"
```

### RetentionLabel

Defines data retention policies:

```ecml
RetentionLabel name "Title" "Description" "Notes"
```

**Example:**
```ecml
RetentionLabel archiveAfterYear "Annual Archive" "Archive after one year"
RetentionLabel permanentRetention "Permanent" "Keep indefinitely"
```

### SensitivityLabel

Defines data sensitivity classifications:

```ecml
SensitivityLabel name "Title" "Description" "Notes"
```

**Example:**
```ecml
SensitivityLabel public "Public" "Publicly available"
SensitivityLabel confidential "Confidential" "Internal use only"
SensitivityLabel restricted "Restricted" "Limited access"
```

## Workflows

Define process orchestration with workflow elements:

```ecml
Workflow name "Title" "Description" {
    Do Activity1
    Do Activity2 If condition
    Repeat Activity3 Until status = complete
}
```

### Workflow Steps

**Do Step** - Execute an activity:
```ecml
Do ActivityName
Do ActivityName If condition
Do [Activity1, Activity2]  // Sequence
```

**Repeat Step** - Repeat until condition:
```ecml
Repeat ActivityName Until status = complete
Repeat ActivityName Until field = value If condition
```

### Status Values

Available status values for conditions:
- `pending` - Not yet started
- `started` - In progress
- `approved` - Approved
- `rejected` - Rejected
- `complete` - Finished
- `suspended` - Temporarily halted
- `aborted` - Cancelled

## Content Flow

Specify input/output relationships between content:

```ecml
// Input from other content
Content Output "Output" "Output document" << Input1, Input2

// Output to other content
Content Input "Input" "Input document" >> Output1, Output2

// Both input and output
Content Processor "Processor" "Processes data" << Input >> Output
```

## Label Assignment

Assign retention and sensitivity labels to content:

```ecml
// Retention label only
Content Doc "Doc" "Document" [RetentionLabel]

// Retention with sensitivity
Content Doc "Doc" "Document" [RetentionLabel(SensitivityLabel)]

// Sensitivity only
Content Doc "Doc" "Document" [(SensitivityLabel)]
```

## Comments and Annotations

**Single-line comments:**
```ecml
// This is a comment
```

**Multi-line comments:**
```ecml
/* This is a
   multi-line comment */
```

**Block annotations (documentation):**
```ecml
<#
This is a multi-line annotation
that provides detailed documentation
#>
Actor User "User" "Description"
```

## Data Types

| Type | Pattern | Example |
|------|---------|---------|
| Identifier | `[_A-Za-z][_0-9A-Za-z]*` | `MyActor`, `_private` |
| Text | `"..."` or `'...'` | `"Hello"`, `'World'` |
| Integer | `[0-9]+` | `42`, `100` |
| Decimal | `[0-9]+.[0-9]+` | `3.14`, `0.5` |
| Date | `YYYY-MM-DD` | `2024-01-15` |
