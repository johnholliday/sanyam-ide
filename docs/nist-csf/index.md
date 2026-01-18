---
title: "NIST CSF"
layout: layouts/home.njk
eleventyNavigation:
  key: Home
  order: 1
---

# NIST Cybersecurity Framework DSL

**NIST CSF** is a domain-specific language for modeling cybersecurity frameworks, profiles, and controls based on the NIST Cybersecurity Framework 2.0.

## Key Features

- **Framework** - Define complete CSF implementations with functions
- **Functions** - Model the six core CSF functions (Govern, Identify, Protect, Detect, Respond, Recover)
- **Categories & Subcategories** - Structure outcomes hierarchically
- **Profiles** - Create industry or organization-specific implementation profiles
- **Controls** - Reference security controls from NIST SP 800-53 and other standards
- **Informative References** - Map to external standards and guidance

## Quick Example

```nist-csf
// Define a security control
control AC_1 {
    id "AC-1"
    family "Access Control"
    description "Access control policy and procedures"
    baseline Moderate
}

// Define a CSF function with categories
function Identify {
    description "Develop organizational understanding to manage cybersecurity risk"

    category AssetManagement {
        id "ID.AM"
        description "Assets that enable the organization to achieve business purposes"

        subcategory PhysicalDevices {
            id "ID.AM-1"
            description "Physical devices and systems are inventoried"
        }
    }
}

// Define an implementation profile
profile EnterpriseBaseline {
    description "Enterprise-wide CSF implementation"
    target "Large Organizations"

    mapping PhysicalDevices -> Repeatable
        notes "Hardware inventory is automated"
}
```

## Getting Started

Ready to model your cybersecurity framework?

1. [Getting Started Guide](/getting-started/) - Learn the basics
2. [Language Reference](/language/) - Complete syntax documentation
3. [Examples](/examples/) - Real-world usage patterns

## Core Concepts

### Functions

The six core CSF functions organize cybersecurity outcomes:

```nist-csf
function Govern {
    description "Establish and monitor cybersecurity risk management strategy"
}

function Identify {
    description "Understand context to manage cybersecurity risk"
}

function Protect {
    description "Implement safeguards for critical services"
}

function Detect {
    description "Identify cybersecurity events"
}

function Respond {
    description "Take action on detected incidents"
}

function Recover {
    description "Maintain resilience and restore capabilities"
}
```

### Implementation Tiers

Profile mappings use four implementation tiers:

| Tier | Description |
|------|-------------|
| `Partial` | Risk management is ad hoc and reactive |
| `RiskInformed` | Risk management practices are approved but may not be organization-wide |
| `Repeatable` | Formal policies exist and practices are regularly updated |
| `Adaptive` | Organization adapts based on lessons learned and predictive indicators |

### Control Baselines

Security controls have three impact levels:

| Baseline | Description |
|----------|-------------|
| `Low` | Minimal impact on operations |
| `Moderate` | Serious adverse effect |
| `High` | Severe or catastrophic effect |

## File Extension

NIST CSF files use the `.nist-csf` extension.
