// HIPAA Compliance DSL
// A language for modeling HIPAA compliance elements including
// covered entities, PHI data, safeguards, policies, and breach incidents.

grammar HipaaCompliance

// Entry point - defines the overall compliance model structure
entry Model:
    elements+=Element*;

// Top-level element types
Element:
    CoveredEntity | BusinessAssociate | PhiCategory | Safeguard |
    Policy | RiskAssessment | TrainingRecord | BreachIncident |
    BusinessAssociateAgreement;

// =============================================================================
// Covered Entities
// =============================================================================

// Organizations subject to HIPAA regulations
CoveredEntity:
    'entity' name=ID '{'
        'type' entityType=EntityType
        ('description' description=STRING)?
        ('contact' contact=STRING)?
        ('associates' associates+=[BusinessAssociate:ID])*
        ('safeguards' safeguards+=[Safeguard:ID])*
        ('policies' policies+=[Policy:ID])*
    '}';

EntityType returns string:
    'HealthPlan' | 'HealthcareProvider' | 'Clearinghouse';

// Business Associates - contractors handling PHI
BusinessAssociate:
    'associate' name=ID '{'
        ('description' description=STRING)?
        ('contact' contact=STRING)?
        ('services' services+=STRING)*
        ('agreement' agreement=[BusinessAssociateAgreement:ID])?
    '}';

// Business Associate Agreement
BusinessAssociateAgreement:
    'agreement' name=ID '{'
        ('coveredEntities' coveredEntities+=[CoveredEntity:ID])*
        ('businessAssociates' businessAssociates+=[BusinessAssociate:ID])*
        'effectiveDate' effectiveDate=STRING
        ('expirationDate' expirationDate=STRING)?
        ('terms' terms+=STRING)*
        ('status' status=AgreementStatus)?
    '}';

AgreementStatus returns string:
    'Active' | 'Expired' | 'Pending' | 'Terminated';

// =============================================================================
// Protected Health Information (PHI)
// =============================================================================

// PHI data categories and elements
PhiCategory:
    'phi' name=ID '{'
        'classification' classification=PhiClassification
        ('description' description=STRING)?
        ('identifiers' identifiers+=PhiIdentifier)*
        ('dataElements' dataElements+=STRING)*
        ('retentionPeriod' retentionPeriod=STRING)?
        ('storageLocations' storageLocations+=STRING)*
    '}';

PhiClassification returns string:
    'Standard' | 'Sensitive' | 'PsychotherapyNotes' | 'Genetic' | 'Substance';

PhiIdentifier:
    'identifier' identifierType=IdentifierType ('value' value=STRING)?;

IdentifierType returns string:
    'Name' | 'Address' | 'Dates' | 'Phone' | 'Fax' | 'Email' | 'SSN' |
    'MRN' | 'HealthPlanID' | 'AccountNumber' | 'License' | 'VIN' |
    'DeviceID' | 'URL' | 'IP' | 'Biometric' | 'Photo' | 'Other';

// =============================================================================
// Safeguards (Security Rule)
// =============================================================================

// Security safeguards for protecting ePHI
Safeguard:
    'safeguard' name=ID '{'
        'category' category=SafeguardCategory
        'requirement' requirement=RequirementLevel
        ('description' description=STRING)?
        ('implementation' implementation=STRING)?
        ('controls' controls+=Control)*
        ('status' status=ImplementationStatus)?
        ('reviewDate' reviewDate=STRING)?
    '}';

SafeguardCategory returns string:
    'Administrative' | 'Physical' | 'Technical';

RequirementLevel returns string:
    'Required' | 'Addressable';

ImplementationStatus returns string:
    'Implemented' | 'Partial' | 'Planned' | 'NotApplicable';

Control:
    'control' controlName=ID '{'
        ('description' description=STRING)?
        ('evidence' evidence=STRING)?
        ('testDate' testDate=STRING)?
        ('result' result=ControlResult)?
    '}';

ControlResult returns string:
    'Pass' | 'Fail' | 'NotTested' | 'Remediation';

// =============================================================================
// Policies and Procedures
// =============================================================================

