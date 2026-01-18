---
layout: layouts/doc.njk
title: Language Reference
description: Complete ECML syntax reference
eleventyNavigation:
  key: Reference
  parent: Language
  order: 1
---

# Language Reference

This document provides a complete reference for the ECML syntax.

## File Structure

An ECML file consists of:

1. **Pragmas** (optional) - Metadata about the model
2. **Statements** - The actual content model definitions

```ecml
#Title "Model Title"
#Version "1.0"

// Statements here
Actor MyActor "Title" "Description"
```

## Pragmas

Pragmas define metadata for the content model. Each pragma starts with `#` followed by a keyword and a quoted string value.

```ecml
#Title "Contract Approval System"
#Description "End-to-end contract workflow"
#Author "Enterprise Architecture Team"
#Company "Acme Corporation"
#Version "2.1"
#Created "2024-01-15"
#Updated "2024-06-20"
#Copyright "2024 Acme Corporation"
#License "Proprietary"
```

### Available Pragmas

| Pragma | Description |
|--------|-------------|
| `#Title` | Model title |
| `#Description` | Detailed description |
| `#Author` | Author name |
| `#Company` | Organization name |
| `#Version` | Version string |
| `#Created` | Creation date |
| `#Updated` | Last modification date |
| `#Copyright` | Copyright notice |
| `#License` | License information |

## Data Types

ECML supports the following primitive data types for properties:

| Type | Description | Example |
|------|-------------|---------|
| `text` | Text string | `name: text` |
| `integer` | Whole number | `count: integer` |
| `decimal` | Decimal number | `price: decimal` |
| `date` | Date value | `dueDate: date` |
| `boolean` | True/false | `isActive: boolean` |
| `currency` | Monetary value | `amount: currency` |
| `memo` | Long text | `notes: memo` |
| `termset` | Controlled vocabulary | `category: termset` |

### Choice Type

For enumerated values, use the `choice` type:

```ecml
priority: choice(Low, Medium, High, Critical)
status: choice(Draft, Review, Approved, Rejected)
```

## Actors

Actors represent participants in your enterprise model - people, roles, or systems.

### Basic Syntax

```ecml
Actor <name> <title> [description] [notes]
```

### Examples

```ecml
// Simple actor
Actor Admin "Administrator" "System admin with full access"

// Actor with properties
Actor Reviewer "Document Reviewer" "Reviews documents" {
    department: text "Reviewer's department"
    level: choice(Junior, Senior, Lead)
}

// Nested actors
Actor Team "Team" "A team of people" {
    Actor Lead "Team Lead" "Leads the team"
    Actor Member "Team Member" "Team member"
}
```

## Content

Content represents documents, files, and data artifacts.

### Basic Syntax

```ecml
Content [attributes] <name> <title> [description] [notes] [labels] [flow] [properties]
```

### Attributes

Content can have optional attributes in square brackets:

| Attribute | Values | Description |
|-----------|--------|-------------|
| `format` | `TXT`, `DOCX`, `CSV`, `XLSX`, `PDF`, `MD`, `JSON`, `XML` | File format |
| `type` | `Text`, `Csv`, `Excel`, `Word`, `PowerPoint`, `Markdown`, `Pdf`, `Script`, `Image`, `Diagram`, `Flowchart`, `OrgChart`, `Survey` | Content type |
| `template` | Qualified name | Template reference |
| `schema` | Qualified name | Schema reference |

### Examples

```ecml
// Simple content
Content Report "Monthly Report" "Financial summary"

// Content with attributes
Content [format=DOCX, type=Word] Contract "Contract" "Legal contract"

// Content with properties
Content Invoice "Invoice" "Payment invoice" {
    amount: currency "Invoice amount"
    dueDate: date "Payment due date"
    status: choice(Draft, Sent, Paid, Overdue)
}
```

### Labels

Apply retention and sensitivity labels using square brackets after the description:

```ecml
Content [format=PDF] Report "Report" "Annual report" [SevenYear(Confidential)]
```

### Content Flow

Define input (`<<`) and output (`>>`) relationships:

```ecml
Content Draft "Draft" "Initial draft"
Content Final "Final" "Final version"

// Takes Draft as input
Content Review "Review" "Review copy" << Draft

// Produces Final as output
Activity Approve "Approve" "Approval process" >> Final

// Both input and output
Content Processed "Processed" "Processed data" << Draft >> Final
```

## Activities

Activities represent business processes and workflows.

### Basic Syntax

```ecml
Activity [roles] <name> <title> [description] [notes] [tasks] [flow]
```

### Role Assignment

