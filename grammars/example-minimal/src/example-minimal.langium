/**
 * Example Minimal Grammar
 *
 * A simple grammar demonstrating the minimal structure
 * required for SANYAM integration.
 */

grammar ExampleMinimal

// Entry rule - the root of your AST
entry Model:
    (items+=Item)*;

// Item is the base type for all elements
Item:
    Box | Arrow;

// Box is a simple node with a name
Box:
    'box' name=ID ('{'
        ('label' label=STRING)?
        ('color' color=Color)?
    '}')?;

// Arrow connects two boxes
Arrow:
    'arrow' name=ID '{'
        'from' source=[Box:ID]
        'to' target=[Box:ID]
        ('label' label=STRING)?
    '}';

// Color enumeration
Color returns string:
    'red' | 'green' | 'blue' | 'yellow' | 'gray';

// Hidden terminals (whitespace and comments)
hidden terminal WS: /\s+/;
hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;

// Basic terminals
terminal ID: /[_a-zA-Z][\w_]*/;
terminal STRING: /"[^"]*"|'[^']*'/;
