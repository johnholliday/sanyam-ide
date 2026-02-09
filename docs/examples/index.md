---
title: "Examples"
description: "Real-world E C M L examples from basic to advanced"
layout: layouts/doc.njk
eleventyNavigation:
  key: Examples
  order: 5
---

# Examples

Learn E C M L through practical examples, organized from basic to advanced.

## Basic Examples

Start here if you're new to E C M L.

### Simple Actor

```ecml
Actor Editor "Content Editor" "Creates and manages content"
```

### Simple Content

```ecml
Content Document "Business Document" "Standard business document"
```

### Content with Type

```ecml
Content [type=Excel, format=XLSX] Report "Monthly Report" "Financial report"
```

---

## Intermediate Examples

Build on the basics with properties and relationships.

### Actor with Properties

```ecml
Actor Manager "Department Manager" "Manages team content" {
    department: text
    employeeId: text
    accessLevel: choice(Basic, Standard, Premium)
}
```

### Content with Labels and Flow

```ecml
RetentionLabel Archive "Archive" "Long-term retention"
SensitivityLabel Internal "Internal" "Internal only"

Content SourceData "Source Data" "Input data" [Archive(Internal)]

Content ProcessedData "Processed Data" "Output data"
    [Archive(Internal)] << SourceData
```

### Activity with Tasks

```ecml
Actor Analyst "Data Analyst" "Analyzes data"

Activity [Analyst] AnalyzeData "Analyze Data" "Perform data analysis" {
    Task CollectData "Collect" "Gather source data"
    Task ProcessData "Process" "Transform data"
    Task ReportResults "Report" "Generate report"
}
```

---

## Advanced Examples

### Complete Security Model

```ecml
// Actors
Actor User "Standard User" "Regular system user"
Actor Manager "Manager" "Department manager"
Actor Admin "Administrator" "System administrator"

// Permissions
Permission Read "Read" "View content"
Permission Write "Write" "Create/edit content"
Permission Delete "Delete" "Remove content"
Permission Admin "Administer" "Full access"

// Security groups
SecurityGroup [User] Users "Users" "Standard users" = [Read]
SecurityGroup [User, Manager] Contributors "Contributors" "Can contribute" = [Read, Write]
SecurityGroup [Manager] Managers "Managers" "Management" = [Read, Write, Delete]
SecurityGroup [Admin] Admins "Administrators" "Full access" = [Read, Write, Delete, Admin]

// Labels
RetentionLabel Standard "Standard" "5 year retention"
SensitivityLabel Confidential "Confidential" "Restricted"

// Content with full security
Content [type=Word] Contract "Contract Document" "Legal contract"
    [Standard(Confidential)] {
    contractNumber: text
    effectiveDate: date
    expirationDate: date
    value: currency
}
```

### Workflow with Conditions

```ecml
Actor Author "Author" "Document author"
Actor Reviewer "Reviewer" "Document reviewer"
Actor Approver "Approver" "Final approver"

Content Draft "Draft" "Draft document"
Content Final "Final" "Final document"

Activity [Author] Create "Create Document" "Create initial draft" >> Draft

Activity [Reviewer] Review "Review Document" "Review and comment" << Draft {
    Task ReadDoc "Read" "Review content"
    Task Comment "Comment" "Add feedback"
    status: choice(pending, approved, rejected)
}

Activity [Approver] Approve "Approve Document" "Final approval" << Draft {
    Task FinalCheck "Check" "Final review"
    Task Sign "Sign" "Digital signature"
}

Activity [Author] Publish "Publish Document" "Publish final" << Draft >> Final

Workflow DocumentWorkflow "Document Workflow" "Complete review cycle" {
    Do Create
    Repeat Review Until status = approved
    Do Approve If Review.status = approved
    Do Publish If this.status = complete
}
```

---

## Common Patterns

### Hierarchical Actors

```ecml
Actor Employee "Employee" "Base employee type" {
    employeeId: text
    department: text
}

Actor Manager "Manager" "Department manager" {
    employeeId: text
    department: text
    directReports: integer
}

Actor Executive "Executive" "Company executive" {
    employeeId: text
    title: text
}
```

### Content Pipeline

```ecml
Content RawData "Raw Data" "Unprocessed input"
Content CleanedData "Cleaned Data" "Processed data" << RawData
Content Analysis "Analysis" "Analysis results" << CleanedData
Content Report "Report" "Final report" << Analysis
```

### Multi-Stage Approval

```ecml
Activity [Author] Draft "Draft" "Create draft"
Activity [TeamLead] TeamReview "Team Review" "Team lead review"
Activity [Manager] ManagerReview "Manager Review" "Manager approval"
Activity [Legal] LegalReview "Legal Review" "Legal approval"
Activity [Executive] FinalApproval "Final Approval" "Executive sign-off"

Workflow ApprovalChain "Approval Chain" "Multi-stage approval" {
    Do Draft
    Do TeamReview
    Do ManagerReview
    Do LegalReview If this.value > 10000
    Do FinalApproval If this.value > 50000
}
```

---

## Creating New Files

Start with the template structure:

```ecml
#Title "Your Model Title"
#Description "What this model represents"
#Author "Your Name"
#Version "1.0"

// Actors

// Security

// Content

// Activities

// Workflows
```
