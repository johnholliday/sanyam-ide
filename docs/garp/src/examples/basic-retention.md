---
layout: base.njk
title: Retention Schedule
order: 3
---

# Retention Schedule

Define how long different types of records should be retained before disposition.

## Example

```garp
// Basic Example: A retention schedule
// Demonstrates specifying retention requirements for a record type

retention FinancialRecords {
    description "Retention schedule for financial and accounting records"
    recordType "General Ledger, Accounts Payable/Receivable, Tax Records"
    period "7 years"
    trigger "End of fiscal year"
    legalBasis "IRS Regulations 26 CFR, SOX Section 802"
}
```

## Explanation

### Retention Attributes

- **`description`** - Purpose and scope of this schedule
- **`recordType`** - What types of records are covered
- **`period`** - How long to retain (can be a duration or "Permanent")
- **`trigger`** - Event that starts the retention clock
- **`legalBasis`** - Legal, regulatory, or business justification

### Common Retention Triggers

| Trigger | When Retention Starts |
|---------|----------------------|
| Record creation | When the record is first created |
| End of fiscal year | After the fiscal year ends |
| Contract expiration | When a contract terminates |
| Employee termination | When employee leaves organization |
| Project completion | When a project is closed |
| Last activity | Last modification or access |

### Common Retention Periods

| Period | Description |
|--------|-------------|
| 1 year | Short-term operational records |
| 3 years | General business correspondence |
| 7 years | Tax and financial records |
| 10 years | Contracts, employment records |
| Permanent | Corporate records, audit reports |

## Linking to Disposition

Retention schedules are referenced by disposition rules:

```garp
retention FinancialRecords {
    description "Financial record retention"
    period "7 years"
    trigger "End of fiscal year"
    legalBasis "IRS Regulations"
}

disposition FinancialDisposition {
    description "Secure destruction of financial records"
    method Destroy
    approval required
    retention FinancialRecords
}
```

The `retention` reference in the disposition rule links these together, ensuring records are disposed according to the defined schedule.

## Multiple Schedules Example

Organizations typically have multiple retention schedules:

```garp
retention EmailRecords {
    description "Business email retention"
    recordType "Email communications with business value"
    period "3 years"
    trigger "Message date"
    legalBasis "Business records best practices"
}

retention ContractRecords {
    description "Contract and agreement retention"
    recordType "Vendor contracts, NDAs, service agreements"
    period "10 years after expiration"
    trigger "Contract expiration"
    legalBasis "Statute of Limitations"
}

retention HRRecords {
    description "Employee records retention"
    recordType "Personnel files, performance reviews"
    period "7 years after termination"
    trigger "Employee termination date"
    legalBasis "EEOC Regulations"
}
```

## Next Steps

- Define [disposition rules](/examples/advanced-complete/#disposition-rules) for each retention schedule
- Link retention policies to your organization
- See the [Complete GARP Program](/examples/advanced-complete/) for a full model
