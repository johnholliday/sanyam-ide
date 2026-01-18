---
layout: layouts/doc.njk
title: "Activity with Tasks"
description: Model a business process with nested tasks
eleventyNavigation:
  key: Activity with Tasks
  parent: Examples
  order: 4
---

# Activity with Tasks

This example demonstrates how to model a business process with nested tasks and properties.

## Overview

**Activities** represent business processes, and **Tasks** represent the individual steps within those processes. Activities can contain nested tasks, properties, and content flow definitions.

## Example

```ecml
// Intermediate Example: Activity with nested Tasks
// Shows actors, activities, tasks with properties and content flow

#Title "Document Review Process"
#Version "1.0"

// Define actors
Actor Reviewer "Document Reviewer" "Reviews submitted documents"
Actor Author "Document Author" "Creates and submits documents"

// Define content items
Content Draft "Draft Document" "Initial document submission"
Content FinalDoc "Final Document" "Approved final version"

// Activity with tasks and content flow
Activity [Reviewer] ReviewProcess "Review Process" "Complete review cycle" {
    Task CheckFormat "Check Formatting" "Verify document formatting"
    Task ValidateContent "Validate Content" "Review content accuracy"
    dueDate: date "Review deadline"
    priority: choice(High, Medium, Low)
}
```

## Breakdown

### Activity Structure

```ecml
Activity [Reviewer] ReviewProcess "Review Process" "Complete review cycle" {
    // Tasks go here
    // Properties go here
}
```

| Part | Description |
|------|-------------|
| `Activity` | Keyword to define an activity |
| `[Reviewer]` | Role assignment (who performs this) |
| `ReviewProcess` | Identifier |
| `"Review Process"` | Display title |
| `"Complete review cycle"` | Description |
| `{ ... }` | Block containing tasks and properties |

### Tasks

```ecml
Task CheckFormat "Check Formatting" "Verify document formatting"
Task ValidateContent "Validate Content" "Review content accuracy"
```

Tasks follow the same pattern as activities but represent smaller units of work.

### Properties

```ecml
dueDate: date "Review deadline"
priority: choice(High, Medium, Low)
```

Properties define data fields associated with the activity.

## Variations

### Activity with Content Flow

```ecml
Activity [Reviewer] ReviewProcess "Review Process" "Review cycle" << Draft >> FinalDoc {
    Task Review "Review" "Perform review"
}
```

### Nested Tasks

```ecml
Activity [Manager] ApprovalProcess "Approval" "Approval workflow" {
    Task InitialReview "Initial Review" "First pass review" {
        Task CheckCompleteness "Check Completeness" "Verify all sections"
        Task CheckAccuracy "Check Accuracy" "Verify accuracy"
    }
    Task FinalDecision "Final Decision" "Make approval decision"
}
```

### Multiple Role Assignment

```ecml
Activity [Reviewer, Manager] DualReview "Dual Review" "Review requiring two roles" {
    Task PeerReview "Peer Review" "Review by peer"
    Task ManagerReview "Manager Review" "Review by manager"
}
```

### Task with Properties

```ecml
Activity [Analyst] Analysis "Data Analysis" "Analyze the data" {
    Task GatherData "Gather Data" "Collect required data" {
        sourceSystem: text "Data source"
        recordCount: integer "Number of records"
    }
    Task ProcessData "Process Data" "Transform and clean"
    Task GenerateReport "Generate Report" "Create analysis report"
}
```

## Content Flow Patterns

### Input Only

```ecml
Activity [Processor] Transform "Transform" "Transform data" << RawData
```

### Output Only

```ecml
Activity [Generator] Create "Create Report" "Generate report" >> Report
```

### Input and Output

```ecml
Activity [Processor] Process "Process" "Process data" << Input >> Output
```

## Best Practices

1. Assign roles to activities for clear responsibility
2. Break complex activities into logical tasks
3. Add properties for data that needs to be tracked
4. Define content flow to show data dependencies
5. Keep task names action-oriented
6. Use meaningful descriptions for documentation
