---
layout: layouts/home.njk
title: ECML Documentation
---

# Enterprise Content Modeling Language

**ECML** is a domain-specific language for modeling enterprise content, workflows, security, and compliance requirements. It provides a declarative way to define actors, activities, content artifacts, and their relationships.

## Key Features

- **Actors** - Define roles and participants in your enterprise
- **Activities & Tasks** - Model business processes with nested task hierarchies
- **Content** - Describe documents, files, and data artifacts with attributes
- **Security** - Configure groups, permissions, and access controls
- **Compliance** - Apply retention and sensitivity labels
- **Workflows** - Orchestrate activities with conditional logic

## Quick Start

Create a new `.ecml` file and start defining your model:

```ecml
#Title "My First Content Model"
#Version "1.0"

// Define an actor
Actor Admin "Administrator" "System administrator with full access"

// Define content
Content Report "Monthly Report" "Financial summary for the month"

// Define an activity
Activity [Admin] GenerateReport "Generate Report" "Create monthly report" >> Report
```

## Documentation Sections

- **[Getting Started](/getting-started/)** - Installation and first steps
- **[Language Reference](/language/reference/)** - Complete syntax documentation
- **[Examples](/examples/)** - Real-world usage patterns
