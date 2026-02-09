---
layout: layouts/doc.njk
title: "Security Model"
description: Configure security groups, permissions, and compliance labels
eleventyNavigation:
  key: Security Model
  parent: Examples
  order: 5
---

# Security Model

This example demonstrates how to configure security groups, permissions, and compliance labels.

## Overview

ECML provides comprehensive security and compliance modeling through:

- **Permissions** - Define access rights
- **Security Groups** - Group actors with assigned permissions
- **Retention Labels** - Define data retention policies
- **Sensitivity Labels** - Classify data sensitivity

## Example

```ecml
// Intermediate Example: Security and Compliance Model
// Demonstrates security groups, permissions, and labels

#Title "Enterprise Security Configuration"
#Author "Security Team"

// Define actors for security groups
Actor Manager "Manager" "Department manager"
Actor Analyst "Analyst" "Data analyst"
Actor FullAccess "Full Access Role" "Role with complete access"

// Define permissions
Permission ReadWrite "Read Write" "Complete read and write access"
Permission ViewOnly "View Only" "Read-only access to content"

// Define compliance labels
RetentionLabel SevenYear "7 Year Retention" "Retain for 7 years per regulations"
SensitivityLabel Confidential "Confidential" "Internal use only"

// Security group with members and permissions (references Actors)
SecurityGroup [Manager, Analyst] DataTeam "Data Team" "Data analytics group" = [FullAccess]
```

## Security Group Structure

```ecml
SecurityGroup [members] Name "Title" "Description" = [permissions]
```

| Part | Description |
|------|-------------|
| `SecurityGroup` | Keyword |
| `[Manager, Analyst]` | Member actors |
| `DataTeam` | Identifier |
| `"Data Team"` | Display title |
| `"Data analytics group"` | Description |
| `= [FullAccess]` | Permission assignment (references an Actor) |

## Permissions

### Defining Permissions

```ecml
Permission ReadOnly "Read Only" "View content without modification"
Permission ReadWrite "Read Write" "View and modify content"
Permission Admin "Administrator" "Full administrative access"
Permission Submit "Submit" "Submit items for approval"
Permission Approve "Approve" "Approve or reject items"
```

### Permission Hierarchy Example

```ecml
Permission View "View" "Basic viewing rights"
Permission Edit "Edit" "Modify existing content"
Permission Create "Create" "Create new content"
Permission Delete "Delete" "Remove content"
Permission Manage "Manage" "Full content management"
```

## Retention Labels

Retention labels define how long content must be kept:

```ecml
RetentionLabel OneYear "1 Year" "Retain for 1 year"
RetentionLabel ThreeYear "3 Years" "Retain for 3 years"
RetentionLabel SevenYear "7 Years" "Retain for 7 years (tax records)"
RetentionLabel TenYear "10 Years" "Retain for 10 years (legal)"
RetentionLabel Permanent "Permanent" "Retain indefinitely"
```

## Sensitivity Labels

Sensitivity labels classify data confidentiality:

```ecml
SensitivityLabel Public "Public" "Can be shared publicly"
SensitivityLabel Internal "Internal" "Internal use only"
SensitivityLabel Confidential "Confidential" "Restricted distribution"
SensitivityLabel Secret "Secret" "Highly restricted"
SensitivityLabel TopSecret "Top Secret" "Maximum classification"
```

## Applying Labels to Content

### Retention Only

```ecml
Content TaxRecords "Tax Records" "Annual tax filings" [SevenYear]
```

### Sensitivity Only

```ecml
Content InternalMemo "Internal Memo" "Staff communication" [(Internal)]
```

### Both Labels

```ecml
Content Contract "Contract" "Legal agreement" [TenYear(Confidential)]
Content FinancialReport "Financial Report" "Quarterly results" [SevenYear(Secret)]
```

## Complete Security Model

```ecml
#Title "Complete Security Configuration"

// =============================================================================
// ACTORS
// =============================================================================

Actor Executive "Executive" "C-level executive"
Actor Manager "Manager" "Department manager"
Actor Employee "Employee" "Staff member"
Actor Contractor "Contractor" "External contractor"
Actor System "System" "Automated system"

// =============================================================================
// PERMISSIONS
// =============================================================================

Permission View "View" "View content"
Permission Edit "Edit" "Edit content"
Permission Submit "Submit" "Submit for approval"
Permission Approve "Approve" "Approve items"
Permission Admin "Admin" "Administrative access"

// =============================================================================
// RETENTION LABELS
// =============================================================================

RetentionLabel ShortTerm "Short Term" "Retain for 1 year"
RetentionLabel MediumTerm "Medium Term" "Retain for 5 years"
RetentionLabel LongTerm "Long Term" "Retain for 10 years"
RetentionLabel Permanent "Permanent" "Retain indefinitely"

// =============================================================================
// SENSITIVITY LABELS
// =============================================================================

SensitivityLabel Public "Public" "No restrictions"
SensitivityLabel Internal "Internal" "Employees only"
SensitivityLabel Confidential "Confidential" "Need-to-know"
SensitivityLabel Restricted "Restricted" "Executive only"

// =============================================================================
// SECURITY GROUPS
// =============================================================================

Actor AdminRole "Admin Role" "Administrative role"
Actor ManagerRole "Manager Role" "Management role"
Actor ViewerRole "Viewer Role" "View-only role"

SecurityGroup [Executive] Leadership "Leadership" "Executive team" = [AdminRole]
SecurityGroup [Manager] Management "Management" "Department managers" = [ManagerRole]
SecurityGroup [Employee] Staff "Staff" "General employees" = [ViewerRole]
SecurityGroup [Contractor] External "External" "External parties" = [ViewerRole]

// =============================================================================
// LABELED CONTENT
// =============================================================================

Content PublicAnnouncement "Public Announcement" "Press release" [(Public)]
Content StaffMemo "Staff Memo" "Internal communication" [ShortTerm(Internal)]
Content FinancialData "Financial Data" "Quarterly results" [LongTerm(Confidential)]
Content StrategicPlan "Strategic Plan" "Business strategy" [Permanent(Restricted)]
```

## Best Practices

1. Define permissions at an appropriate granularity
2. Use meaningful retention periods based on regulations
3. Apply sensitivity labels consistently
4. Document the purpose of each security group
5. Review and audit security configurations regularly
6. Follow the principle of least privilege
