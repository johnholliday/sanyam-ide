grammar ${GrammarName}

// Entry point - defines the overall structure
entry Model:
    elements+=Element*;

// Base element type - customize as needed
Element:
    Task | Workflow;

// Task definition
Task:
    'task' name=ID '{'
        ('description' description=STRING)?
    '}';

// Workflow with tasks
Workflow:
    'workflow' name=ID '{'
        tasks+=[Task]*
    '}';

// Terminals
hidden terminal WS: /\s+/;
hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;

terminal ID: /[_a-zA-Z][\w_]*/;
terminal STRING: /"[^"]*"|'[^']*'/;
