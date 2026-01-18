---
layout: layouts/doc.njk
title: Tutorial
description: Step-by-step ECML learning guide
eleventyNavigation:
  key: Tutorial
  parent: Language
  order: 3
---

# ECML Tutorial

This tutorial walks you through building a complete content model step by step.

## Scenario

We'll model a document approval system for a company. The system needs to:

1. Define who can participate (Actors)
2. Describe the documents involved (Content)
3. Define the approval process (Activities & Tasks)
4. Set up security controls (Permissions & Labels)
5. Orchestrate the workflow (Workflow)

## Step 1: Set Up the File

Create a new file called `approval-system.ecml` and add metadata:

```ecml
#Title "Document Approval System"
#Description "A complete document review and approval workflow"
#Author "Your Name"
#Version "1.0"
#Created "2024-01-15"
```

## Step 2: Define Actors

Identify who participates in your process:

```ecml
// The person who submits documents
Actor Submitter "Document Submitter" "Submits documents for approval"

// The person who reviews documents
Actor Reviewer "Document Reviewer" "Reviews submitted documents" {
    department: text "Reviewer's department"
    expertise: choice(Technical, Legal, Financial)
}

// The person who gives final approval
Actor Approver "Final Approver" "Has authority to approve documents"
```

## Step 3: Define Content

Describe the documents in your system:

```ecml
// The initial document submitted for review
Content Draft "Draft Document" "Initial document submission" {
    author: text "Document author"
    createdDate: date "Creation date"
    category: choice(Policy, Procedure, Report, Contract)
}

// Comments and feedback from reviewers
Content ReviewComments "Review Comments" "Feedback from reviewers" << Draft

// The final approved document
Content ApprovedDocument "Approved Document" "Final approved version" << Draft
```

Notice how `ReviewComments` takes `Draft` as input (`<< Draft`), showing the data flow.

## Step 4: Add Security and Compliance

Set up permissions and labels:

```ecml
// Define permissions
Permission CanSubmit "Can Submit" "Permission to submit documents"
Permission CanReview "Can Review" "Permission to review documents"
Permission CanApprove "Can Approve" "Permission to approve documents"

// Define compliance labels
RetentionLabel FiveYear "5 Year Retention" "Retain for 5 years"
SensitivityLabel Internal "Internal Only" "For internal use only"

// Create a security group for the review team
Actor ReviewPermission "Review Permission" "Has review access"
SecurityGroup [Reviewer, Approver] ReviewTeam "Review Team" "Document review team" = [ReviewPermission]
```

Now apply labels to content:

```ecml
// Update ApprovedDocument with labels
Content [format=PDF] ApprovedDocument "Approved Document"
    "Final approved version"
    [FiveYear(Internal)]
    << Draft
```

## Step 5: Define Activities

Create the business process:

```ecml
// Submission activity
Activity [Submitter] SubmitDocument "Submit Document" "Submit a document for review" {
    Task PrepareDocument "Prepare Document" "Gather and format the document"
    Task FillMetadata "Fill Metadata" "Complete required metadata fields"
    submissionDate: date "Date of submission"
}

// Review activity
Activity [Reviewer] ReviewDocument "Review Document" "Review the submitted document" {
    Task CheckCompliance "Check Compliance" "Verify compliance requirements"
    Task AssessQuality "Assess Quality" "Evaluate document quality"
    Task AddComments "Add Comments" "Provide feedback and comments"

    reviewStatus: choice(Pending, InProgress, Complete)
    recommendation: choice(Approve, Reject, Revise)
}

// Approval activity
Activity [Approver] ApproveDocument "Approve Document" "Final approval decision"
    >> ApprovedDocument {
    Task FinalReview "Final Review" "Perform final review"
    Task MakeDecision "Make Decision" "Approve or reject"

    decision: choice(Approved, Rejected)
    decisionDate: date "Date of decision"
}
```

## Step 6: Create the Workflow

Orchestrate everything together:

```ecml
Workflow DocumentApproval "Document Approval" "Main approval workflow" {
    <#
    This workflow handles the complete document approval process.
    Documents are submitted, reviewed, and then approved or rejected.
    If rejected, they go back for revision.
    #>

    // Start with submission
    Do SubmitDocument

    // Then review
    Do ReviewDocument

    // Approval only if review recommends it
    Do ApproveDocument If ReviewDocument.recommendation = "Approve"

    // Repeat review cycle if revision needed
    Repeat [SubmitDocument, ReviewDocument] Until ReviewDocument.recommendation = "Approve"
}
```

## Complete Example

Here's the complete model:

```ecml
#Title "Document Approval System"
#Description "A complete document review and approval workflow"
#Author "Your Name"
#Version "1.0"
#Created "2024-01-15"

// =============================================================================
// ACTORS
// =============================================================================

Actor Submitter "Document Submitter" "Submits documents for approval"

Actor Reviewer "Document Reviewer" "Reviews submitted documents" {
    department: text "Reviewer's department"
    expertise: choice(Technical, Legal, Financial)
}

Actor Approver "Final Approver" "Has authority to approve documents"

// =============================================================================
// SECURITY
// =============================================================================

Permission CanSubmit "Can Submit" "Permission to submit documents"
Permission CanReview "Can Review" "Permission to review documents"
Permission CanApprove "Can Approve" "Permission to approve documents"

RetentionLabel FiveYear "5 Year Retention" "Retain for 5 years"
SensitivityLabel Internal "Internal Only" "For internal use only"

Actor ReviewPermission "Review Permission" "Has review access"
SecurityGroup [Reviewer, Approver] ReviewTeam "Review Team" "Review team" = [ReviewPermission]

// =============================================================================
// CONTENT
// =============================================================================

Content Draft "Draft Document" "Initial submission" {
    author: text "Document author"
    createdDate: date "Creation date"
    category: choice(Policy, Procedure, Report, Contract)
}

Content ReviewComments "Review Comments" "Reviewer feedback" << Draft

Content [format=PDF] ApprovedDocument "Approved Document"
    "Final approved version"
    [FiveYear(Internal)]
    << Draft

// =============================================================================
// ACTIVITIES
// =============================================================================

Activity [Submitter] SubmitDocument "Submit Document" "Submit for review" {
    Task PrepareDocument "Prepare Document" "Gather and format"
    Task FillMetadata "Fill Metadata" "Complete metadata"
    submissionDate: date "Submission date"
}

Activity [Reviewer] ReviewDocument "Review Document" "Review submission" {
    Task CheckCompliance "Check Compliance" "Verify compliance"
    Task AssessQuality "Assess Quality" "Evaluate quality"
    Task AddComments "Add Comments" "Provide feedback"

    reviewStatus: choice(Pending, InProgress, Complete)
    recommendation: choice(Approve, Reject, Revise)
}

Activity [Approver] ApproveDocument "Approve Document" "Final approval" >> ApprovedDocument {
    Task FinalReview "Final Review" "Final review"
    Task MakeDecision "Make Decision" "Approve or reject"

    decision: choice(Approved, Rejected)
    decisionDate: date "Decision date"
}

// =============================================================================
// WORKFLOW
// =============================================================================

Workflow DocumentApproval "Document Approval" "Main workflow" {
    Do SubmitDocument
    Do ReviewDocument
    Do ApproveDocument If ReviewDocument.recommendation = "Approve"
    Repeat [SubmitDocument, ReviewDocument] Until ReviewDocument.recommendation = "Approve"
}
```

## Next Steps

- Explore more [Examples](/examples/) for different use cases
- Read the [Language Reference](/language/reference/) for complete syntax details
- Check the [Quick Reference](/language/quick-reference/) for a syntax cheatsheet
