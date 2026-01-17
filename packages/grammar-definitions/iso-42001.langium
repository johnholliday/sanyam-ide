/**
 * ISO 42001 Assessment DSL
 * ========================
 * A domain-specific language for building, documenting, and managing
 * ISO/IEC 42001:2023 AI Management System (AIMS) assessments.
 * 
 * Version: 1.0.0
 * Standard Reference: ISO/IEC 42001:2023
 */

grammar ISO42001

// =============================================================================
// ENTRY POINT
// =============================================================================

entry AssessmentModel:
    (imports+=Import)*
    (elements+=ModelElement)*;

// =============================================================================
// IMPORTS AND REFERENCES
// =============================================================================

Import:
    'import' importedNamespace=QualifiedNameWithWildcard;

QualifiedName returns string:
    ID ('.' ID)*;

QualifiedNameWithWildcard returns string:
    QualifiedName ('.*')?;

// =============================================================================
// MODEL ELEMENTS
// =============================================================================

ModelElement:
    Organization
    | AIManagementSystem
    | AISystem
    | StakeholderRegistry
    | ControlCatalog
    | RiskRegistry
    | ImpactAssessment
    | AuditProgram
    | StatementOfApplicability
    | DocumentRegistry
    | ImprovementPlan
    | DataInventory
    | SupplierRegistry
    | IncidentRegistry
    | ManagementReview;

// =============================================================================
// ORGANIZATION CONTEXT (Clause 4)
// =============================================================================

Organization:
    'organization' name=ID '{'
        ('description' description=STRING)?
        ('industry' industry=IndustrySector)?
        ('size' size=OrganizationSize)?
        ('locations' '{' locations+=Location (',' locations+=Location)* '}')?
        
        // 4.1 Understanding the organization and its context
        ('context' '{'
            ('internal' '{' internalIssues+=ContextIssue* '}')?
            ('external' '{' externalIssues+=ContextIssue* '}')?
        '}')?
        
        // 4.2 Understanding needs and expectations of interested parties
        ('stakeholders' '{' stakeholders+=StakeholderReference* '}')?
        
        // AI-specific organizational roles
        ('aiRoles' '{' aiRoles+=AIRole* '}')?
        
        // Integration with other management systems
        ('managementSystems' '{' managementSystems+=ManagementSystemIntegration* '}')?
    '}';

Location:
    name=ID (',' country=STRING)? (',' region=STRING)?;

ContextIssue:
    'issue' name=ID '{'
        'description' description=STRING
        ('category' category=ContextCategory)?
        ('relevance' relevance=RelevanceLevel)?
        ('aiImplications' aiImplications=STRING)?
    '}';

AIRole:
    'role' name=ID '{'
        'title' title=STRING
        ('responsibilities' '{' responsibilities+=STRING (',' responsibilities+=STRING)* '}')?
        ('authority' authority=STRING)?
        ('competencies' '{' competencies+=Competency* '}')?
        ('assignedTo' assignedTo=STRING)?
    '}';

Competency:
    name=ID ':' level=CompetencyLevel;

ManagementSystemIntegration:
    'integration' standard=ManagementStandard '{'
        ('status' status=IntegrationStatus)?
        ('sharedElements' '{' sharedElements+=STRING (',' sharedElements+=STRING)* '}')?
        ('gapAnalysis' gapAnalysis=STRING)?
    '}';

// =============================================================================
// AI MANAGEMENT SYSTEM (AIMS) - Clause 4.3, 4.4
// =============================================================================

AIManagementSystem:
    'aims' name=ID '{'
        'version' version=STRING
        ('effectiveDate' effectiveDate=DATE)?
        ('organization' organization=[Organization])?
        
        // 4.3 Scope
        ('scope' '{'
            'description' scopeDescription=STRING
            ('boundaries' '{' boundaries+=ScopeBoundary* '}')?
            ('exclusions' '{' exclusions+=ScopeExclusion* '}')?
            ('aiSystems' '{' aiSystemRefs+=[AISystem] (',' aiSystemRefs+=[AISystem])* '}')?
        '}')?
        
        // 5.2 AI Policy
        ('policy' '{'
            'statement' policyStatement=STRING
            ('principles' '{' principles+=AIPrinciple* '}')?
            ('commitments' '{' commitments+=STRING (',' commitments+=STRING)* '}')?
            ('approvedBy' approvedBy=STRING)?
            ('approvalDate' approvalDate=DATE)?
            ('reviewDate' reviewDate=DATE)?
        '}')?
        
        // 6.2 AI Objectives
        ('objectives' '{' objectives+=AIObjective* '}')?
        
        // Documented information references
        ('documents' '{' documentRefs+=[Document] (',' documentRefs+=[Document])* '}')?
    '}';

ScopeBoundary:
    'boundary' name=ID '{'
        'type' type=BoundaryType
        'description' description=STRING
    '}';

ScopeExclusion:
    'exclusion' name=ID '{'
        'description' description=STRING
        'justification' justification=STRING
    '}';

AIPrinciple:
    'principle' name=ID '{'
        'description' description=STRING
        ('category' category=PrincipleCategory)?
        ('implementation' implementation=STRING)?
    '}';

AIObjective:
    'objective' name=ID '{'
        'description' description=STRING
        ('target' target=STRING)?
        ('metric' metric=STRING)?
        ('baseline' baseline=STRING)?
        ('deadline' deadline=DATE)?
        ('owner' owner=STRING)?
        ('status' status=ObjectiveStatus)?
        ('relatedControls' '{' controlRefs+=[Control] (',' controlRefs+=[Control])* '}')?
    '}';

// =============================================================================
// AI SYSTEM INVENTORY (Clause 4.4, Annex A.4)
// =============================================================================

