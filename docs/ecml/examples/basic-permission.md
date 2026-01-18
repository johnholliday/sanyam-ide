---
layout: layouts/doc.njk
title: "Basic Permission"
description: Define a simple permission in ECML
eleventyNavigation:
  key: Basic Permission
  parent: Examples
  order: 3
---

# Basic Permission

This example shows how to define a simple permission in ECML.

## Overview

**Permissions** define access rights that can be assigned to security groups. They control what actions actors can perform on content and activities.

## Example

```ecml
// Basic Example: Defining a Permission
// Permissions control access to resources

Permission ReadOnly "Read Only" "View content without modification"
```

## Breakdown

| Part | Description |
|------|-------------|
| `Permission` | Keyword to define a permission |
| `ReadOnly` | The identifier (used for references) |
| `"Read Only"` | The display title |
| `"View content..."` | The description |

## Variations

### Permission with Notes

```ecml
Permission FullAccess "Full Access" "Complete read, write, and delete access" "Use sparingly"
```

### Common Permission Patterns

```ecml
// Read-only access
Permission Read "Read" "View content"

// Write access
Permission Write "Write" "Create and modify content"

// Delete access
Permission Delete "Delete" "Remove content"

// Administrative access
Permission Admin "Administrator" "Full system access including configuration"

// Approval rights
Permission Approve "Approve" "Authority to approve items"

// Submit rights
Permission Submit "Submit" "Submit items for review"
```

## Usage with Security Groups

Permissions are assigned to security groups along with actors:

```ecml
// Define actors
Actor Manager "Manager" "Department manager"
Actor Employee "Employee" "Staff member"
Actor AdminRole "Admin Role" "Administrative role"

// Define permissions
Permission ReadWrite "Read Write" "Full read/write access"
Permission ViewOnly "View Only" "Read-only access"

// Assign to security groups
SecurityGroup [Manager] Managers "Managers Group" "Department managers" = [AdminRole]
SecurityGroup [Employee] Staff "Staff Group" "General staff" = [AdminRole]
```

## Best Practices

1. Define granular permissions for flexibility
2. Use clear, action-oriented names
3. Document what each permission allows
4. Group related permissions logically
5. Follow the principle of least privilege
