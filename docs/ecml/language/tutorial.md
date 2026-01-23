---
title: "Tutorial"
description: "Build a complete content management model step by step"
layout: layouts/doc.njk
eleventyNavigation:
  key: Tutorial
  parent: Language
  order: 3
---

# Tutorial: Building a Document Management System

In this tutorial, you'll build a complete document management system model in ECML. By the end, you'll understand how to use all ECML constructs together.

## What We'll Build

A document review workflow with:
- Actors (users and roles)
- Security (labels and permissions)
- Content (document definitions)
- Activities and tasks
- Workflow orchestration

## Step 1: Set Up File Metadata

Start with pragmas to document your model:

```ecml
#Title "Document Review System"
#Description "Content model for document review workflow"
#Author "Your Name"
#Company "Your Company"
#Version "1.0"
#Created "2024-01-15"
```

## Step 2: Define Actors

Define the participants in your system:

```ecml
// Individual actors
Actor Author "Document Author" "Creates initial document drafts"
Actor Reviewer "Document Reviewer" "Reviews and provides feedback"
Actor Approver "Final Approver" "Gives final approval"
Actor Admin "System Administrator" "Manages system configuration"

// Actor with properties
Actor Manager "Department Manager" "Oversees department documents" {
    department: text
    level: integer
}
```

## Step 3: Define Security Labels

Set up retention and sensitivity labels:

```ecml
// Retention labels
RetentionLabel ShortTerm "Short Term" "Retain for 1 year" "Delete after 12 months"
RetentionLabel MediumTerm "Medium Term" "Retain for 5 years" "Archive after 60 months"
RetentionLabel LongTerm "Long Term" "Retain for 10 years" "Legal retention requirement"
RetentionLabel Permanent "Permanent" "Never delete" "Critical business records"

// Sensitivity labels
SensitivityLabel Public "Public" "No restrictions" "Can be shared externally"
SensitivityLabel Internal "Internal" "Internal use only" "Do not share outside organization"
SensitivityLabel Confidential "Confidential" "Restricted access" "Need-to-know basis"
SensitivityLabel Secret "Secret" "Highly restricted" "Executive access only"
```

## Step 4: Define Permissions

Create permission definitions:

```ecml
Permission Read "Read" "View document content"
Permission Write "Write" "Create and edit documents"
Permission Delete "Delete" "Remove documents"
Permission Approve "Approve" "Approve document changes"
Permission Admin "Administer" "Full system access"
```

## Step 5: Create Security Groups

Group actors with permissions:

```ecml
SecurityGroup [Author] Authors "Authors Group" "Document creators" = [Read, Write]
SecurityGroup [Reviewer] Reviewers "Reviewers Group" "Document reviewers" = [Read, Write]
SecurityGroup [Approver] Approvers "Approvers Group" "Final approvers" = [Read, Approve]
SecurityGroup [Admin] Admins "Administrators" "System admins" = [Read, Write, Delete, Admin]
```

## Step 6: Define Content Types

Create your document definitions:

```ecml
// Draft document
Content [type=Word, format=DOCX] Draft "Draft Document" 
    "Initial document draft created by author"
    [ShortTerm(Internal)] {
    version: integer
    status: choice(Draft, InReview, Approved, Rejected)
}

// Review comments
Content [type=Word] ReviewComments "Review Comments" 
    "Reviewer feedback and comments"
    [ShortTerm(Internal)]
    << Draft

// Final document
Content [type=Pdf, format=PDF] FinalDoc "Final Document"
    "Approved final version"
    [LongTerm(Confidential)]
    << Draft, ReviewComments
```

## Step 7: Create Activities

Define high-level activities:

```ecml
Activity [Author] CreateDocument "Create Document" 
    "Author creates initial document draft" {
    Task WriteDraft "Write Draft" "Create initial content"
    Task AddMetadata "Add Metadata" "Fill in document properties"
    Task SubmitForReview "Submit" "Submit for review"
}
>> Draft

Activity [Reviewer] ReviewDocument "Review Document"
    "Reviewer examines and provides feedback"
    << Draft {
    Task ReadDocument "Read Document" "Review document content"
    Task AddComments "Add Comments" "Provide feedback"
    Task MakeDecision "Decide" "Recommend approve or reject"
}
>> ReviewComments

Activity [Approver] ApproveDocument "Approve Document"
    "Final approval decision"
    << Draft, ReviewComments {
    Task FinalReview "Final Review" "Review document and comments"
    Task ApproveTask "Approve" "Grant final approval"
    Task RejectTask "Reject" "Reject with reasons"
}

Activity [Author] PublishDocument "Publish Document"
    "Convert and publish approved document"
    << Draft {
    Task ConvertToPdf "Convert to PDF" "Generate PDF version"
    Task Archive "Archive" "Store in document repository"
}
>> FinalDoc
```

