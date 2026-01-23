---
layout: base.njk
title: File Template
order: 7
---

# File Template

Use this template when creating new GARP files. It includes all available constructs with TODO placeholders to customize.

## Template

```garp
// GARP - Generally Accepted Recordkeeping Principles
// New file template - customize for your information governance needs

// TODO: Define your organization
organization YourOrganization {
    description "TODO: Describe your organization"
    maturity Essential  // Options: SubStandard, InDevelopment, Essential, Proactive, Transformational
    // uses policy YourPolicy
    // assessed by YourAssessment
}

// TODO: Define policies addressing GARP principles
// Principles: Accountability, Integrity, Protection, Compliance,
//             Availability, Retention, Disposition, Transparency
policy YourPolicy {
    description "TODO: Describe the policy purpose"
    principle Accountability  // TODO: Choose appropriate principle
    status Draft  // Options: Draft, Active, UnderReview, Retired
    owner "TODO: Policy owner name"
    effective "YYYY-MM-DD"

    // TODO: Add requirements
    requirement YourRequirement {
        description "TODO: Describe the requirement"
        mandatory true
    }
}

// TODO: Define retention schedules
retention YourRetentionSchedule {
    description "TODO: Describe retention requirements"
    recordType "TODO: Type of records covered"
    period "TODO: e.g., 7 years"
    trigger "TODO: e.g., creation, termination, expiration"
    legalBasis "TODO: Legal or regulatory basis"
}

// TODO: Define disposition rules
disposition YourDispositionRule {
    description "TODO: Describe disposition process"
    method Destroy  // Options: Destroy, Archive, Transfer, Review
    approval required
    retention YourRetentionSchedule
}

// TODO: Create assessments to track maturity
assessment YourAssessment {
    description "TODO: Describe assessment scope"
    date "YYYY-MM-DD"
    assessor "TODO: Assessor name or firm"

    // Score each principle
    score Accountability : Essential
    score Integrity : Essential
    score Protection : Essential
    score Compliance : Essential
    score Availability : Essential
    score Retention : Essential
    score Disposition : Essential
    score Transparency : Essential

    // TODO: Document findings
    finding YourFinding {
        description "TODO: Describe the finding"
        principle Accountability
        severity Medium  // Options: Critical, High, Medium, Low, Info
    }

    // TODO: Add recommendations
    recommendation YourRecommendation {
        description "TODO: Describe recommended action"
        principle Accountability
        priority ShortTerm  // Options: Immediate, ShortTerm, MediumTerm, LongTerm
        targetLevel Proactive
    }
}
```

## How to Use This Template

1. **Copy the template** to a new `.garp` file
2. **Replace `TODO:` placeholders** with your specific content
3. **Remove unused sections** - not every file needs all constructs
4. **Uncomment references** - enable `uses policy` and `assessed by` when ready
5. **Update identifiers** - change `YourOrganization`, `YourPolicy`, etc. to meaningful names

## Quick Reference

### Maturity Levels
- `SubStandard` - No formal program
- `InDevelopment` - Program being developed
- `Essential` - Minimum requirements met
- `Proactive` - Exceeds requirements
- `Transformational` - Industry leader

### GARP Principles
- `Accountability` - Executive oversight
- `Integrity` - Authenticity and accuracy
- `Protection` - Security and access control
- `Compliance` - Regulatory adherence
- `Availability` - Search and retrieval
- `Retention` - How long to keep
- `Disposition` - How to dispose
- `Transparency` - Documentation and communication

### Policy Status
- `Draft` - Being developed
- `Active` - Currently in effect
- `UnderReview` - Being revised
- `Retired` - No longer active

### Finding Severity
- `Critical` - Immediate action required
- `High` - Prompt attention needed
- `Medium` - Near-term remediation
- `Low` - Future improvement
- `Info` - Observation only

### Recommendation Priority
- `Immediate` - Address now
- `ShortTerm` - 1-3 months
- `MediumTerm` - 3-12 months
- `LongTerm` - 1+ years

### Disposition Methods
- `Destroy` - Secure destruction
- `Archive` - Long-term storage
- `Transfer` - Move to another system
- `Review` - Evaluate for action
