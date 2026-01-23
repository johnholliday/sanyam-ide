---
layout: layouts/doc.njk
title: "Complete Workflow"
description: A full contract approval system demonstrating all ECML features
eleventyNavigation:
  key: Complete Workflow
  parent: Examples
  order: 6
---

# Complete Workflow

This advanced example demonstrates all major ECML features working together in a contract approval system.

## Overview

This model includes:
- Multiple actors with properties
- Security configuration with groups and permissions
- Content items with attributes and labels
- Activities with nested tasks
- A workflow with conditional logic

## Example

```ecml
// Advanced Example: Complete Document Approval Workflow
// Demonstrates all major ECML features working together

#Title "Contract Approval System"
#Description "End-to-end contract review and approval workflow"
#Author "Enterprise Architecture Team"
#Company "Acme Corporation"
#Version "2.1"
#Created "2024-01-15"

// =============================================================================
// ACTORS - Define all participants in the workflow
// =============================================================================

Actor Requester "Contract Requester" "Initiates contract requests" {
    department: text "Employee department"
    level: choice(Junior, Senior, Manager)
}

Actor LegalReviewer "Legal Reviewer" "Reviews legal terms and conditions"
Actor FinanceApprover "Finance Approver" "Approves financial terms"
Actor ExecutiveSigner "Executive Signer" "Final signature authority"
Actor CanReview "Can Review Role" "Role that can review contracts"

// =============================================================================
// COMPLIANCE - Security and retention configuration
// =============================================================================

Permission SubmitPerm "Can Submit" "Submit new contracts for review"
Permission ReviewPerm "Can Review" "Review and comment on contracts"
Permission ApprovePerm "Can Approve" "Approve or reject contracts"
Permission SignPerm "Can Sign" "Final signature authority"

RetentionLabel TenYear "10 Year Retention" "Retain for 10 years per legal requirements"
SensitivityLabel BusinessCritical "Business Critical" "Highly sensitive business information"

SecurityGroup [LegalReviewer, FinanceApprover] ReviewTeam "Review Team" "Contract review group" = [CanReview]

// =============================================================================
// CONTENT - Documents flowing through the workflow
// =============================================================================

Content [format=DOCX, type=Word] DraftContract "Draft Contract" "Initial contract draft" [TenYear(BusinessCritical)] {
    contractValue: currency "Total contract value"
    effectiveDate: date "Contract start date"
    termMonths: integer "Contract duration in months"
}

Content [format=PDF] SignedContract "Signed Contract" "Fully executed contract" [TenYear(BusinessCritical)] << DraftContract

Content [format=XLSX, type=Excel] FinancialSummary "Financial Summary" "Cost breakdown analysis" << DraftContract >> SignedContract

// =============================================================================
// ACTIVITIES - Major workflow stages
// =============================================================================

Activity [Requester] SubmitContract "Submit Contract" "Initial contract submission" {
    Task PrepareDocuments "Prepare Documents" "Gather all required documents"
    Task FillForm "Fill Request Form" "Complete contract request form" {
        requestDate: date "Submission date"
        urgency: choice(Normal, Urgent, Critical)
    }
}

Activity [LegalReviewer] LegalReview "Legal Review" "Review legal terms" {
    Task CheckTerms "Check Terms" "Verify all terms are acceptable"
    Task IdentifyRisks "Identify Risks" "Document potential legal risks"
    reviewStatus: choice(Pending, InProgress, Complete)
}

Activity [FinanceApprover] FinanceReview "Finance Review" "Review financial impact" {
    Task ValidateBudget "Validate Budget" "Confirm budget availability"
    Task CalculateROI "Calculate ROI" "Assess return on investment"
}

Activity [ExecutiveSigner] FinalApproval "Final Approval" "Executive sign-off" >> SignedContract

// =============================================================================
// WORKFLOW - Orchestrate the activities
// =============================================================================

Workflow ContractApproval "Contract Approval" "Main approval workflow" {
    <#
    This workflow handles the complete contract approval process.
    It includes conditional logic for high-value contracts.
    #>

    Do SubmitContract
    Do LegalReview
    Do FinanceReview If LegalReview.reviewStatus = "approved"
    Repeat [LegalReview, FinanceReview] Until status = approved
    Do FinalApproval If this.status = approved
}
```

