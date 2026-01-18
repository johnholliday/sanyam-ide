---
layout: layouts/doc.njk
title: Quick Reference
description: ECML syntax cheatsheet
eleventyNavigation:
  key: Quick Reference
  parent: Language
  order: 2
---

# Quick Reference

A concise cheatsheet for ECML syntax.

## Pragmas

```ecml
#Title "Model Title"
#Description "Description text"
#Author "Author Name"
#Company "Company Name"
#Version "1.0"
#Created "2024-01-15"
#Updated "2024-06-20"
#Copyright "2024 Company"
#License "License Type"
```

## Data Types

| Type | Example |
|------|---------|
| `text` | `name: text "Description"` |
| `integer` | `count: integer` |
| `decimal` | `price: decimal` |
| `date` | `dueDate: date` |
| `boolean` | `isActive: boolean` |
| `currency` | `amount: currency` |
| `memo` | `notes: memo` |
| `termset` | `category: termset` |
| `choice(...)` | `status: choice(A, B, C)` |

## Actors

```ecml
// Simple
Actor Name "Title" "Description"

// With properties
Actor Name "Title" "Description" {
    prop: text "Description"
}

// Nested
Actor Outer "Outer" "Description" {
    Actor Inner "Inner" "Nested actor"
}
```

## Content

```ecml
// Simple
Content Name "Title" "Description"

// With attributes
Content [format=DOCX, type=Word] Name "Title" "Description"

// With labels
Content Name "Title" "Description" [RetentionLabel(SensitivityLabel)]

// With flow
Content Name "Title" "Description" << InputContent >> OutputContent

// With properties
Content Name "Title" "Description" {
    prop: text "Property"
}
```

### Content Attributes

| Attribute | Values |
|-----------|--------|
| `format` | `TXT`, `DOCX`, `CSV`, `XLSX`, `PDF`, `MD`, `JSON`, `XML` |
| `type` | `Text`, `Csv`, `Excel`, `Word`, `PowerPoint`, `Markdown`, `Pdf`, `Script`, `Image`, `Diagram`, `Flowchart`, `OrgChart`, `Survey` |
| `template` | `Qualified.Name` |
| `schema` | `Qualified.Name` |

## Activities & Tasks

```ecml
// Simple activity
Activity Name "Title" "Description"

// With role assignment
Activity [Actor1, Actor2] Name "Title" "Description"

// With tasks and properties
Activity [Actor] Name "Title" "Description" {
    Task SubTask "Task Title" "Description"
    property: text "Property"
}

// With content flow
Activity Name "Title" "Description" << Input >> Output
```

## Security

```ecml
// Permission
Permission Name "Title" "Description"

// Retention label
RetentionLabel Name "Title" "Description"

// Sensitivity label
SensitivityLabel Name "Title" "Description"

// Security group (members and permissions reference Actors)
SecurityGroup [Actor1, Actor2] Name "Title" "Description" = [PermissionActor]
```

## Workflows

```ecml
Workflow Name "Title" "Description" {
    // Execute activity
    Do ActivityName

    // Conditional execution
    Do ActivityName If condition

    // Repeat until condition
    Repeat ActivityName Until status = approved

    // Repeat multiple activities
    Repeat [Activity1, Activity2] Until condition
}
```

### Conditions

```ecml
// Status conditions
If status = pending
If status = approved
If this.status = complete

// Field conditions
If Activity.field = "value"
If Activity.property = true
```

### Status Values

`pending` | `started` | `approved` | `rejected` | `complete` | `suspended` | `aborted`

## Labels

```ecml
// Retention only
[RetentionLabel]

// Sensitivity only
[(SensitivityLabel)]

// Both
[RetentionLabel(SensitivityLabel)]
```

## Content Flow

```ecml
// Input
<< Source1, Source2

// Output
>> Target1, Target2

// Both
<< Source >> Target
```

## Comments

```ecml
// Single-line comment

/* Multi-line
   comment */

<#
Block annotation
for documentation
#>
```