Assign actors to activities using square brackets:

```ecml
Activity [Reviewer] ReviewDoc "Review Document" "Review the document"
Activity [Manager, Analyst] AnalyzeData "Analyze Data" "Perform analysis"
```

### Nested Tasks

Activities can contain tasks and properties:

```ecml
Activity [Reviewer] ReviewProcess "Review Process" "Complete review" {
    Task CheckFormat "Check Format" "Verify formatting"
    Task ValidateData "Validate Data" "Check data accuracy"
    dueDate: date "Review deadline"
    priority: choice(High, Medium, Low)
}
```

## Tasks

Tasks are similar to activities but represent smaller units of work.

### Basic Syntax

```ecml
Task [roles] <name> <title> [description] [notes] [subtasks] [flow]
```

### Examples

```ecml
// Simple task
Task Review "Review" "Review the document"

// Task with subtasks
Task Validate "Validate" "Validation process" {
    Task CheckFormat "Check Format" "Format validation"
    Task CheckContent "Check Content" "Content validation"
}
```

## Security

### Permissions

Define access permissions:

```ecml
Permission ReadOnly "Read Only" "View content without modification"
Permission ReadWrite "Read Write" "Full read and write access"
Permission Admin "Administrator" "Complete system access"
```

### Security Groups

Group actors with assigned permissions:

```ecml
// Define actors first
Actor Manager "Manager" "Department manager"
Actor Analyst "Analyst" "Data analyst"
Actor FullAccess "Full Access" "Role with full access"

// Create security group with members and permissions
SecurityGroup [Manager, Analyst] DataTeam "Data Team" "Analytics group" = [FullAccess]
```

### Retention Labels

Define retention policies:

```ecml
RetentionLabel ThreeYear "3 Year Retention" "Retain for 3 years"
RetentionLabel SevenYear "7 Year Retention" "Retain for 7 years per regulations"
RetentionLabel Permanent "Permanent" "Retain indefinitely"
```

### Sensitivity Labels

Define sensitivity classifications:

```ecml
SensitivityLabel Public "Public" "Can be shared externally"
SensitivityLabel Internal "Internal" "Internal use only"
SensitivityLabel Confidential "Confidential" "Restricted access"
SensitivityLabel Secret "Secret" "Highly restricted"
```

### Applying Labels to Content

```ecml
// Retention only
Content Report "Report" "Report" [ThreeYear]

// Sensitivity only
Content Memo "Memo" "Internal memo" [(Confidential)]

// Both retention and sensitivity
Content Contract "Contract" "Legal contract" [SevenYear(Confidential)]
```

## Workflows

Workflows orchestrate activities with conditional logic.

### Basic Syntax

```ecml
Workflow <name> <title> [description] [notes] {
    // workflow steps
}
```

### Workflow Steps

#### Do Step

Execute an activity:

```ecml
Do SubmitRequest
Do ReviewDocument If status = approved
```

#### Repeat Step

Repeat activities until a condition is met:

```ecml
Repeat ReviewCycle Until status = approved
Repeat [Review, Revise] Until this.status = complete
```

### Conditions

#### Status Conditions

```ecml
If status = approved
If status = rejected
If this.status = complete

// Available status values:
// pending, started, approved, rejected, complete, suspended, aborted
```

#### Field Value Conditions

```ecml
If Review.priority = "High"
If Document.classification = "Confidential"
```

### Complete Workflow Example

```ecml
Workflow ContractApproval "Contract Approval" "Main approval workflow" {
    Do SubmitContract
    Do LegalReview
    Do FinanceReview If LegalReview.status = approved
    Repeat [LegalReview, FinanceReview] Until status = approved
    Do FinalApproval If this.status = approved
}
```

## Annotations

Annotations provide additional documentation using block comments:

```ecml
<#
This is a block annotation.
It can span multiple lines and provides
additional context for the following element.
#>
Activity ComplexProcess "Complex Process" "A process that needs explanation"
```

## Comments

ECML supports two comment styles:

```ecml
// Single-line comment

/*
   Multi-line comment
   spanning several lines
*/
```

## Identifiers

Identifiers must:
- Start with a letter or underscore
- Contain only letters, numbers, and underscores
- Be case-sensitive

```ecml
Actor MyActor "Title" "Description"    // Valid
Actor _internal "Title" "Description"  // Valid
Actor Actor123 "Title" "Description"   // Valid
```

## String Literals

Use double or single quotes for string values:

```ecml
#Title "Double quoted string"
#Author 'Single quoted string'

// Escape sequences supported
#Description "Line one\nLine two"
```