## Breakdown by Section

### Pragmas

The file begins with metadata that documents the model:

```ecml
#Title "Contract Approval System"
#Description "End-to-end contract review and approval workflow"
#Author "Enterprise Architecture Team"
#Company "Acme Corporation"
#Version "2.1"
#Created "2024-01-15"
```

### Actors

Four main roles participate in the workflow:

| Actor | Role |
|-------|------|
| `Requester` | Initiates contract requests, has department and level properties |
| `LegalReviewer` | Reviews legal terms and conditions |
| `FinanceApprover` | Approves financial terms |
| `ExecutiveSigner` | Provides final signature authority |

### Security Configuration

Permissions define what actions can be performed:

```ecml
Permission SubmitPerm "Can Submit" "Submit new contracts for review"
Permission ReviewPerm "Can Review" "Review and comment on contracts"
Permission ApprovePerm "Can Approve" "Approve or reject contracts"
Permission SignPerm "Can Sign" "Final signature authority"
```

A security group is created for the review team:

```ecml
SecurityGroup [LegalReviewer, FinanceApprover] ReviewTeam "Review Team" "Contract review group" = [CanReview]
```

### Content Items

Three content items represent documents in the workflow:

| Content | Description | Labels | Flow |
|---------|-------------|--------|------|
| `DraftContract` | Initial contract draft | 10 year retention, business critical | - |
| `SignedContract` | Fully executed contract | 10 year retention, business critical | Input from Draft |
| `FinancialSummary` | Cost breakdown | - | Draft to Signed |

### Activities

Four activities represent the workflow stages:

1. **SubmitContract** - Initial submission with document preparation tasks
2. **LegalReview** - Legal team reviews terms and identifies risks
3. **FinanceReview** - Finance validates budget and calculates ROI
4. **FinalApproval** - Executive provides final sign-off

### Workflow

The workflow orchestrates the activities with:

- Sequential execution of activities
- Conditional execution based on review status
- Repeat loop until approval

```ecml
Workflow ContractApproval "Contract Approval" "Main approval workflow" {
    Do SubmitContract
    Do LegalReview
    Do FinanceReview If LegalReview.reviewStatus = "approved"
    Repeat [LegalReview, FinanceReview] Until status = approved
    Do FinalApproval If this.status = approved
}
```

## Data Flow Diagram

```
Requester --> DraftContract
                  |
                  v
            LegalReview
                  |
                  v
            FinanceReview --> FinancialSummary
                  |
                  v
            FinalApproval --> SignedContract
```

## Key Patterns Demonstrated

### Actor Properties

```ecml
Actor Requester "Contract Requester" "Initiates requests" {
    department: text "Employee department"
    level: choice(Junior, Senior, Manager)
}
```

### Content Attributes and Labels

```ecml
Content [format=DOCX, type=Word] DraftContract "Draft" "Draft" [TenYear(BusinessCritical)] {
    contractValue: currency "Total value"
}
```

### Nested Tasks with Properties

```ecml
Activity [Requester] SubmitContract "Submit" "Submission" {
    Task FillForm "Fill Form" "Complete form" {
        requestDate: date "Date"
        urgency: choice(Normal, Urgent, Critical)
    }
}
```

### Conditional Workflow Steps

```ecml
Do FinanceReview If LegalReview.reviewStatus = "approved"
Do FinalApproval If this.status = approved
```

### Repeat Until

```ecml
Repeat [LegalReview, FinanceReview] Until status = approved
```

## Best Practices from This Example

1. **Organize with comments** - Use section headers for clarity
2. **Define all actors first** - Establish participants before referencing them
3. **Set up security early** - Permissions and labels before content
4. **Use properties** - Capture important data at each step
5. **Show data flow** - Connect content items with `<<` and `>>`
6. **Document workflows** - Use annotations to explain logic