AISystem:
    'aiSystem' name=ID '{'
        'description' description=STRING
        ('version' version=STRING)?
        ('status' status=SystemStatus)?
        
        // Classification
        ('classification' '{'
            ('type' type=AISystemType)?
            ('riskLevel' riskLevel=RiskLevel)?
            ('autonomyLevel' autonomyLevel=AutonomyLevel)?
            ('mlApproach' mlApproach=MLApproach)?
            ('euAiActCategory' euAiActCategory=EUAIActCategory)?
        '}')?
        
        // System details (A.4.2)
        ('components' '{' components+=AIComponent* '}')?
        
        // Data resources (A.4.3, A.7)
        ('dataResources' '{' dataResources+=DataResource* '}')?
        
        // Tooling (A.4.4)
        ('tooling' '{' tools+=Tool* '}')?
        
        // Computing resources (A.4.5)
        ('computing' '{'
            ('infrastructure' infrastructure=STRING)?
            ('requirements' requirements=STRING)?
        '}')?
        
        // Human resources (A.4.6)
        ('team' '{' teamMembers+=TeamMember* '}')?
        
        // Purpose and use
        ('purpose' '{'
            'intendedUse' intendedUse=STRING
            ('foreseeableMisuse' foreseeableMisuse=STRING)?
            ('beneficiaries' '{' beneficiaries+=STRING (',' beneficiaries+=STRING)* '}')?
            ('affectedParties' '{' affectedParties+=STRING (',' affectedParties+=STRING)* '}')?
        '}')?
        
        // Lifecycle stage (A.6)
        ('lifecycle' '{'
            'stage' lifecycleStage=LifecycleStage
            ('deploymentDate' deploymentDate=DATE)?
            ('retirementDate' retirementDate=DATE)?
        '}')?
        
        // Third-party relationships (A.10)
        ('suppliers' '{' suppliers+=[Supplier] (',' suppliers+=[Supplier])* '}')?
        
        // Related assessments
        ('impactAssessments' '{' impactAssessmentRefs+=[ImpactAssessment] (',' impactAssessmentRefs+=[ImpactAssessment])* '}')?
    '}';

AIComponent:
    'component' name=ID '{'
        'type' type=ComponentType
        ('description' description=STRING)?
        ('version' version=STRING)?
        ('provider' provider=STRING)?
        ('license' license=STRING)?
    '}';

DataResource:
    'data' name=ID '{'
        'category' category=DataCategory
        ('description' description=STRING)?
        ('source' source=STRING)?
        ('provenance' provenance=STRING)?
        ('quality' quality=DataQuality)?
        ('sensitivity' sensitivity=DataSensitivity)?
        ('volume' volume=STRING)?
        ('updateFrequency' updateFrequency=STRING)?
        ('retentionPeriod' retentionPeriod=STRING)?
        ('biasAssessment' biasAssessment=STRING)?
    '}';

Tool:
    'tool' name=ID '{'
        'purpose' purpose=STRING
        ('version' version=STRING)?
        ('provider' provider=STRING)?
    '}';

TeamMember:
    'member' name=ID '{'
        'role' role=STRING
        ('responsibilities' responsibilities=STRING)?
        ('competencies' '{' competencies+=STRING (',' competencies+=STRING)* '}')?
    '}';

// =============================================================================
// STAKEHOLDER REGISTRY (Clause 4.2)
// =============================================================================

StakeholderRegistry:
    'stakeholderRegistry' name=ID '{'
        ('description' description=STRING)?
        stakeholders+=Stakeholder*
    '}';

Stakeholder:
    'stakeholder' name=ID '{'
        'type' type=StakeholderType
        ('description' description=STRING)?
        ('needs' '{' needs+=StakeholderNeed* '}')?
        ('expectations' '{' expectations+=StakeholderExpectation* '}')?
        ('influence' influence=InfluenceLevel)?
        ('interest' interest=InterestLevel)?
        ('communication' '{'
            ('method' method=STRING)?
            ('frequency' frequency=STRING)?
            ('responsible' responsible=STRING)?
        '}')?
    '}';

StakeholderNeed:
    name=ID ':' description=STRING (addressed?='[X]')?;

StakeholderExpectation:
    name=ID ':' description=STRING (met?='[X]')?;

StakeholderReference:
    'ref' stakeholder=[Stakeholder];

// =============================================================================
// CONTROL CATALOG (Annex A - 39 Controls)
// =============================================================================

ControlCatalog:
    'controlCatalog' name=ID '{'
        ('description' description=STRING)?
        ('version' version=STRING)?
        ('basedOn' basedOn=STRING)?
        controlFamilies+=ControlFamily*
    '}';

ControlFamily:
    'family' name=ID '{'
        'title' title=STRING
        ('description' description=STRING)?
        controls+=Control*
    '}';

Control:
    'control' name=ID '{'
        'title' title=STRING
        'objective' objective=STRING
        ('description' description=STRING)?
        ('guidance' guidance=STRING)?
        
        // Implementation details
        ('implementation' '{'
            'status' status=ImplementationStatus
            ('method' method=STRING)?
            ('description' implementationDesc=STRING)?
            ('owner' owner=STRING)?
            ('dueDate' dueDate=DATE)?
            ('completedDate' completedDate=DATE)?
        '}')?
        
        // Evidence
        ('evidence' '{' evidence+=Evidence* '}')?
        
        // Testing/Verification
        ('verification' '{'
            ('method' verificationMethod=STRING)?
            ('frequency' verificationFrequency=STRING)?
            ('lastVerified' lastVerified=DATE)?
            ('result' verificationResult=VerificationResult)?
            ('notes' verificationNotes=STRING)?
        '}')?
        
        // Maturity assessment
        ('maturity' maturity=MaturityLevel)?
        
        // Related risks
        ('mitigates' '{' mitigatedRisks+=[Risk] (',' mitigatedRisks+=[Risk])* '}')?
        
        // Cross-references
        ('mappings' '{' mappings+=ControlMapping* '}')?
    '}';

