---
title: "Quick Reference"
description: "ECML syntax cheatsheet"
layout: layouts/doc.njk
eleventyNavigation:
  key: Quick Reference
  parent: Language
  order: 2
---

# ECML Quick Reference

A handy cheatsheet for ECML syntax.

## Pragmas

```ecml
#Title "Title"
#Description "Description"
#Author "Author"
#Company "Company"
#Created "2024-01-15"
#Updated "2024-01-20"
#Version "1.0"
#Copyright "Copyright"
#License "License"
```

## Actors

```ecml
// Basic
Actor name "Title" "Description"

// With notes
Actor name "Title" "Description" "Notes"

// With properties
Actor name "Title" "Description" {
    property: type
}
```

## Content

```ecml
// Basic
Content name "Title" "Description"

// With attributes
Content [type=Word] name "Title"
Content [format=DOCX] name "Title"
Content [type=Excel, format=XLSX] name "Title"

// With labels
Content name "Title" [RetentionLabel]
Content name "Title" [RetentionLabel(SensitivityLabel)]

// With flow
Content name "Title" << Input1, Input2
Content name "Title" >> Output1
Content name "Title" << Input >> Output

// With properties
Content name "Title" {
    property: type
}
```

## Activities & Tasks

```ecml
// Basic activity
Activity name "Title" "Description"

// With role assignment
Activity [Role1, Role2] name "Title"

// With nested tasks
Activity name "Title" {
    Task subtask1 "Subtask 1" "Description"
    Task subtask2 "Subtask 2" "Description"
}

// Task with properties
Task name "Title" {
    property: type
}
```

## Security

```ecml
// Permission
Permission name "Title" "Description"

// Security group
SecurityGroup name "Title" "Description"
SecurityGroup [Actor1, Actor2] name "Title"
SecurityGroup [Actor1] name "Title" = [Perm1, Perm2]

// Retention label
RetentionLabel name "Title" "Description"

// Sensitivity label
SensitivityLabel name "Title" "Description"
```

## Workflows

```ecml
Workflow name "Title" {
    // Execute activity
    Do Activity1
    
    // Conditional execution
    Do Activity2 If status = complete
    
    // Execute sequence
    Do [Activity1, Activity2, Activity3]
    
    // Repeat until condition
    Repeat Activity Until status = approved
    
    // Repeat with condition
    Repeat Activity Until status = complete If this.status = started
}
```

## Data Types

| Type | Usage |
|------|-------|
| `text` | `name: text` |
| `integer` | `count: integer` |
| `decimal` | `rate: decimal` |
| `date` | `created: date` |
| `boolean` | `active: boolean` |
| `currency` | `price: currency` |
| `memo` | `notes: memo` |
| `termset` | `category: termset` |
| `choice(...)` | `status: choice(Draft, Final, Archived)` |

## Content Formats

`TXT` | `DOCX` | `CSV` | `XLSX` | `PDF` | `MD` | `JSON` | `XML`

## Content Types

`Text` | `Csv` | `Excel` | `Word` | `PowerPoint` | `Markdown` | `Pdf` | `Script` | `Image` | `Diagram` | `Flowchart` | `OrgChart` | `Survey`

## Status Values

`pending` | `started` | `approved` | `rejected` | `complete` | `suspended` | `aborted`

## Comments & Annotations

```ecml
// Single line comment

/* Multi-line
   comment */

<#
Block annotation for
detailed documentation
#>
```

## Property Initializers

```ecml
Actor name "Title" {
    status: text = "Active"
    count: integer = 0
    enabled: boolean = true
}
```
