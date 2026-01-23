// NIST Cybersecurity Framework DSL
// Generated from: https://www.nist.gov/cyberframework
//
// Models the NIST CSF structure including CoreFunctions, Categories,
// Subcategories, Profiles, and Informative References.

grammar NistCsf

// Entry point - a CSF model contains framework elements
entry Model:
    (elements+=Element)*;

// Union type for all top-level elements
Element:
    Framework | Profile | CoreFunction | Category | Subcategory | Control | InformativeReference;

// Framework definition - the top-level container
Framework:
    'framework' name=ID '{'
        ('description' description=STRING)?
        ('version' version=STRING)?
        (functions+=CoreFunction)*
    '}';

// Profile - industry or organization-specific implementation
Profile:
    'profile' name=ID '{'
        ('description' description=STRING)?
        ('target' target=STRING)?
        (mappings+=ProfileMapping)*
    '}';

// Profile mapping links outcomes to implementation tiers
ProfileMapping:
    'mapping' subcategory=[Subcategory:ID] '->' tier=ImplementationTier
        ('notes' notes=STRING)?;

// Implementation tier levels
ImplementationTier returns string:
    'Partial' | 'RiskInformed' | 'Repeatable' | 'Adaptive';

// CoreFunction - one of the six CSF functions
CoreFunction:
    'function' name=CoreFunctionName '{'
        ('description' description=STRING)?
        (categories+=Category)*
    '}';

// The six core function names
CoreFunctionName returns string:
    'Govern' | 'Identify' | 'Protect' | 'Detect' | 'Respond' | 'Recover';

// Category - groups related outcomes within a function
Category:
    'category' name=ID '{'
        ('id' categoryId=STRING)?
        ('description' description=STRING)?
        (subcategories+=Subcategory)*
    '}';

// Subcategory - specific outcome statements
Subcategory:
    'subcategory' name=ID '{'
        ('id' subcategoryId=STRING)?
        ('description' description=STRING)?
        (references+=InformativeReference)*
    '}';

// Control - security control from NIST SP 800-53 or other standards
Control:
    'control' name=ID '{'
        ('id' controlId=STRING)?
        ('family' family=STRING)?
        ('description' description=STRING)?
        ('baseline' baseline=ControlBaseline)?
    '}';

// Control baseline impact levels
ControlBaseline returns string:
    'Low' | 'Moderate' | 'High';

// Informative Reference - mapping to external standards
InformativeReference:
    'reference' name=ID '{'
        ('standard' standard=STRING)?
        ('section' section=STRING)?
        ('url' url=STRING)?
    '}';

// Hidden terminal rules
hidden terminal WS: /\s+/;
hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;

// Terminal rules
terminal ID: /[_a-zA-Z][\w_-]*/;
terminal STRING: /"[^"]*"|'[^']*'/;