Evidence:
    'evidence' name=ID '{'
        'type' type=EvidenceType
        'description' description=STRING
        ('location' location=STRING)?
        ('collectedDate' collectedDate=DATE)?
        ('collectedBy' collectedBy=STRING)?
        ('validity' validity=EvidenceValidity)?
    '}';

ControlMapping:
    'maps' framework=STRING ':' reference=STRING;

// =============================================================================
// RISK REGISTRY (Clause 6.1, Annex C)
// =============================================================================

RiskRegistry:
    'riskRegistry' name=ID '{'
        ('description' description=STRING)?
        ('methodology' methodology=STRING)?
        ('lastReviewDate' lastReviewDate=DATE)?
        ('nextReviewDate' nextReviewDate=DATE)?
        risks+=Risk*
        ('riskCategories' '{' categories+=RiskCategoryDef* '}')?
    '}';

Risk:
    'risk' name=ID '{'
        'description' description=STRING
        ('category' category=AIRiskCategory)?
        ('source' source=AIRiskSource)?
        
        // Risk assessment
        ('assessment' '{'
            ('likelihood' likelihood=LikelihoodLevel)?
            ('impact' impact=ImpactLevel)?
            ('inherentRisk' inherentRisk=RiskRating)?
            ('residualRisk' residualRisk=RiskRating)?
            ('trend' trend=RiskTrend)?
        '}')?
        
        // Related AI systems
        ('affectedSystems' '{' affectedSystems+=[AISystem] (',' affectedSystems+=[AISystem])* '}')?
        
        // Risk treatment (Clause 6.1.3)
        ('treatment' '{'
            'strategy' strategy=TreatmentStrategy
            ('description' treatmentDesc=STRING)?
            ('controls' '{' controlRefs+=[Control] (',' controlRefs+=[Control])* '}')?
            ('owner' owner=STRING)?
            ('dueDate' dueDate=DATE)?
            ('status' status=TreatmentStatus)?
        '}')?
        
        // Monitoring
        ('monitoring' '{'
            ('indicators' '{' indicators+=RiskIndicator* '}')?
            ('frequency' frequency=STRING)?
        '}')?
    '}';

RiskCategoryDef:
    'category' name=ID '{'
        'description' description=STRING
    '}';

RiskIndicator:
    'indicator' name=ID '{'
        'description' description=STRING
        ('threshold' threshold=STRING)?
        ('currentValue' currentValue=STRING)?
        ('status' status=IndicatorStatus)?
    '}';

// =============================================================================
// AI SYSTEM IMPACT ASSESSMENT (Clause 8.4, Annex A.5)
// =============================================================================

ImpactAssessment:
    'impactAssessment' name=ID '{'
        'aiSystem' aiSystem=[AISystem]
        'assessmentDate' assessmentDate=DATE
        ('version' version=STRING)?
        ('assessor' assessor=STRING)?
        ('reviewer' reviewer=STRING)?
        ('approver' approver=STRING)?
        ('status' status=AssessmentStatus)?
        
        // A.5.2 - Impact Assessment Process
        ('methodology' methodology=STRING)?
        
        // Intended use and context
        ('context' '{'
            'intendedUse' intendedUse=STRING
            ('operationalContext' operationalContext=STRING)?
            ('foreseeableMisuse' foreseeableMisuse=STRING)?
        '}')?
        
        // A.5.4 - Individual impacts
        ('individualImpacts' '{' individualImpacts+=IndividualImpact* '}')?
        
        // A.5.5 - Societal impacts
        ('societalImpacts' '{' societalImpacts+=SocietalImpact* '}')?
        
        // Environmental impacts
        ('environmentalImpacts' '{' environmentalImpacts+=EnvironmentalImpact* '}')?
        
        // Positive impacts (opportunities)
        ('benefits' '{' benefits+=Benefit* '}')?
        
        // Mitigation measures
        ('mitigations' '{' mitigations+=ImpactMitigation* '}')?
        
        // Conclusions
        ('conclusion' '{'
            'summary' summary=STRING
            ('recommendation' recommendation=STRING)?
            ('overallRiskLevel' overallRiskLevel=RiskLevel)?
            ('decision' decision=AssessmentDecision)?
        '}')?
        
        // Review schedule
        ('nextReview' nextReviewDate=DATE)?
    '}';

IndividualImpact:
    'impact' name=ID '{'
        'description' description=STRING
        ('affectedGroups' '{' affectedGroups+=STRING (',' affectedGroups+=STRING)* '}')?
        ('type' type=IndividualImpactType)?
        ('severity' severity=ImpactSeverity)?
        ('likelihood' likelihood=LikelihoodLevel)?
        ('reversibility' reversibility=Reversibility)?
    '}';

SocietalImpact:
    'impact' name=ID '{'
        'description' description=STRING
        ('type' type=SocietalImpactType)?
        ('severity' severity=ImpactSeverity)?
        ('scale' scale=ImpactScale)?
    '}';

EnvironmentalImpact:
    'impact' name=ID '{'
        'description' description=STRING
        ('type' type=EnvironmentalImpactType)?
        ('severity' severity=ImpactSeverity)?
    '}';

Benefit:
    'benefit' name=ID '{'
        'description' description=STRING
        ('beneficiaries' '{' beneficiaries+=STRING (',' beneficiaries+=STRING)* '}')?
        ('significance' significance=ImpactSeverity)?
    '}';