// Documented policies required by HIPAA
Policy:
    'policy' name=ID '{'
        'type' policyType=PolicyType
        ('version' version=STRING)?
        ('effectiveDate' effectiveDate=STRING)?
        ('reviewDate' reviewDate=STRING)?
        ('owner' owner=STRING)?
        ('description' description=STRING)?
        ('procedures' procedures+=Procedure)*
        ('status' status=PolicyStatus)?
    '}';

PolicyType returns string:
    'Privacy' | 'Security' | 'Breach' | 'Access' | 'Sanction' |
    'Contingency' | 'DataRetention' | 'Disposal' | 'Encryption' | 'Other';

PolicyStatus returns string:
    'Draft' | 'Active' | 'UnderReview' | 'Retired';

Procedure:
    'procedure' procedureName=ID '{'
        ('steps' steps+=STRING)*
        ('responsible' responsible=STRING)?
    '}';

// =============================================================================
// Risk Assessment
// =============================================================================

// Documented risk assessments
RiskAssessment:
    'riskAssessment' name=ID '{'
        ('date' date=STRING)?
        ('scope' scope=STRING)?
        ('methodology' methodology=STRING)?
        ('findings' findings+=Finding)*
        ('status' status=AssessmentStatus)?
    '}';

AssessmentStatus returns string:
    'InProgress' | 'Completed' | 'Scheduled';

Finding:
    'finding' findingName=ID '{'
        'severity' severity=Severity
        ('description' description=STRING)?
        ('recommendation' recommendation=STRING)?
        ('remediation' remediation=RemediationStatus)?
        ('dueDate' dueDate=STRING)?
    '}';

Severity returns string:
    'Critical' | 'High' | 'Medium' | 'Low';

RemediationStatus returns string:
    'Open' | 'InProgress' | 'Completed' | 'Accepted';

// =============================================================================
// Training Records
// =============================================================================

// Workforce training documentation
TrainingRecord:
    'training' name=ID '{'
        'topic' topic=TrainingTopic
        ('date' date=STRING)?
        ('attendees' attendees+=STRING)*
        ('duration' duration=STRING)?
        ('materials' materials=STRING)?
        ('trainer' trainer=STRING)?
        ('acknowledgements' acknowledgements+=Acknowledgement)*
    '}';

TrainingTopic returns string:
    'Privacy' | 'Security' | 'BreachResponse' | 'RoleSpecific' |
    'NewHire' | 'Annual' | 'Other';

Acknowledgement:
    'ack' employee=STRING ('date' date=STRING)?;

// =============================================================================
// Breach Incidents
// =============================================================================

// Breach incident documentation and notification tracking
BreachIncident:
    'breach' name=ID '{'
        'discoveryDate' discoveryDate=STRING
        ('description' description=STRING)?
        ('affectedIndividuals' affectedIndividuals=INT)?
        ('phiInvolved' phiInvolved+=[PhiCategory:ID])*
        ('cause' cause=BreachCause)?
        ('tier' tier=PenaltyTier)?
        ('notifications' notifications+=Notification)*
        ('status' status=BreachStatus)?
        ('remediation' remediation=STRING)?
    '}';

BreachCause returns string:
    'Theft' | 'Loss' | 'Unauthorized' | 'Hacking' | 'Improper' |
    'Disposal' | 'Other';

PenaltyTier returns string:
    'Tier1' | 'Tier2' | 'Tier3' | 'Tier4';

BreachStatus returns string:
    'Investigating' | 'Confirmed' | 'NotABreach' | 'Closed';

Notification:
    'notify' recipientType=RecipientType '{'
        ('date' date=STRING)?
        ('method' method=STRING)?
        ('status' status=NotificationStatus)?
    '}';

RecipientType returns string:
    'Individual' | 'HHS' | 'Media' | 'StateAttorney';

NotificationStatus returns string:
    'Pending' | 'Sent' | 'Confirmed' | 'NotRequired';

// =============================================================================
// Terminals
// =============================================================================

hidden terminal WS: /\s+/;
hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;

terminal ID: /[_a-zA-Z][\w_]*/;
terminal STRING: /"[^"]*"|'[^']*'/;
terminal INT returns number: /[0-9]+/;
