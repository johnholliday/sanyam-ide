/**
 * IGIM - Information Governance Implementation Model Grammar
 *
 * Based on ARMA International's IGIM framework, this grammar models the seven key
 * areas necessary for implementing a successful Information Governance program:
 *
 * 1. Steering Committee - IG leadership team with stakeholder representation
 * 2. Authorities - Rules, frameworks, regulations, and compliance requirements
 * 3. Supports - Organizational support structures (change management, training)
 * 4. Processes - Consistency elements (policies, procedures, metrics, roles)
 * 5. Capabilities - Information lifecycle management (access, protection, privacy)
 * 6. Structures - Information organization (taxonomy, metadata, architecture)
 * 7. Infrastructure - Systems and technology (applications, networks, security)
 *
 * @see https://www.arma.org/igim
 */
grammar Igim

// ═══════════════════════════════════════════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Entry rule defining an Information Governance Program.
 * A program contains elements from all seven IGIM areas.
 */
entry IGProgram:
    'program' name=ID '{'
        ('description' description=STRING)?
        ('maturity' maturityLevel=MaturityLevel)?
        elements+=IGElement*
    '}';

// ═══════════════════════════════════════════════════════════════════════════════
// BASE ELEMENT TYPE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Union type for all IGIM elements.
 */
IGElement:
    SteeringCommittee | Authority | Support | Process | Capability | Structure | Infrastructure |
    Stakeholder | MaturityAssessment | PolicyDocument | Risk;

// ═══════════════════════════════════════════════════════════════════════════════
// 1. STEERING COMMITTEE - Leadership and Governance
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Steering Committee represents the IG leadership team.
 * Should have broad representation across stakeholder interests.
 */
SteeringCommittee:
    'committee' name=ID '{'
        ('description' description=STRING)?
        ('meets' meetingFrequency=Frequency)?
        ('chair' chair=[Stakeholder:ID])?
        ('members' members+=[Stakeholder:ID]+ )?
        ('responsibilities' '{' responsibilities+=STRING+ '}')?
    '}';

/**
 * A stakeholder in the IG program.
 */
Stakeholder:
    'stakeholder' name=ID '{'
        ('title' title=STRING)?
        ('department' department=STRING)?
        ('role' role=StakeholderRole)?
        ('email' email=STRING)?
    '}';

StakeholderRole returns string:
    'executive' | 'legal' | 'compliance' | 'it' | 'records' | 'privacy' | 'security' | 'business' | 'other';

// ═══════════════════════════════════════════════════════════════════════════════
// 2. AUTHORITIES - Rules, Frameworks, and Compliance
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Authority represents guiderails for IG efforts - rules, regulations,
 * frameworks, standards, and organizational culture/risk tolerance.
 */
Authority:
    'authority' name=ID '{'
        ('description' description=STRING)?
        ('type' type=AuthorityType)?
        ('source' source=STRING)?
        ('jurisdiction' jurisdiction=STRING)?
        ('effectiveDate' effectiveDate=STRING)?
        ('requirements' '{' requirements+=Requirement+ '}')?
    '}';

AuthorityType returns string:
    'regulation' | 'standard' | 'framework' | 'policy' | 'contract' | 'guideline' | 'best-practice';

Requirement:
    'requirement' name=ID '{'
        ('text' text=STRING)?
        ('priority' priority=Priority)?
        ('controls' controls+=[Process:ID]* )?
    '}';

/**
 * Risk tolerance and organizational factors.
 */
Risk:
    'risk' name=ID '{'
        ('description' description=STRING)?
        ('category' category=RiskCategory)?
        ('likelihood' likelihood=RiskLevel)?
        ('impact' impact=RiskLevel)?
        ('tolerance' tolerance=RiskLevel)?
        ('mitigations' mitigations+=[Process:ID]* )?
    '}';

RiskCategory returns string:
    'legal' | 'compliance' | 'operational' | 'reputational' | 'security' | 'financial' | 'strategic';