ImpactMitigation:
    'mitigation' name=ID '{'
        'impact' impact=STRING
        'measure' measure=STRING
        ('effectiveness' effectiveness=MitigationEffectiveness)?
        ('status' status=MitigationStatus)?
        ('owner' owner=STRING)?
    '}';

// =============================================================================
// AUDIT PROGRAM (Clause 9.2)
// =============================================================================

AuditProgram:
    'auditProgram' name=ID '{'
        ('description' description=STRING)?
        ('year' year=INT)?
        ('objectives' objectives=STRING)?
        audits+=Audit*
    '}';

Audit:
    'audit' name=ID '{'
        'type' type=AuditType
        ('scope' scope=STRING)?
        ('criteria' criteria=STRING)?
        ('plannedDate' plannedDate=DATE)?
        ('actualDate' actualDate=DATE)?
        ('leadAuditor' leadAuditor=STRING)?
        ('auditTeam' '{' auditTeam+=STRING (',' auditTeam+=STRING)* '}')?
        ('status' status=AuditStatus)?
        
        // Audit findings
        ('findings' '{' findings+=AuditFinding* '}')?
        
        // Audit conclusion
        ('conclusion' '{'
            ('summary' summary=STRING)?
            ('conformityLevel' conformityLevel=ConformityLevel)?
            ('recommendations' '{' recommendations+=STRING (',' recommendations+=STRING)* '}')?
        '}')?
    '}';

AuditFinding:
    'finding' name=ID '{'
        'type' type=FindingType
        'description' description=STRING
        ('clause' clause=STRING)?
        ('control' control=[Control])?
        ('evidence' evidence=STRING)?
        ('rootCause' rootCause=STRING)?
        
        // Corrective action
        ('correctiveAction' '{'
            'description' actionDescription=STRING
            ('owner' owner=STRING)?
            ('dueDate' dueDate=DATE)?
            ('completedDate' completedDate=DATE)?
            ('status' actionStatus=CorrectiveActionStatus)?
            ('verification' verification=STRING)?
        '}')?
    '}';

// =============================================================================
// STATEMENT OF APPLICABILITY (SOA)
// =============================================================================

StatementOfApplicability:
    'soa' name=ID '{'
        ('version' version=STRING)?
        ('date' date=DATE)?
        ('approvedBy' approvedBy=STRING)?
        ('aimsRef' aimsRef=[AIManagementSystem])?
        
        controlDeclarations+=ControlDeclaration*
    '}';

ControlDeclaration:
    'declare' control=[Control] '{'
        'applicable' applicable=BOOLEAN
        ('justification' justification=STRING)?
        ('implementationNotes' implementationNotes=STRING)?
    '}';

// =============================================================================
// DOCUMENT REGISTRY (Clause 7.5)
// =============================================================================

DocumentRegistry:
    'documentRegistry' name=ID '{'
        ('description' description=STRING)?
        documents+=Document*
    '}';

Document:
    'document' name=ID '{'
        'title' title=STRING
        'type' type=DocumentType
        ('version' version=STRING)?
        ('status' status=DocumentStatus)?
        ('owner' owner=STRING)?
        ('createdDate' createdDate=DATE)?
        ('lastReviewDate' lastReviewDate=DATE)?
        ('nextReviewDate' nextReviewDate=DATE)?
        ('location' location=STRING)?
        ('classification' classification=DataSensitivity)?
        ('retentionPeriod' retentionPeriod=STRING)?
        ('relatedControls' '{' controlRefs+=[Control] (',' controlRefs+=[Control])* '}')?
    '}';

// =============================================================================
// IMPROVEMENT PLAN (Clause 10)
// =============================================================================

ImprovementPlan:
    'improvementPlan' name=ID '{'
        ('description' description=STRING)?
        ('period' '{'
            ('startDate' startDate=DATE)?
            ('endDate' endDate=DATE)?
        '}')?
        
        // Nonconformities and corrective actions (10.1, 10.2)
        ('nonconformities' '{' nonconformities+=Nonconformity* '}')?
        
        // Continual improvement initiatives (10.3)
        ('initiatives' '{' initiatives+=ImprovementInitiative* '}')?
    '}';

Nonconformity:
    'nonconformity' name=ID '{'
        'description' description=STRING
        ('source' source=NonconformitySource)?
        ('detectedDate' detectedDate=DATE)?
        ('clause' clause=STRING)?
        ('rootCauseAnalysis' rootCauseAnalysis=STRING)?
        
        ('immediateAction' '{'
            ('description' immediateDesc=STRING)?
            ('completedDate' immediateCompletedDate=DATE)?
        '}')?
        
        ('correctiveAction' '{'
            'description' correctiveDesc=STRING
            ('owner' owner=STRING)?
            ('dueDate' dueDate=DATE)?
            ('completedDate' completedDate=DATE)?
            ('status' status=CorrectiveActionStatus)?
        '}')?
        
        ('verification' '{'
            ('method' verificationMethod=STRING)?
            ('date' verificationDate=DATE)?
            ('result' verificationResult=VerificationResult)?
            ('evidence' verificationEvidence=STRING)?
        '}')?
        
        ('preventiveAction' preventiveAction=STRING)?
    '}';

ImprovementInitiative:
    'initiative' name=ID '{'
        'title' title=STRING
        'description' description=STRING
        ('type' type=InitiativeType)?
        ('priority' priority=PriorityLevel)?
        ('owner' owner=STRING)?
        ('startDate' startDate=DATE)?
        ('targetDate' targetDate=DATE)?
        ('status' status=InitiativeStatus)?
        ('expectedBenefits' expectedBenefits=STRING)?
        ('actualBenefits' actualBenefits=STRING)?
        ('resources' resources=STRING)?
        ('relatedObjectives' '{' objectiveRefs+=[AIObjective] (',' objectiveRefs+=[AIObjective])* '}')?
    '}';

