// =============================================================================
// @name = "E C M L"
// @tagline = "Enteprise Content Modeling Language"
// @description = "A development environment for modeling enterprise content"
// =============================================================================
grammar Ecml

entry ContentModel:
    pragmas+=Pragma*
    statements+=Statement*
;

// -----------------------------------------------------------------------------
//  Pragmas (compiler / tool directives)
// -----------------------------------------------------------------------------
Pragma:
    TitlePragma | DescriptionPragma | AuthorPragma | CompanyPragma
    | CreatedPragma | UpdatedPragma | VersionPragma | CopyrightPragma | LicensePragma
;

TitlePragma:
    '#Title' (title=TEXT);
DescriptionPragma:
    '#Description' (description=TEXT);
AuthorPragma:
    '#Author' (author=TEXT);
CompanyPragma:
    '#Company' (company=TEXT);
CreatedPragma:
    '#Created' (created=TEXT);
UpdatedPragma:
    '#Updated' (updated=TEXT);
VersionPragma:
    '#Version' (version=TEXT);
CopyrightPragma:
    '#Copyright' (copyright=TEXT);
LicensePragma:
    '#License' (license=TEXT);

// -----------------------------------------------------------------------------
//  Statements
// -----------------------------------------------------------------------------
Statement:
    (Annotation // highest precedence
    | Actor
    | Activity
    | Task
    | Content
    | SecurityGroup
    | Permission
    | RetentionLabel
    | SensitivityLabel
    | Workflow
    ) SEMICOLON?
;

// -----------------------------------------------------------------------------
//  Core building blocks (re-usable fragments)
// -----------------------------------------------------------------------------

// Identifier allows keywords to be used as names (e.g., Activity Activity "...")
Identifier returns string:
    ID
    // Statement-level type keywords
    | 'Actor' | 'Activity' | 'Task' | 'Content'
    | 'SecurityGroup' | 'Permission' | 'RetentionLabel' | 'SensitivityLabel' | 'Workflow'
    // Workflow keywords
    | 'Do' | 'Repeat' | 'Until' | 'If'
    // Data type keywords
    | 'text' | 'integer' | 'decimal' | 'date' | 'boolean' | 'currency' | 'memo' | 'termset' | 'choice'
    // Attribute keywords
    | 'template' | 'format' | 'type' | 'schema'
    // Content format keywords
    | 'TXT' | 'DOCX' | 'CSV' | 'XLSX' | 'PDF' | 'MD' | 'JSON' | 'XML'
    // Content type keywords
    | 'Text' | 'Csv' | 'Excel' | 'Word' | 'PowerPoint' | 'Markdown' | 'Pdf'
    | 'Script' | 'Image' | 'Diagram' | 'Flowchart' | 'OrgChart' | 'Survey'
    // Boolean / status keywords
    | 'true' | 'false'
    | 'pending' | 'started' | 'approved' | 'rejected' | 'complete' | 'suspended' | 'aborted'
    // Misc
    | 'this' | 'status'
;

DataType:
    PrimitiveDataType
    | ChoiceDataType
;

PrimitiveDataType returns string:
    'text' | 'integer' | 'decimal' | 'date' | 'boolean' | 'currency' | 'memo' | 'termset'
;

ChoiceDataType:
    'choice' '(' choices+=Identifier (',' choices+=Identifier)* ')'
;

PropertyDeclaration:
    name=PropertyName ':' type=DataType (description=TEXT)? (initializer=PropertyInitializer)?
;

PropertyInitializer returns string:
    '=' (TEXT | Identifier | BooleanLiteral)
;

PropertyName:
    name=Identifier
;

Annotation:
    annotation=ANNOT
;

QualifiedName returns string:
    Identifier ('.' Identifier)*;

//---------------------------------------------------------------------------------------------
// Information Security and Compliance
//---------------------------------------------------------------------------------------------
SecurityGroup:
    'SecurityGroup' (members=MemberAssignment)? name=Identifier title=TEXT (description=TEXT)?
    (permAssign=PermissionAssignment)?
;

Permission:
    'Permission' name=Identifier title=TEXT description=TEXT (notes=TEXT)?
;

RetentionLabel:
    'RetentionLabel' name=Identifier title=TEXT description=TEXT (notes=TEXT)?
;

SensitivityLabel:
    'SensitivityLabel' name=Identifier title=TEXT description=TEXT (notes=TEXT)?
;

MemberAssignment:
    '[' members+=[Actor:Identifier] (',' members+=[Actor:Identifier])* ']'
;

RoleAssignment:
    '[' roles+=[Actor:Identifier] (',' roles+=[Actor:Identifier])* ']'
;

PermissionAssignment:
    '=' '[' permissions+=[Actor:Identifier] (',' permissions+=[Actor:Identifier])* ']'
;

LabelAssignment:
    '[' LabelAssignmentContent ']'
;

LabelAssignmentContent:
    RetentionWithOptionalSensitivity
    | SensitivityOnly
;

RetentionWithOptionalSensitivity:
    retention=[RetentionLabel:Identifier] ('(' sensitivity=[SensitivityLabel:Identifier] ')')?
;

SensitivityOnly:
    '(' sensitivity=[SensitivityLabel:Identifier] ')'
;

//---------------------------------------------------------------------------------------------
// Activities and Tasks
//---------------------------------------------------------------------------------------------