## Step 8: Create the Workflow

Orchestrate activities into a workflow:

```ecml
Workflow DocumentReviewWorkflow "Document Review Workflow"
    "Complete document review and approval process" {
    
    // Start with document creation
    Do CreateDocument
    
    // Review cycle - repeat until approved
    Repeat ReviewDocument Until status = approved
    
    // Final approval
    Do ApproveDocument If status = approved
    
    // Publish if approved
    Do PublishDocument If this.status = complete
}
```

## Complete Model

Here's the complete ECML file:

```ecml
#Title "Document Review System"
#Description "Content model for document review workflow"
#Author "Tutorial Author"
#Version "1.0"

// =============================================================================
// ACTORS
// =============================================================================

Actor Author "Document Author" "Creates initial document drafts"
Actor Reviewer "Document Reviewer" "Reviews and provides feedback"
Actor Approver "Final Approver" "Gives final approval"
Actor Admin "System Administrator" "Manages system configuration"

// =============================================================================
// SECURITY LABELS
// =============================================================================

RetentionLabel ShortTerm "Short Term" "Retain for 1 year"
RetentionLabel LongTerm "Long Term" "Retain for 10 years"

SensitivityLabel Internal "Internal" "Internal use only"
SensitivityLabel Confidential "Confidential" "Restricted access"

// =============================================================================
// PERMISSIONS & GROUPS
// =============================================================================

Permission Read "Read" "View document content"
Permission Write "Write" "Create and edit documents"
Permission Approve "Approve" "Approve document changes"

SecurityGroup [Author] Authors "Authors" "Document creators" = [Read, Write]
SecurityGroup [Reviewer] Reviewers "Reviewers" "Reviewers" = [Read, Write]
SecurityGroup [Approver] Approvers "Approvers" "Approvers" = [Read, Approve]

// =============================================================================
// CONTENT
// =============================================================================

Content [type=Word] Draft "Draft Document" "Initial draft" [ShortTerm(Internal)]

Content ReviewComments "Review Comments" "Feedback" [ShortTerm(Internal)] << Draft

Content [type=Pdf] FinalDoc "Final Document" "Approved version" 
    [LongTerm(Confidential)] << Draft, ReviewComments

// =============================================================================
// ACTIVITIES
// =============================================================================

Activity [Author] CreateDocument "Create Document" "Create draft" {
    Task WriteDraft "Write Draft" "Create content"
    Task SubmitForReview "Submit" "Submit for review"
}
>> Draft

Activity [Reviewer] ReviewDocument "Review Document" "Review and feedback" << Draft {
    Task ReadDocument "Read" "Review content"
    Task AddComments "Comment" "Provide feedback"
}
>> ReviewComments

Activity [Approver] ApproveDocument "Approve Document" "Final approval" 
    << Draft, ReviewComments

Activity [Author] PublishDocument "Publish Document" "Publish approved doc" << Draft
>> FinalDoc

// =============================================================================
// WORKFLOW
// =============================================================================

Workflow DocumentReview "Document Review Workflow" "Review and approval process" {
    Do CreateDocument
    Repeat ReviewDocument Until status = approved
    Do ApproveDocument If status = approved
    Do PublishDocument If this.status = complete
}
```

## Key Takeaways

1. **Start with pragmas** - Document your model with metadata
2. **Define actors first** - Establish who participates
3. **Set up security** - Labels and permissions before content
4. **Create content** - Define documents with attributes and labels
5. **Build activities** - Group related tasks
6. **Connect with flow** - Use `<<` and `>>` for content relationships
7. **Orchestrate with workflows** - Define the process

## Next Steps

- Explore the [Examples](/examples/) for more patterns
- Read the [Complete Reference](/language/reference/) for all syntax details
- Use the [Quick Reference](/language/quick-reference/) as a handy cheatsheet