// =============================================================================
// DATA INVENTORY (Extended A.7)
// =============================================================================

DataInventory:
    'dataInventory' name=ID '{'
        ('description' description=STRING)?
        datasets+=Dataset*
    '}';

Dataset:
    'dataset' name=ID '{'
        'description' description=STRING
        'purpose' purpose=DataPurpose
        
        // A.7.3 - Acquisition
        ('acquisition' '{'
            'source' source=STRING
            ('method' method=STRING)?
            ('legalBasis' legalBasis=LegalBasis)?
            ('consentObtained' consentObtained?='[X]')?
            ('thirdPartyProvider' thirdPartyProvider=STRING)?
        '}')?
        
        // A.7.4 - Quality
        ('quality' '{'
            ('completeness' completeness=QualityRating)?
            ('accuracy' accuracy=QualityRating)?
            ('consistency' consistency=QualityRating)?
            ('timeliness' timeliness=QualityRating)?
            ('overallRating' overallRating=DataQuality)?
            ('issues' '{' issues+=STRING (',' issues+=STRING)* '}')?
        '}')?
        
        // A.7.5 - Provenance
        ('provenance' '{'
            ('origin' origin=STRING)?
            ('transformations' '{' transformations+=STRING (',' transformations+=STRING)* '}')?
            ('lineage' lineage=STRING)?
        '}')?
        
        // A.7.6 - Preparation
        ('preparation' '{'
            ('methods' '{' methods+=STRING (',' methods+=STRING)* '}')?
            ('labeling' labeling=STRING)?
            ('augmentation' augmentation=STRING)?
        '}')?
        
        // Bias assessment
        ('biasAssessment' '{'
            ('assessed' assessed?='[X]')?
            ('findings' findings=STRING)?
            ('mitigations' mitigations=STRING)?
        '}')?
        
        // Used by which AI systems
        ('usedBy' '{' aiSystemRefs+=[AISystem] (',' aiSystemRefs+=[AISystem])* '}')?
    '}';

// =============================================================================
// SUPPLIER REGISTRY (A.10.3)
// =============================================================================

SupplierRegistry:
    'supplierRegistry' name=ID '{'
        ('description' description=STRING)?
        suppliers+=Supplier*
    '}';

Supplier:
    'supplier' name=ID '{'
        'companyName' companyName=STRING
        ('type' type=SupplierType)?
        ('services' '{' services+=STRING (',' services+=STRING)* '}')?
        ('criticality' criticality=CriticalityLevel)?
        ('riskLevel' riskLevel=RiskRating)?
        
        // AI-specific due diligence
        ('dueDiligence' '{'
            ('aiPoliciesReviewed' aiPoliciesReviewed?='[X]')?
            ('securityAssessed' securityAssessed?='[X]')?
            ('ethicsReviewed' ethicsReviewed?='[X]')?
            ('complianceVerified' complianceVerified?='[X]')?
            ('certifications' '{' certifications+=STRING (',' certifications+=STRING)* '}')?
            ('lastReviewDate' lastReviewDate=DATE)?
            ('nextReviewDate' nextReviewDate=DATE)?
        '}')?
        
        // Contractual requirements
        ('contract' '{'
            ('startDate' startDate=DATE)?
            ('endDate' endDate=DATE)?
            ('aiRequirements' aiRequirements=STRING)?
            ('dataProtectionClause' dataProtectionClause?='[X]')?
            ('auditRights' auditRights?='[X]')?
            ('incidentNotification' incidentNotification?='[X]')?
        '}')?
        
        // Ongoing monitoring
        ('monitoring' '{'
            ('performanceRating' performanceRating=QualityRating)?
            ('issues' '{' issues+=SupplierIssue* '}')?
        '}')?
    '}';

SupplierIssue:
    'issue' name=ID '{'
        'description' description=STRING
        ('reportedDate' reportedDate=DATE)?
        ('resolvedDate' resolvedDate=DATE)?
        ('status' status=IssueStatus)?
    '}';

// =============================================================================
// MANAGEMENT REVIEW (Clause 9.3)
// =============================================================================

ManagementReview:
    'managementReview' name=ID '{'
        'date' date=DATE
        ('participants' '{' participants+=STRING (',' participants+=STRING)* '}')?
        ('chairperson' chairperson=STRING)?
        
        // Input items (9.3.2)
        ('inputs' '{'
            ('previousActionsStatus' previousActionsStatus=STRING)?
            ('aimsPerformance' aimsPerformance=STRING)?
            ('auditResults' auditResults=STRING)?
            ('nonconformities' nonconformities=STRING)?
            ('monitoringResults' monitoringResults=STRING)?
            ('stakeholderFeedback' stakeholderFeedback=STRING)?
            ('riskAssessmentResults' riskAssessmentResults=STRING)?
            ('opportunitiesForImprovement' opportunitiesForImprovement=STRING)?
            ('changesAffectingAIMS' changesAffectingAIMS=STRING)?
            ('resourceAdequacy' resourceAdequacy=STRING)?
        '}')?
        
        // Output items (9.3.3)
        ('outputs' '{'
            decisions+=ManagementDecision*
        '}')?
        
        ('nextReviewDate' nextReviewDate=DATE)?
    '}';

ManagementDecision:
    'decision' name=ID '{'
        'description' description=STRING
        ('type' type=DecisionType)?
        ('action' action=STRING)?
        ('owner' owner=STRING)?
        ('dueDate' dueDate=DATE)?
        ('status' status=DecisionStatus)?
    '}';

// =============================================================================
// INCIDENT MANAGEMENT (A.8.4)
// =============================================================================

IncidentRegistry:
    'incidentRegistry' name=ID '{'
        ('description' description=STRING)?
        incidents+=AIIncident*
    '}';

