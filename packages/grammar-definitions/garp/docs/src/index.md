---
layout: base.njk
title: Overview
---

# GARP Language

A domain-specific language for modeling information governance and recordkeeping programs based on **ARMA International's Generally Accepted Recordkeeping Principles (GARP)** framework.

## What is GARP?

The Generally Accepted Recordkeeping Principles (GARP) is a framework developed by ARMA International that provides the foundation for effective information governance. It consists of **8 principles** that organizations should follow to manage their records and information assets effectively.

<div class="feature-grid">
  <div class="feature-card">
    <h3>Accountability</h3>
    <p>A senior executive oversees the recordkeeping program and delegates responsibility appropriately.</p>
  </div>
  <div class="feature-card">
    <h3>Integrity</h3>
    <p>Information assets are authentic and their provenance can be verified.</p>
  </div>
  <div class="feature-card">
    <h3>Protection</h3>
    <p>Appropriate controls protect information assets from unauthorized access.</p>
  </div>
  <div class="feature-card">
    <h3>Compliance</h3>
    <p>The program complies with applicable laws, regulations, and policies.</p>
  </div>
  <div class="feature-card">
    <h3>Availability</h3>
    <p>Information can be located and retrieved in a timely manner.</p>
  </div>
  <div class="feature-card">
    <h3>Retention</h3>
    <p>Information is maintained for an appropriate time based on legal and business requirements.</p>
  </div>
  <div class="feature-card">
    <h3>Disposition</h3>
    <p>Information is disposed of in a secure and appropriate manner when no longer needed.</p>
  </div>
  <div class="feature-card">
    <h3>Transparency</h3>
    <p>Processes and activities are documented and available to authorized stakeholders.</p>
  </div>
</div>

## Why Use the GARP Language?

The GARP language allows you to:

- **Model your organization's** information governance program as code
- **Define policies** that address specific GARP principles
- **Create retention schedules** for different record types
- **Specify disposition rules** for records at end of life
- **Conduct assessments** to measure maturity against the GARP framework
- **Track findings and recommendations** for continuous improvement

## Quick Example

```garp
organization AcmeCorp {
    description "A technology company with mature information governance"
    maturity Proactive
    uses policy DataProtectionPolicy
    assessed by Q4Assessment
}

policy DataProtectionPolicy {
    description "Policy for protecting sensitive information"
    principle Protection
    status Active
    owner "Chief Information Security Officer"
    effective "2024-01-01"

    requirement EncryptionAtRest {
        description "All sensitive data must be encrypted at rest"
        mandatory true
    }
}

assessment Q4Assessment {
    description "Q4 2024 GARP Maturity Assessment"
    date "2024-12-15"
    assessor "External Audit Firm"

    score Accountability : Proactive
    score Protection : Transformational
    score Compliance : Essential
}
```

## Maturity Model

GARP uses a 5-level maturity model to assess an organization's recordkeeping capabilities:

| Level | Name | Description |
|-------|------|-------------|
| 1 | **SubStandard** | No formal program; significant risk exposure |
| 2 | **InDevelopment** | Recognizes need; program being developed |
| 3 | **Essential** | Minimum requirements met; basic compliance |
| 4 | **Proactive** | Exceeds requirements; continuous improvement |
| 5 | **Transformational** | Industry leader; strategic value creation |

## Getting Started

Ready to model your information governance program? Check out the [Getting Started](/getting-started/) guide to learn the basics, or dive into the [Language Reference](/language-reference/) for complete documentation.
