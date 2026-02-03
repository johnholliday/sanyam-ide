---
layout: layouts/doc.njk
title: "Basic Actor"
description: Define a simple actor in ECML
eleventyNavigation:
  key: Basic Actor
  parent: Examples
  order: 1
---

# Basic Actor

This example shows how to define a simple actor in ECML.

## Overview

An **Actor** represents a user role, participant, or system in your enterprise model. Actors can participate in activities, be assigned to security groups, and have custom properties.

## Example

```ecml
// Basic Example: Defining an Actor
// An Actor represents a user role or participant in the enterprise

Actor Admin "Administrator" "System administrator with full access"
```

## Breakdown

| Part | Description |
|------|-------------|
| `Actor` | Keyword to define an actor |
| `Admin` | The identifier (used for references) |
| `"Administrator"` | The display title |
| `"System administrator..."` | The description |

## Variations

### Actor with Notes

```ecml
Actor Manager "Department Manager" "Manages a department" "Contact HR for role assignment"
```

### Actor with Properties

```ecml
Actor Employee "Employee" "Company employee" {
    department: text "Employee's department"
    startDate: date "Employment start date"
    level: choice(Junior, Mid, Senior, Lead)
}
```

### Nested Actors

```ecml
Actor Team "Project Team" "A project team" {
    Actor Lead "Team Lead" "Leads the team"
    Actor Developer "Developer" "Team developer"
    Actor Tester "QA Tester" "Quality assurance"
}
```

## Usage

Actors are referenced in:

- **Activities**: `Activity [Admin] ManageUsers "Manage Users" "User administration"`
- **Security Groups**: `SecurityGroup [Admin, Manager] Admins "Admin Group" "Administrators"`
- **Role Assignments**: `Task [Admin] Configure "Configure" "System configuration"`

## Best Practices

1. Use clear, descriptive identifiers
2. Keep titles concise but meaningful
3. Add descriptions that explain the role's responsibilities
4. Use properties for actor-specific metadata