AIIncident:
    'incident' name=ID '{'
        'description' description=STRING
        'detectedDate' detectedDate=DATE
        ('reportedBy' reportedBy=STRING)?
        ('affectedSystem' affectedSystem=[AISystem])?
        ('severity' severity=IncidentSeverity)?
        ('status' status=IncidentStatus)?
        
        // Classification
        ('classification' '{'
            ('type' type=IncidentType)?
            ('rootCause' rootCause=IncidentRootCause)?
        '}')?
        
        // Impact
        ('impact' '{'
            ('description' impactDesc=STRING)?
            ('affectedUsers' affectedUsers=INT)?
            ('businessImpact' businessImpact=STRING)?
        '}')?
        
        // Response
        ('response' '{'
            ('immediateActions' immediateActions=STRING)?
            ('containment' containment=STRING)?
            ('resolvedDate' resolvedDate=DATE)?
            ('lessonLearned' lessonLearned=STRING)?
        '}')?
        
        // Communication (A.8.4)
        ('communication' '{'
            ('internalNotified' internalNotified?='[X]')?
            ('usersNotified' usersNotified?='[X]')?
            ('regulatorsNotified' regulatorsNotified?='[X]')?
            ('communicationRecord' communicationRecord=STRING)?
        '}')?
    '}';

// =============================================================================
// DATA TYPE RULES (Enumerations)
// =============================================================================

// Context and Organization
ContextCategory returns string:
    'LEGAL' | 'REGULATORY' | 'TECHNOLOGICAL' | 'COMPETITIVE' | 
    'CULTURAL' | 'SOCIAL' | 'ECONOMIC' | 'ENVIRONMENTAL' | 
    'ETHICAL' | 'ORGANIZATIONAL' | 'CONTRACTUAL';

RelevanceLevel returns string:
    'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

IndustrySector returns string:
    'HEALTHCARE' | 'FINANCE' | 'MANUFACTURING' | 'RETAIL' | 
    'TECHNOLOGY' | 'GOVERNMENT' | 'EDUCATION' | 'TRANSPORTATION' |
    'ENERGY' | 'TELECOMMUNICATIONS' | 'MEDIA' | 'PROFESSIONAL_SERVICES' |
    'OTHER';

OrganizationSize returns string:
    'STARTUP' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE';

CompetencyLevel returns string:
    'AWARENESS' | 'BASIC' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';

ManagementStandard returns string:
    'ISO_27001' | 'ISO_27701' | 'ISO_9001' | 'ISO_14001' | 'ISO_22301' | 
    'ISO_31000' | 'SOC2' | 'NIST_AI_RMF' | 'EU_AI_ACT' | 'OTHER';

IntegrationStatus returns string:
    'NOT_STARTED' | 'PLANNED' | 'IN_PROGRESS' | 'INTEGRATED' | 'CERTIFIED';

// Scope and Policy
BoundaryType returns string:
    'GEOGRAPHICAL' | 'FUNCTIONAL' | 'TECHNICAL' | 'ORGANIZATIONAL' | 
    'PROCESS' | 'PRODUCT' | 'SERVICE';

PrincipleCategory returns string:
    'ACCOUNTABILITY' | 'TRANSPARENCY' | 'EXPLAINABILITY' | 'FAIRNESS' |
    'PRIVACY' | 'SAFETY' | 'SECURITY' | 'ROBUSTNESS' | 
    'HUMAN_OVERSIGHT' | 'SUSTAINABILITY' | 'RELIABILITY';

ObjectiveStatus returns string:
    'NOT_STARTED' | 'IN_PROGRESS' | 'ACHIEVED' | 'NOT_ACHIEVED' | 'DEFERRED';

// AI System Classification
SystemStatus returns string:
    'CONCEPT' | 'DEVELOPMENT' | 'TESTING' | 'PILOT' | 'PRODUCTION' | 
    'MAINTENANCE' | 'DEPRECATED' | 'RETIRED';

AISystemType returns string:
    'MACHINE_LEARNING' | 'DEEP_LEARNING' | 'NATURAL_LANGUAGE_PROCESSING' |
    'COMPUTER_VISION' | 'ROBOTICS' | 'EXPERT_SYSTEM' | 
    'GENERATIVE_AI' | 'REINFORCEMENT_LEARNING' | 'HYBRID' | 'OTHER';

RiskLevel returns string:
    'MINIMAL' | 'LIMITED' | 'HIGH' | 'UNACCEPTABLE';

AutonomyLevel returns string:
    'HUMAN_IN_THE_LOOP' | 'HUMAN_ON_THE_LOOP' | 'HUMAN_OUT_OF_THE_LOOP' | 'FULLY_AUTONOMOUS';

MLApproach returns string:
    'SUPERVISED' | 'UNSUPERVISED' | 'SEMI_SUPERVISED' | 
    'REINFORCEMENT' | 'TRANSFER_LEARNING' | 'FEDERATED' | 'OTHER';

EUAIActCategory returns string:
    'PROHIBITED' | 'HIGH_RISK' | 'LIMITED_RISK' | 'MINIMAL_RISK' | 'GPAI' | 'NOT_APPLICABLE';

LifecycleStage returns string:
    'DESIGN' | 'DEVELOPMENT' | 'VERIFICATION' | 'VALIDATION' |
    'DEPLOYMENT' | 'OPERATION' | 'MONITORING' | 'RETIREMENT';

ComponentType returns string:
    'MODEL' | 'FRAMEWORK' | 'LIBRARY' | 'API' | 'DATASET' | 
    'INFRASTRUCTURE' | 'UI' | 'INTEGRATION' | 'OTHER';

// Data
DataCategory returns string:
    'TRAINING' | 'VALIDATION' | 'TEST' | 'PRODUCTION' | 
    'SYNTHETIC' | 'AUGMENTED' | 'LABELED' | 'UNLABELED';

