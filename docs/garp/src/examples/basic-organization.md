---
layout: base.njk
title: Simple Organization
order: 1
---

# Simple Organization

The most basic GARP model: an organization definition with minimal attributes.

## Example

```garp
// Basic Example: A simple organization definition
// This demonstrates the minimal structure for defining an organization

organization SmallBusinessCo {
    description "A small business beginning its information governance journey"
    maturity InDevelopment
}
```

## Explanation

This example shows:

- **`organization`** keyword followed by a name identifier
- **`description`** provides context about the organization
- **`maturity`** sets the overall GARP maturity level

### Maturity Levels

The `InDevelopment` level indicates this organization:
- Recognizes the need for information governance
- Is actively developing their program
- Has not yet achieved minimum compliance requirements

Other maturity levels you could use:
- `SubStandard` - No formal program exists
- `Essential` - Minimum requirements are met
- `Proactive` - Exceeds requirements with continuous improvement
- `Transformational` - Industry leader creating strategic value

## Next Steps

Once you have an organization defined, you can:
- Add policies using `uses policy PolicyName`
- Reference assessments using `assessed by AssessmentName`
- Define the policies and assessments elsewhere in your model

See the [Organization with Policies](/examples/intermediate-organization/) example for more advanced usage.