RiskLevel returns string:
    'very-low' | 'low' | 'medium' | 'high' | 'very-high';

// ═══════════════════════════════════════════════════════════════════════════════
// 3. SUPPORTS - Organizational Support Structures
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Support structures that assist in establishing the IG program.
 * Includes change management, project management, communications, training.
 */
Support:
    'support' name=ID '{'
        ('description' description=STRING)?
        ('type' type=SupportType)?
        ('owner' owner=[Stakeholder:ID])?
        ('status' status=Status)?
        ('activities' '{' activities+=Activity+ '}')?
    '}';

SupportType returns string:
    'change-management' | 'project-management' | 'communications' | 'training' | 'help-desk' | 'documentation';

Activity:
    'activity' name=ID '{'
        ('description' description=STRING)?
        ('frequency' frequency=Frequency)?
        ('audience' audience=STRING)?
    '}';

// ═══════════════════════════════════════════════════════════════════════════════
// 4. PROCESSES - Consistency and Accountability
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Processes ensure consistency in the IG program.
 * Includes metrics, policies, procedures, rules, roles, and accountability.
 */
Process:
    'process' name=ID '{'
        ('description' description=STRING)?
        ('type' type=ProcessType)?
        ('owner' owner=[Stakeholder:ID])?
        ('status' status=Status)?
        ('documents' documents+=[PolicyDocument:ID]* )?
        ('metrics' '{' metrics+=Metric+ '}')?
        ('steps' '{' steps+=Step+ '}')?
    '}';

ProcessType returns string:
    'policy' | 'procedure' | 'workflow' | 'review' | 'audit' | 'monitoring' | 'reporting';

/**
 * Policy or procedure document.
 */
PolicyDocument:
    'document' name=ID '{'
        ('title' title=STRING)?
        ('type' type=DocumentType)?
        ('version' version=STRING)?
        ('owner' owner=[Stakeholder:ID])?
        ('approver' approver=[Stakeholder:ID])?
        ('reviewDate' reviewDate=STRING)?
        ('status' status=DocumentStatus)?
    '}';

DocumentType returns string:
    'policy' | 'procedure' | 'standard' | 'guideline' | 'form' | 'template' | 'handbook';

DocumentStatus returns string:
    'draft' | 'review' | 'approved' | 'published' | 'retired';

Metric:
    'metric' name=ID '{'
        ('description' description=STRING)?
        ('target' target=STRING)?
        ('frequency' frequency=Frequency)?
        ('owner' owner=[Stakeholder:ID])?
    '}';

Step:
    'step' sequence=INT name=ID '{'
        ('description' description=STRING)?
        ('responsible' responsible=[Stakeholder:ID])?
        ('duration' duration=STRING)?
    '}';

// ═══════════════════════════════════════════════════════════════════════════════
// 5. CAPABILITIES - Information Lifecycle Management
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Capabilities guide information through the organization throughout its lifecycle.
 * Includes lifecycle management, access, search, protection, and privacy.
 */
Capability:
    'capability' name=ID '{'
        ('description' description=STRING)?
        ('type' type=CapabilityType)?
        ('owner' owner=[Stakeholder:ID])?
        ('status' status=Status)?
        ('maturity' maturity=MaturityLevel)?
        ('lifecycleStages' '{' stages+=LifecycleStage+ '}')?
    '}';

CapabilityType returns string:
    'lifecycle' | 'access' | 'search' | 'protection' | 'privacy' | 'retention' | 'disposition';

LifecycleStage:
    'stage' name=ID '{'
        ('description' description=STRING)?
        ('phase' phase=LifecyclePhase)?
        ('controls' '{' controls+=STRING+ '}')?
    '}';

LifecyclePhase returns string:
    'creation' | 'capture' | 'classification' | 'storage' | 'use' | 'sharing' | 'archival' | 'disposition';

// ═══════════════════════════════════════════════════════════════════════════════
// 6. STRUCTURES - Information Organization
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Structures are building blocks of information organization.
 * Includes information architecture, taxonomy, metadata, technology architecture.
 */