DataQuality returns string:
    'UNASSESSED' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CERTIFIED';

DataSensitivity returns string:
    'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED' | 
    'PERSONAL' | 'SENSITIVE_PERSONAL' | 'SPECIAL_CATEGORY';

DataPurpose returns string:
    'TRAINING' | 'VALIDATION' | 'TESTING' | 'INFERENCE' | 
    'MONITORING' | 'FINE_TUNING' | 'OTHER';

LegalBasis returns string:
    'CONSENT' | 'CONTRACT' | 'LEGAL_OBLIGATION' | 'VITAL_INTERESTS' |
    'PUBLIC_TASK' | 'LEGITIMATE_INTERESTS' | 'NOT_APPLICABLE';

QualityRating returns string:
    'POOR' | 'FAIR' | 'GOOD' | 'EXCELLENT' | 'NOT_ASSESSED';

// Stakeholders
StakeholderType returns string:
    'CUSTOMER' | 'USER' | 'REGULATOR' | 'SHAREHOLDER' | 'EMPLOYEE' |
    'SUPPLIER' | 'PARTNER' | 'COMMUNITY' | 'MEDIA' | 'ADVOCACY_GROUP' |
    'AFFECTED_INDIVIDUAL' | 'DATA_SUBJECT' | 'AI_SYSTEM_OPERATOR' | 'OTHER';

InfluenceLevel returns string:
    'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

InterestLevel returns string:
    'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

// Controls
ImplementationStatus returns string:
    'NOT_APPLICABLE' | 'NOT_IMPLEMENTED' | 'PARTIALLY_IMPLEMENTED' | 
    'FULLY_IMPLEMENTED' | 'NOT_ASSESSED';

VerificationResult returns string:
    'NOT_TESTED' | 'PASSED' | 'FAILED' | 'PARTIALLY_PASSED' | 'INCONCLUSIVE';

MaturityLevel returns string:
    'INITIAL' | 'MANAGED' | 'DEFINED' | 'QUANTITATIVELY_MANAGED' | 'OPTIMIZING';

EvidenceType returns string:
    'POLICY' | 'PROCEDURE' | 'RECORD' | 'LOG' | 'SCREENSHOT' | 
    'CONFIGURATION' | 'INTERVIEW' | 'OBSERVATION' | 'TEST_RESULT' |
    'REPORT' | 'CERTIFICATE' | 'CONTRACT' | 'STANDARD' | 'OTHER';

EvidenceValidity returns string:
    'CURRENT' | 'EXPIRED' | 'PENDING_REVIEW' | 'SUPERSEDED';

// Risk
AIRiskCategory returns string:
    'TECHNICAL' | 'OPERATIONAL' | 'ETHICAL' | 'LEGAL_REGULATORY' |
    'REPUTATIONAL' | 'FINANCIAL' | 'STRATEGIC' | 'SAFETY' |
    'SECURITY' | 'PRIVACY' | 'ENVIRONMENTAL' | 'SOCIETAL';

AIRiskSource returns string:
    'ALGORITHM_BIAS' | 'DATA_QUALITY' | 'MODEL_DRIFT' | 
    'SYSTEM_COMPLEXITY' | 'LACK_OF_TRANSPARENCY' |
    'LEVEL_OF_AUTOMATION' | 'MACHINE_LEARNING_RISKS' |
    'SYSTEM_HARDWARE' | 'TECHNOLOGY_READINESS' |
    'HUMAN_ERROR' | 'SKILL_GAPS' | 'PROCESS_FAILURE' |
    'INTEGRATION_ISSUES' | 'SCALABILITY' |
    'REGULATORY_CHANGE' | 'MARKET_DYNAMICS' |
    'THIRD_PARTY_DEPENDENCY' | 'CYBER_THREATS' |
    'FAIRNESS_CONCERNS' | 'PRIVACY_VIOLATIONS' |
    'UNINTENDED_CONSEQUENCES' | 'MISUSE' | 'OTHER';

LikelihoodLevel returns string:
    'RARE' | 'UNLIKELY' | 'POSSIBLE' | 'LIKELY' | 'ALMOST_CERTAIN';

ImpactLevel returns string:
    'NEGLIGIBLE' | 'MINOR' | 'MODERATE' | 'MAJOR' | 'CATASTROPHIC';

RiskRating returns string:
    'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' | 'CRITICAL';

RiskTrend returns string:
    'DECREASING' | 'STABLE' | 'INCREASING';

TreatmentStrategy returns string:
    'AVOID' | 'MITIGATE' | 'TRANSFER' | 'ACCEPT';

TreatmentStatus returns string:
    'PLANNED' | 'IN_PROGRESS' | 'IMPLEMENTED' | 'VERIFIED' | 'CLOSED';

IndicatorStatus returns string:
    'NORMAL' | 'WARNING' | 'CRITICAL';

// Impact Assessment
AssessmentStatus returns string:
    'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'REQUIRES_UPDATE' | 'ARCHIVED';

AssessmentDecision returns string:
    'PROCEED' | 'PROCEED_WITH_CONDITIONS' | 'HALT' | 'FURTHER_ASSESSMENT_REQUIRED';

IndividualImpactType returns string:
    'PRIVACY' | 'AUTONOMY' | 'SAFETY' | 'DIGNITY' | 
    'DISCRIMINATION' | 'ACCESS' | 'FINANCIAL' | 'PSYCHOLOGICAL' |
    'EMPLOYMENT' | 'CIVIL_RIGHTS' | 'OTHER';

ImpactSeverity returns string:
    'NEGLIGIBLE' | 'MINOR' | 'MODERATE' | 'SIGNIFICANT' | 'SEVERE';

