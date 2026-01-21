// =============================================================================
// @name = "SPDevKit"
// @tagline = "SharePoint Development Kit"
// @description = "A development environment for modeling collaborative applications for SharePoint Online."
// @extension = ".spdk"
// =============================================================================
grammar SPDevKit

// Entry point - the main model containing all top-level elements
entry Model:
    elements+=Element*;

// Base element type for all top-level constructs
Element:
    Application | Entity | Service | Workflow;

// Application definition - represents a deployable unit
Application:
    'application' name=ID '{'
        ('description' description=STRING)?
        ('version' version=STRING)?
        entities+=[Entity]*
        services+=[Service]*
    '}';

// Entity definition - data model types
Entity:
    'entity' name=ID '{'
        properties+=Property*
    '}';

// Property within an entity
Property:
    name=ID ':' type=TypeRef ('='  defaultValue=STRING)?;

// Type reference
TypeRef:
    primitiveType=PrimitiveType | entityRef=[Entity];

PrimitiveType returns string:
    'string' | 'number' | 'boolean' | 'date';

// Service definition - business logic components
Service:
    'service' name=ID '{'
        ('description' description=STRING)?
        operations+=Operation*
    '}';

// Operation within a service
Operation:
    'operation' name=ID '(' params+=Parameter* ')' ('->' returnType=TypeRef)?;

// Operation parameter
Parameter:
    name=ID ':' type=TypeRef;

// Workflow definition - process orchestration
Workflow:
    'workflow' name=ID '{'
        ('description' description=STRING)?
        steps+=Step*
    '}';

// Step within a workflow
Step:
    'step' name=ID '{'
        ('action' action=STRING)?
        ('next' next=[Step])?
    '}';

// Terminals
hidden terminal WS: /\s+/;
hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;

terminal ID: /[_a-zA-Z][\w_]*/;
terminal STRING: /"[^"]*"|'[^']*'/;
terminal INT returns number: /[0-9]+/;
