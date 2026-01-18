---
layout: layouts/doc.njk
title: Getting Started
description: Installation and first steps with ECML
eleventyNavigation:
  key: Getting Started
  order: 1
---

# Getting Started with ECML

This guide will help you get started with the Enterprise Content Modeling Language.

## Installation

ECML is supported in the Sanyam IDE. To get started:

1. Install the Sanyam IDE or VS Code extension
2. Create a new file with the `.ecml` extension
3. Start writing your content model

## File Structure

Every ECML file begins with optional pragmas (metadata) followed by statements:

```ecml
#Title "My Content Model"
#Description "A description of what this model represents"
#Author "Your Name"
#Version "1.0"

// Your statements go here
Actor MyActor "Actor Title" "Description"
```

## Pragmas

Pragmas provide metadata about your model. They start with `#` and are followed by a value in quotes:

| Pragma | Purpose |
|--------|---------|
| `#Title` | The title of your content model |
| `#Description` | A detailed description |
| `#Author` | The author name |
| `#Company` | The company or organization |
| `#Version` | Version number |
| `#Created` | Creation date |
| `#Updated` | Last update date |
| `#Copyright` | Copyright notice |
| `#License` | License information |

## Basic Concepts

### Actors

Actors represent people, roles, or systems that participate in your enterprise:

```ecml
Actor Admin "Administrator" "System administrator with full access"

Actor Reviewer "Document Reviewer" "Reviews submitted documents" {
    department: text "The reviewer's department"
    level: choice(Junior, Senior, Lead)
}
```

### Content

Content represents documents, files, or data artifacts:

```ecml
Content Report "Monthly Report" "Financial summary"

Content [format=DOCX, type=Word] Contract "Contract Document" "Legal contract" {
    contractValue: currency "Total contract value"
    effectiveDate: date "Start date"
}
```

### Activities and Tasks

Activities represent business processes. They can contain nested tasks:

```ecml
Activity [Reviewer] ReviewProcess "Review Process" "Document review cycle" {
    Task CheckFormat "Check Formatting" "Verify formatting"
    Task ValidateContent "Validate Content" "Review accuracy"
    dueDate: date "Review deadline"
}
```

## Content Flow

Use `<<` for input and `>>` for output to define data flow:

```ecml
Content Draft "Draft" "Initial draft"
Content Final "Final" "Approved version"

// Activity outputs to Final, takes input from Draft
Activity Review "Review" "Review process" << Draft >> Final
```

## Next Steps

- Read the [Language Reference](/language/reference/) for complete syntax documentation
- Explore [Examples](/examples/) to see real-world usage patterns
- Check out the [Quick Reference](/language/quick-reference/) for a syntax cheatsheet