Structure:
    'structure' name=ID '{'
        ('description' description=STRING)?
        ('type' type=StructureType)?
        ('owner' owner=[Stakeholder:ID])?
        ('status' status=Status)?
        ('elements' '{' elements+=StructureElement+ '}')?
    '}';

StructureType returns string:
    'taxonomy' | 'metadata-schema' | 'information-architecture' | 'technology-architecture' | 'file-format' | 'protocol';

StructureElement:
    'element' name=ID '{'
        ('description' description=STRING)?
        ('parent' parent=[StructureElement:ID])?
        ('properties' '{' properties+=Property+ '}')?
    '}';

Property:
    name=ID ':' value=STRING;

// ═══════════════════════════════════════════════════════════════════════════════
// 7. INFRASTRUCTURE - Systems and Technology
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Infrastructure represents abilities and models that underpin information systems.
 * Includes applications, networks, content services, hosting, SLAs, and security.
 */
Infrastructure:
    'infrastructure' name=ID '{'
        ('description' description=STRING)?
        ('type' type=InfrastructureType)?
        ('owner' owner=[Stakeholder:ID])?
        ('status' status=Status)?
        ('vendor' vendor=STRING)?
        ('sla' sla=STRING)?
        ('integrations' integrations+=[Infrastructure:ID]* )?
        ('securityControls' '{' securityControls+=SecurityControl+ '}')?
    '}';

InfrastructureType returns string:
    'application' | 'database' | 'network' | 'api' | 'content-service' | 'hosting' | 'cloud' | 'server';

SecurityControl:
    'control' name=ID '{'
        ('description' description=STRING)?
        ('type' type=SecurityControlType)?
        ('status' status=Status)?
    '}';

SecurityControlType returns string:
    'access-control' | 'encryption' | 'monitoring' | 'backup' | 'authentication' | 'authorization' | 'audit';

// ═══════════════════════════════════════════════════════════════════════════════
// MATURITY ASSESSMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Maturity assessment across the seven IGIM areas.
 */
MaturityAssessment:
    'assessment' name=ID '{'
        ('date' date=STRING)?
        ('assessor' assessor=[Stakeholder:ID])?
        ('overallMaturity' overallMaturity=MaturityLevel)?
        ('ratings' '{'
            ('steeringCommittee' steeringCommitteeRating=MaturityLevel)?
            ('authorities' authoritiesRating=MaturityLevel)?
            ('supports' supportsRating=MaturityLevel)?
            ('processes' processesRating=MaturityLevel)?
            ('capabilities' capabilitiesRating=MaturityLevel)?
            ('structures' structuresRating=MaturityLevel)?
            ('infrastructure' infrastructureRating=MaturityLevel)?
        '}')?
        ('findings' '{' findings+=Finding+ '}')?
    '}';

Finding:
    'finding' name=ID '{'
        ('area' area=IGArea)?
        ('description' description=STRING)?
        ('recommendation' recommendation=STRING)?
        ('priority' priority=Priority)?
    '}';

IGArea returns string:
    'steering-committee' | 'authorities' | 'supports' | 'processes' | 'capabilities' | 'structures' | 'infrastructure';

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED ENUMERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

MaturityLevel returns string:
    'initial' | 'developing' | 'defined' | 'managed' | 'optimizing';

Status returns string:
    'planned' | 'in-progress' | 'implemented' | 'operational' | 'retired';

Priority returns string:
    'critical' | 'high' | 'medium' | 'low';

Frequency returns string:
    'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually' | 'as-needed';

// ═══════════════════════════════════════════════════════════════════════════════
// TERMINALS
// ═══════════════════════════════════════════════════════════════════════════════

hidden terminal WS: /\s+/;
hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;

terminal ID: /[_a-zA-Z][\w_-]*/;
terminal STRING: /"[^"]*"|'[^']*'/;
terminal INT returns number: /[0-9]+/;
