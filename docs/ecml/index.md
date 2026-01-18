---
title: "ECML"
description: "Enterprise Content Modeling Language"
layout: layouts/home.njk
eleventyNavigation:
  key: Home
  order: 1
---

# Enterprise Content Modeling Language

ECML is a domain-specific language for modeling enterprise content management systems, workflows, and information security structures.

## Key Features

- **Content Modeling** - Define content types with properties, templates, and formats
- **Workflow Support** - Model activities, tasks, and workflow sequences
- **Security & Compliance** - Define security groups, permissions, retention, and sensitivity labels
- **Actor Definitions** - Model users, roles, and organizational structures
- **Data Flow** - Specify content input/output relationships

## Quick Example

```ecml
#Title "Document Review Process"
#Version "1.0"

Actor Reviewer "Document Reviewer" "Responsible for reviewing documents"

Content [type=Word] ReviewDoc "Review Document" "Document under review"

Activity [Reviewer] ReviewDocument "Review Document" "Review and approve document" {
    Task ApproveTask "Approve" "Mark document as approved"
    Task RejectTask "Reject" "Mark document as rejected"
}
```

## Getting Started

- [Getting Started Guide](/getting-started/) - Set up your first ECML file
- [Language Reference](/language/reference/) - Complete syntax documentation
- [Examples](/examples/) - Real-world ECML patterns

## Core Concepts

| Concept | Description |
|---------|-------------|
| **Pragmas** | File metadata like `#Title`, `#Version`, `#Author` |
| **Actors** | Users, roles, and groups that interact with content |
| **Content** | Documents, files, and data with properties |
| **Activities** | High-level work items containing tasks |
| **Tasks** | Specific actions within activities |
| **Workflows** | Orchestrated sequences of activities |
| **Labels** | Retention and sensitivity classifications |
