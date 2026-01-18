/**
 * GARP - Generally Accepted Recordkeeping Principles Grammar
 *
 * A DSL for modeling information governance and recordkeeping programs
 * based on ARMA International's GARP framework.
 *
 * Source: https://en.wikipedia.org/wiki/Generally_Accepted_Recordkeeping_Principles
 *
 * Key concepts:
 * - 8 Principles: Accountability, Integrity, Protection, Compliance,
 *   Availability, Retention, Disposition, Transparency
 * - Maturity Model: 5 levels from Sub-standard to Transformational
 * - Organizations, Policies, Assessments
 */

grammar Garp

entry Model:
    (elements+=Element)*;

Element:
    Organization | Policy | Assessment | RetentionSchedule | DispositionRule;

/**
 * Organization - An entity with a recordkeeping program
 */
Organization:
    'organization' name=ID '{'
        ('description' description=STRING)?
        ('maturity' maturityLevel=MaturityLevel)?
        (policies+=PolicyRef)*
        (assessments+=AssessmentRef)*
    '}';

/**
 * Policy - A recordkeeping policy addressing one or more principles
 */
Policy:
    'policy' name=ID '{'
        ('description' description=STRING)?
        ('principle' principle=Principle)?
        ('status' status=PolicyStatus)?
        ('owner' owner=STRING)?
        ('effective' effectiveDate=STRING)?
        (requirements+=Requirement)*
    '}';

/**
 * Requirement - A specific requirement within a policy
 */
Requirement:
    'requirement' name=ID '{'
        ('description' description=STRING)?
        ('mandatory' mandatory?='true')?
    '}';

/**
 * Assessment - An evaluation of recordkeeping practices against GARP principles
 */
Assessment:
    'assessment' name=ID '{'
        ('description' description=STRING)?
        ('date' date=STRING)?
        ('assessor' assessor=STRING)?
        (scores+=PrincipleScore)*
        (findings+=Finding)*
        (recommendations+=Recommendation)*
    '}';

/**
 * PrincipleScore - A maturity score for a specific principle
 */
PrincipleScore:
    'score' principle=Principle ':' level=MaturityLevel
        ('notes' notes=STRING)?;

/**
 * Finding - An observation from an assessment
 */
Finding:
    'finding' name=ID '{'
        ('description' description=STRING)?
        ('principle' principle=Principle)?
        ('severity' severity=Severity)?
    '}';

/**
 * Recommendation - A suggested improvement from an assessment
 */
Recommendation:
    'recommendation' name=ID '{'
        ('description' description=STRING)?
        ('principle' principle=Principle)?
        ('priority' priority=Priority)?
        ('targetLevel' targetLevel=MaturityLevel)?
    '}';

/**
 * RetentionSchedule - Defines how long records should be kept
 */
RetentionSchedule:
    'retention' name=ID '{'
        ('description' description=STRING)?
        ('recordType' recordType=STRING)?
        ('period' retentionPeriod=STRING)?
        ('trigger' trigger=STRING)?
        ('legalBasis' legalBasis=STRING)?
    '}';

/**
 * DispositionRule - Defines how records should be disposed
 */
DispositionRule:
    'disposition' name=ID '{'
        ('description' description=STRING)?
        ('method' method=DispositionMethod)?
        ('approval' approvalRequired?='required')?
        ('retention' retention=[RetentionSchedule:ID])?
    '}';

/**
 * References for cross-linking
 */
PolicyRef:
    'uses' 'policy' policy=[Policy:ID];

AssessmentRef:
    'assessed' 'by' assessment=[Assessment:ID];

/**
 * The 8 GARP Principles
 */
Principle returns string:
    'Accountability' | 'Integrity' | 'Protection' | 'Compliance' |
    'Availability' | 'Retention' | 'Disposition' | 'Transparency';

/**
 * Maturity Model Levels (1-5)
 */
MaturityLevel returns string:
    'SubStandard' | 'InDevelopment' | 'Essential' | 'Proactive' | 'Transformational';

/**
 * Policy Status
 */
PolicyStatus returns string:
    'Draft' | 'Active' | 'UnderReview' | 'Retired';

/**
 * Finding Severity
 */
Severity returns string:
    'Critical' | 'High' | 'Medium' | 'Low' | 'Info';

/**
 * Recommendation Priority
 */
Priority returns string:
    'Immediate' | 'ShortTerm' | 'MediumTerm' | 'LongTerm';

/**
 * Disposition Methods
 */
DispositionMethod returns string:
    'Destroy' | 'Archive' | 'Transfer' | 'Review';

// Terminal rules
hidden terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w_]*/;
terminal STRING: /"[^"]*"|'[^']*'/;

hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