Activity:
    'Activity' (roles=RoleAssignment)? name=Identifier title=TEXT (description=TEXT)? (notes=TEXT)?
     (tasks=TaskBlock)? (flow=ContentFlow)?
;

Task:
    'Task' (roles=RoleAssignment)? name=Identifier title=TEXT (description=TEXT)? (notes=TEXT)?
    (tasks=TaskBlock)? (flow=ContentFlow)?
;

TaskBlock:
    '{' elements+=TaskBlockElement* '}'
;

TaskBlockElement:
    Annotation | Task | PropertyDeclaration
;

//---------------------------------------------------------------------------------------------
// Actors
//---------------------------------------------------------------------------------------------
Actor:
    'Actor' name=Identifier title=TEXT (description=TEXT)? (notes=TEXT)? (properties=ActorBlock)?
;

ActorBlock:
    '{' elements+=ActorBlockElement* '}'
;

ActorBlockElement:
    Annotation | Actor | PropertyDeclaration
;

//---------------------------------------------------------------------------------------------
// Content Controls
//---------------------------------------------------------------------------------------------
Content:
    'Content' attributes=ContentAttributes? name=Identifier title=TEXT (description=TEXT)? (notes=TEXT)?
    (labels=LabelAssignment)? (flow=ContentFlow)? (properties=ContentBlock)?
;

ContentAttributes:
    '[' attributes+=ContentAttribute (',' attributes+=ContentAttribute)* ']'
;

ContentAttribute:
    'template' '=' (template=QualifiedName)
    | 'format' '=' (format=ContentFormat)
    | 'type' '=' (type=ContentType)
    | 'schema' '=' (schema=QualifiedName)
;

ContentFormat returns string:
    'TXT' | 'DOCX' | 'CSV' | 'XLSX' | 'PDF' | 'MD' | 'JSON' | 'XML'
;

ContentType returns string:
    'Text' | 'Csv' | 'Excel' | 'Word' | 'PowerPoint' | 'Markdown' | 'Pdf' 
    | 'Script' | 'Image' | 'Diagram' | 'Flowchart' | 'OrgChart' | 'Survey'
;

ContentBlock:
    '{' elements+=ContentBlockElement* '}'
;

ContentBlockElement:
    Annotation | Content | PropertyDeclaration
;

ContentFlow:
    InputOutputFlow
    | InputOnlyFlow
    | OutputOnlyFlow
;

InputOutputFlow:
    input=InputFlow output=OutputFlow
;

InputOnlyFlow:
    input=InputFlow
;

OutputOnlyFlow:
    output=OutputFlow
;

InputFlow:
    '<<' sources+=[Content:Identifier] (',' sources+=[Content:Identifier])*
;

OutputFlow:
    '>>' targets+=[Content:Identifier] (',' targets+=[Content:Identifier])*
;

// -----------------------------------------------------------------------------
//  Workflow Support
// -----------------------------------------------------------------------------

Workflow:
    'Workflow' name=Identifier title=TEXT (description=TEXT)? (notes=TEXT)?
    '{' elements+=WorkflowElement* '}'
;

WorkflowElement:
    Annotation | WorkflowStep | PropertyDeclaration
;

WorkflowStep:
    DoStep | RepeatStep
;

DoStep:
    'Do' target=WorkflowTarget (conditional=ConditionalModifier)?
;

RepeatStep:
    'Repeat' target=WorkflowTarget 'Until' untilCondition=Condition (conditional=ConditionalModifier)?
;

ConditionalModifier:
    'If' condition=Condition
;

WorkflowTarget:
    SingleActivityTarget | ActivitySequenceTarget
;

SingleActivityTarget:
    activity=[Activity:Identifier]
;

ActivitySequenceTarget:
    '[' activities+=[Activity:Identifier] (',' activities+=[Activity:Identifier])* ']'
;

Condition:
    FieldValueCondition | ActivityCondition | WorkflowCondition
;

FieldValueCondition:
    field=QualifiedFieldReference '=' value=ConditionValue
;

ActivityCondition:
    'status' '=' value=StatusValue
;

WorkflowCondition:
    'this' '.' WorkflowProperty '=' value=StatusValue
;

WorkflowProperty returns string:
    Identifier
;

StatusValue returns string:
    'pending' | 'started' | 'approved' | 'rejected' | 'complete' | 'suspended' | 'aborted'
;

QualifiedFieldReference:
    object=[Activity:Identifier] '.' property=PropertyName  // Activity.property
    | property=PropertyName                                 // Workflow-level property
;

ConditionValue returns string:
    TEXT | Identifier | BooleanLiteral
;

BooleanLiteral returns string:
    'true' | 'false'
;

// -----------------------------------------------------------------------------
//  Lexer Rules - Optimized for robust parsing
// -----------------------------------------------------------------------------
hidden terminal WS: /\s+/;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;

// Block-style annotation - Enhanced tokenization with proper escape handling
terminal ANNOT: /<#([\s\S]*?)#>/;

// Text literals - Enhanced string recognition with robust quote handling
terminal TEXT: /"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/;

// Numbers - Strategic precedence ordering for disambiguation
terminal DECIMAL: /[0-9]+\.[0-9]+/;
terminal DATE: /[0-9]{4}-[0-9]{2}-[0-9]{2}/;
terminal INT: /[0-9]+/;

// Identifiers - Context-sensitive recognition
terminal ID: /[_A-Za-z][_0-9A-Za-z]*/;

// Optional statement terminator - Flexible parsing support
terminal SEMICOLON: ';';