Reversibility returns string:
    'REVERSIBLE' | 'PARTIALLY_REVERSIBLE' | 'IRREVERSIBLE';

SocietalImpactType returns string:
    'DEMOCRATIC_PROCESSES' | 'SOCIAL_COHESION' | 'ECONOMIC_INEQUALITY' |
    'LABOR_MARKET' | 'PUBLIC_SAFETY' | 'CRITICAL_INFRASTRUCTURE' |
    'EDUCATION' | 'HEALTHCARE' | 'ENVIRONMENT' | 'CULTURAL' | 'OTHER';

ImpactScale returns string:
    'LOCAL' | 'REGIONAL' | 'NATIONAL' | 'GLOBAL';

EnvironmentalImpactType returns string:
    'ENERGY_CONSUMPTION' | 'CARBON_EMISSIONS' | 'E_WASTE' |
    'RESOURCE_DEPLETION' | 'WATER_USAGE' | 'OTHER';

MitigationEffectiveness returns string:
    'UNVERIFIED' | 'LOW' | 'MEDIUM' | 'HIGH';

MitigationStatus returns string:
    'PROPOSED' | 'APPROVED' | 'IMPLEMENTED' | 'VERIFIED';

// Audit
AuditType returns string:
    'INTERNAL' | 'EXTERNAL' | 'CERTIFICATION' | 'SURVEILLANCE' |
    'SUPPLIER' | 'CUSTOMER' | 'REGULATORY';

AuditStatus returns string:
    'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'POSTPONED';

ConformityLevel returns string:
    'FULL_CONFORMITY' | 'MINOR_NONCONFORMITIES' | 'MAJOR_NONCONFORMITIES';

FindingType returns string:
    'MAJOR_NC' | 'MINOR_NC' | 'OBSERVATION' | 'OPPORTUNITY' | 'STRENGTH';

CorrectiveActionStatus returns string:
    'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED' | 'CLOSED' | 'OVERDUE';

// Documents
DocumentType returns string:
    'POLICY' | 'PROCEDURE' | 'GUIDELINE' | 'STANDARD' | 
    'PLAN' | 'RECORD' | 'REPORT' | 'FORM' | 'TEMPLATE' |
    'TRAINING_MATERIAL' | 'SPECIFICATION' | 'CONTRACT' |
    'ASSESSMENT' | 'LOG' | 'OTHER';

DocumentStatus returns string:
    'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED' | 
    'UNDER_REVISION' | 'OBSOLETE' | 'ARCHIVED';

// Improvement
NonconformitySource returns string:
    'INTERNAL_AUDIT' | 'EXTERNAL_AUDIT' | 'INCIDENT' | 
    'COMPLAINT' | 'MANAGEMENT_REVIEW' | 'SELF_ASSESSMENT' |
    'REGULATORY' | 'CUSTOMER' | 'OTHER';

InitiativeType returns string:
    'PROCESS_IMPROVEMENT' | 'TECHNOLOGY_UPGRADE' | 'CAPABILITY_BUILDING' |
    'AUTOMATION' | 'INTEGRATION' | 'COMPLIANCE' | 'PERFORMANCE' | 'OTHER';

PriorityLevel returns string:
    'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

InitiativeStatus returns string:
    'PROPOSED' | 'APPROVED' | 'IN_PROGRESS' | 'ON_HOLD' | 
    'COMPLETED' | 'CANCELLED';

// Supplier
SupplierType returns string:
    'AI_MODEL_PROVIDER' | 'DATA_PROVIDER' | 'CLOUD_PROVIDER' |
    'HARDWARE_PROVIDER' | 'SOFTWARE_PROVIDER' | 'CONSULTING' |
    'TRAINING' | 'CERTIFICATION' | 'OTHER';

CriticalityLevel returns string:
    'NON_CRITICAL' | 'IMPORTANT' | 'CRITICAL' | 'ESSENTIAL';

IssueStatus returns string:
    'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'ESCALATED' | 'CLOSED';

// Management Review
DecisionType returns string:
    'IMPROVEMENT' | 'RESOURCE_ALLOCATION' | 'POLICY_CHANGE' |
    'OBJECTIVE_UPDATE' | 'RISK_TREATMENT' | 'OTHER';

DecisionStatus returns string:
    'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'DEFERRED' | 'CANCELLED';

// Incidents
IncidentSeverity returns string:
    'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

IncidentStatus returns string:
    'DETECTED' | 'TRIAGED' | 'INVESTIGATING' | 'CONTAINED' |
    'RESOLVED' | 'CLOSED' | 'POST_MORTEM';

IncidentType returns string:
    'BIAS_DETECTION' | 'MODEL_FAILURE' | 'DATA_BREACH' |
    'SAFETY_ISSUE' | 'SECURITY_BREACH' | 'AVAILABILITY' |
    'MISUSE' | 'UNINTENDED_BEHAVIOR' | 'PERFORMANCE_DEGRADATION' |
    'COMPLIANCE_VIOLATION' | 'OTHER';

IncidentRootCause returns string:
    'DATA_ISSUE' | 'MODEL_ISSUE' | 'CONFIGURATION_ERROR' |
    'INTEGRATION_FAILURE' | 'HUMAN_ERROR' | 'EXTERNAL_ATTACK' |
    'INFRASTRUCTURE' | 'THIRD_PARTY' | 'UNKNOWN';

// =============================================================================
// TERMINALS
// =============================================================================

terminal ID: /[_a-zA-Z][\w_]*/;
terminal STRING: /"[^"]*"|'[^']*'/;
terminal INT returns number: /[0-9]+/;
terminal DATE: /\d{4}-\d{2}-\d{2}/;
terminal BOOLEAN returns boolean: /true|false/;

hidden terminal WS: /\s+/;
hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
