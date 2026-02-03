---
title: "Language Reference"
description: "Complete ECML syntax reference"
layout: layouts/doc.njk
eleventyNavigation:
  key: Reference
  parent: Language
  order: 1
---

# ECML Language Reference

Complete reference for all ECML constructs and syntax.

## Entry Point

Every ECML file is a **ContentModel**:

```
ContentModel:
    pragmas+=Pragma*
    statements+=Statement*
```

## Pragmas

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

## Statements

### Actor

Defines users, roles, or participants:

```ecml
Actor name "Title" "Description" "Notes"
Actor name "Title" "Description" {
    property: type
}
```

**Syntax:**
```
Actor:
    'Actor' name=ID title=TEXT description=TEXT? notes=TEXT? properties=ActorBlock?
```

### Activity

Defines high-level work items:

```ecml
Activity name "Title" "Description"
Activity [Role1, Role2] name "Title" "Description" {
    Task subtask "Subtask" "Description"
}
```

**Syntax:**
```
Activity:
    'Activity' roles=RoleAssignment? name=ID title=TEXT description=TEXT? notes=TEXT?
    tasks=TaskBlock? flow=ContentFlow?
```

### Task

Defines specific actions:

```ecml
Task name "Title" "Description"
Task [Role] name "Title" "Description" {
    property: type
}
```

**Syntax:**
```
Task:
    'Task' roles=RoleAssignment? name=ID title=TEXT description=TEXT? notes=TEXT?
    tasks=TaskBlock? flow=ContentFlow?
```

### Content

Defines documents and data:

```ecml
Content name "Title" "Description"
Content [type=Word] name "Title" "Description"
Content [format=DOCX, template=MyTemplate] name "Title" "Description" {
    property: type
}
```

**Attributes:**
- `template=QualifiedName` - Template reference
- `format=ContentFormat` - File format (TXT, DOCX, CSV, XLSX, PDF, MD, JSON, XML)
- `type=ContentType` - Content type classification
- `schema=QualifiedName` - Schema reference

**Syntax:**
```
Content:
    'Content' attributes=ContentAttributes? name=ID title=TEXT description=TEXT? notes=TEXT?
    labels=LabelAssignment? flow=ContentFlow? properties=ContentBlock?
```

### SecurityGroup

Defines groups of actors:

```ecml
SecurityGroup [Actor1, Actor2] name "Title" "Description"
SecurityGroup [Actor1] name "Title" "Description" = [Permission1, Permission2]
```

**Syntax:**
```
SecurityGroup:
    'SecurityGroup' members=MemberAssignment? name=ID title=TEXT description=TEXT?
    permAssign=PermissionAssignment?
```

### Permission

Defines access rights:

```ecml
Permission name "Title" "Description" "Notes"
```

**Syntax:**
```
Permission:
    'Permission' name=ID title=TEXT description=TEXT notes=TEXT?
```

### RetentionLabel

Defines data retention policies:

```ecml
RetentionLabel name "Title" "Description" "Notes"
```

**Syntax:**
```
RetentionLabel:
    'RetentionLabel' name=ID title=TEXT description=TEXT notes=TEXT?
```

### SensitivityLabel

Defines data sensitivity classifications:

```ecml
SensitivityLabel name "Title" "Description" "Notes"
```

**Syntax:**
```
SensitivityLabel:
    'SensitivityLabel' name=ID title=TEXT description=TEXT notes=TEXT?
```

### Workflow

Defines process orchestration:

```ecml
Workflow name "Title" "Description" {
    Do Activity1
    Do Activity2 If condition
    Repeat Activity3 Until status = complete
}
```

**Syntax:**
```
Workflow:
    'Workflow' name=ID title=TEXT description=TEXT? notes=TEXT?
    '{' elements+=WorkflowElement* '}'
```

## Content Flow

Content can specify input/output relationships:

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

## Workflow Steps

### Do Step

Execute an activity:

```ecml
Do ActivityName
Do ActivityName If condition
Do [Activity1, Activity2]  // Sequence
```

### Repeat Step

Repeat until condition:

```ecml
Repeat ActivityName Until status = complete
Repeat ActivityName Until field = value If condition
```

## Conditions

Conditions for workflow control:

```ecml
// Field value condition
Activity.property = "value"

// Status condition
status = pending
status = complete

// Workflow property condition
this.property = value
```

**Status values:** `pending`, `started`, `approved`, `rejected`, `complete`, `suspended`, `aborted`

## Annotations

Block annotations for documentation:

```ecml
<#
This is a multi-line annotation
that provides detailed documentation
#>

Actor User "User" "Description"
```

## Comments

Single and multi-line comments:

```ecml
// Single line comment

/* Multi-line
   comment */
```

## Terminals

| Terminal | Pattern | Example |
|----------|---------|---------|
| `ID` | `[_A-Za-z][_0-9A-Za-z]*` | `MyActor`, `_private` |
| `TEXT` | `"..."` or `'...'` | `"Hello"`, `'World'` |
| `INT` | `[0-9]+` | `42`, `100` |
| `DECIMAL` | `[0-9]+.[0-9]+` | `3.14`, `0.5` |
| `DATE` | `YYYY-MM-DD` | `2024-01-15` |
| `ANNOT` | `<#...#>` | `<# annotation #>` |
