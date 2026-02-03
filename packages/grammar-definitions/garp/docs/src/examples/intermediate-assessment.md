---
layout: base.njk
title: Assessment with Findings
order: 5
---

# Assessment with Findings

Conduct a GARP assessment, score each principle, and document findings with recommendations.

## Example

```garp
// Intermediate Example: A GARP assessment with findings and recommendations
// Demonstrates scoring against the 8 principles and documenting gaps

assessment Q4_2024_GARPAudit {
    description "Quarterly GARP compliance assessment for Q4 2024"
    date "2024-12-15"
    assessor "External Audit Firm - InfoGov Consultants"

    // Scores for each of the 8 GARP principles
    score Accountability : Proactive
        notes "Strong executive sponsorship and clear RIM officer designation"

    score Integrity : Essential
        notes "Basic audit trails in place but metadata management needs improvement"

    score Protection : Proactive
        notes "Robust security controls with encryption and access management"

    score Compliance : Essential
        notes "Meeting regulatory requirements but reactive approach"

    score Availability : InDevelopment
        notes "Search and retrieval capabilities are limited"

    score Retention : Essential
        notes "Retention schedules exist but not consistently applied"

    score Disposition : SubStandard
        notes "No formal disposition process in place"

    score Transparency : Essential
        notes "Policies documented but not widely communicated"

    // Key findings from the assessment
    finding DispositionGap {
        description "Organization lacks a formal disposition process for records past retention"
        principle Disposition
        severity Critical
    }

    finding MetadataInconsistency {
        description "Metadata standards are not consistently applied across systems"
        principle Integrity
        severity High
    }

    finding SearchLimitations {
        description "Users report difficulty finding records when needed"
        principle Availability
        severity Medium
    }

    // Recommendations for improvement
    recommendation ImplementDisposition {
        description "Establish a formal disposition workflow with approval gates"
        principle Disposition
        priority Immediate
        targetLevel Essential
    }

    recommendation MetadataGovernance {
        description "Create metadata standards and implement validation controls"
        principle Integrity
        priority ShortTerm
        targetLevel Proactive
    }

    recommendation EnhanceSearch {
        description "Implement enterprise search with full-text indexing"
        principle Availability
        priority MediumTerm
        targetLevel Proactive
    }
}
```

## Explanation

### Assessment Structure

An assessment includes:
1. **Metadata** - Description, date, assessor
2. **Principle Scores** - Maturity rating for each of the 8 principles
3. **Findings** - Issues or gaps discovered
4. **Recommendations** - Suggested improvements

### Scoring Principles

Each principle receives a maturity score:

```garp
score Accountability : Proactive
    notes "Explanation of why this score was given"
```

The `notes` attribute is optional but valuable for documenting rationale.

### Severity Levels for Findings

| Severity | Meaning | Action |
|----------|---------|--------|
| `Critical` | Major compliance/risk issue | Immediate action required |
| `High` | Significant gap | Address promptly |
| `Medium` | Moderate issue | Plan remediation |
| `Low` | Minor improvement area | Address when convenient |
| `Info` | Observation only | No action required |

### Priority Levels for Recommendations

| Priority | Timeframe | Typical Use |
|----------|-----------|-------------|
| `Immediate` | Now | Critical findings |
| `ShortTerm` | 1-3 months | High-priority gaps |
| `MediumTerm` | 3-12 months | Planned improvements |
| `LongTerm` | 1+ years | Strategic initiatives |

### Target Maturity Levels

Recommendations specify the target maturity after implementation:

```garp
recommendation EnhanceSearch {
    description "Implement enterprise search"
    principle Availability
    priority MediumTerm
    targetLevel Proactive  // From InDevelopment to Proactive
}
```

## Linking Assessment to Organization

Connect the assessment to an organization:

```garp
organization MyOrg {
    description "My organization"
    maturity Essential
    assessed by Q4_2024_GARPAudit
}
```

## Assessment Best Practices

1. **Score all 8 principles** - Comprehensive assessment covers everything
2. **Document notes** - Explain scoring rationale
3. **Link findings to principles** - Show which principle is affected
4. **Prioritize recommendations** - Guide improvement efforts
5. **Set target levels** - Define success criteria

## Tracking Progress Over Time

Conduct regular assessments to track improvement:

```garp
assessment Q1_2024_Assessment {
    date "2024-03-15"
    score Disposition : SubStandard
    // ...
}

assessment Q4_2024_Assessment {
    date "2024-12-15"
    score Disposition : Essential  // Improved!
    // ...
}
```

## Next Steps

- See the [Complete GARP Program](/examples/advanced-complete/) for a full model
- Learn about [retention schedules](/examples/basic-retention/) and disposition rules
- Review the [Language Reference](/language-reference/) for complete syntax
