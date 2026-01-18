---
layout: layouts/doc.njk
title: "Basic Content"
description: Define a simple content item in ECML
eleventyNavigation:
  key: Basic Content
  parent: Examples
  order: 2
---

# Basic Content

This example shows how to define a simple content item in ECML.

## Overview

**Content** represents documents, files, or data artifacts in your enterprise model. Content can have attributes, labels, flow relationships, and custom properties.

## Example

```ecml
// Basic Example: Defining Content
// Content represents documents, files, or data artifacts

Content Report "Monthly Report" "Financial summary for the month"
```

## Breakdown

| Part | Description |
|------|-------------|
| `Content` | Keyword to define content |
| `Report` | The identifier (used for references) |
| `"Monthly Report"` | The display title |
| `"Financial summary..."` | The description |

## Variations

### Content with Attributes

```ecml
Content [format=DOCX, type=Word] Contract "Contract Document" "Legal contract"
```

Available attributes:
- `format`: `TXT`, `DOCX`, `CSV`, `XLSX`, `PDF`, `MD`, `JSON`, `XML`
- `type`: `Text`, `Word`, `Excel`, `Pdf`, `Image`, `Diagram`, etc.
- `template`: Reference to a template
- `schema`: Reference to a schema

### Content with Properties

```ecml
Content Invoice "Invoice" "Payment invoice" {
    amount: currency "Invoice amount"
    dueDate: date "Payment due date"
    status: choice(Draft, Sent, Paid, Overdue)
}
```

### Content with Labels

```ecml
RetentionLabel SevenYear "7 Year" "Retain for 7 years"
SensitivityLabel Confidential "Confidential" "Internal only"

Content [format=PDF] FinancialReport "Financial Report" "Annual financials" [SevenYear(Confidential)]
```

### Content with Flow

```ecml
Content RawData "Raw Data" "Unprocessed data"
Content ProcessedData "Processed Data" "Cleaned data" << RawData
Content FinalReport "Final Report" "Analysis results" << ProcessedData
```

### Nested Content

```ecml
Content Document "Document Package" "Collection of documents" {
    Content MainDoc "Main Document" "Primary document"
    Content Appendix "Appendix" "Supporting materials"
}
```

## Usage

Content is referenced in:

- **Flow relationships**: `<< Source` or `>> Target`
- **Activities**: `Activity Review "Review" "Review process" >> ApprovedDoc`
- **Labels**: `[RetentionLabel(SensitivityLabel)]`

## Best Practices

1. Use descriptive identifiers that reflect the content's purpose
2. Apply appropriate format and type attributes
3. Set retention and sensitivity labels for compliance
4. Define flow relationships to show data lineage
