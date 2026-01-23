// =============================================================================
// ActOne Grammar
// =============================================================================
// Purpose: A DSL for fiction writers orchestrating multi-agent AI story generation
// Domain:  Creative writing, interactive fiction, AI-assisted narrative
// Version: Generated for Langium 4.x
//
// Design Rationale:
// This grammar treats characters as autonomous AI agents with unique psychologies.
// Rather than scripting dialogue directly, it defines character psychographies,
// relationship dynamics, scene containers, and plot architecture. At runtime,
// separate AI agents (one per character) collaborate to generate emergent narrative.
//
// Key Design Decisions:
// - Hybrid cross-references: Strict validation for same-file refs, imports for external
// - Structured goals: Type-safe { text, priority? } instead of embedded "text:priority"
// - Semi-structured maps: Common keys predefined with custom key escape hatch
// - C-style syntax with braces, colons for assignment, commas for separation
//
// Suggested File Extension: .actone
//
// Usage Examples:
// - story "My Story" { character Hero { bio: "..." } }
// - character Mara { personality: { skepticism: 85, custom("empathy"): 70 } }
// - scene Confrontation { participants: [Mara, Kael], atmosphere: { tension: 90 } }
//
// Extension Points:
// - Custom personality traits via custom("traitName") syntax
// - Custom atmosphere keys via custom("moodName") syntax
// - World rules as freeform strings for maximum flexibility
// - Import mechanism for multi-file story projects
// =============================================================================

grammar ActOne

// -----------------------------------------------------------------------------
// Entry Point
// -----------------------------------------------------------------------------
// Rationale: Story is the root container for all narrative elements.
// A story has a title, optional imports for multi-file projects, and contains
// all characters, worlds, scenes, plots, interactions, and generation settings.
//
// The generation block can appear anywhere within the story for flexibility,
// but typically appears at the top for visibility.

entry Story:
    'story' name=STRING '{'
        (imports+=Import)*
        (generation=GenerationBlock)?
        (elements+=StoryElement)*
    '}';

// -----------------------------------------------------------------------------
// Imports
// -----------------------------------------------------------------------------
// Rationale: Supports multi-file story projects where characters, worlds, or
// other elements can be defined in separate files and imported.
// Imported references use string-based paths (runtime resolution) while
// same-file references use strict cross-reference validation.

Import:
    'import' path=STRING ('as' alias=ID)?;

// -----------------------------------------------------------------------------
// Story Elements
// -----------------------------------------------------------------------------
// Rationale: Union type allowing flexible ordering of story components.
// Writers can organize their stories in whatever order makes sense narratively.

StoryElement:
    Character | World | Scene | Plot | Interaction;

// -----------------------------------------------------------------------------
// Character Definition
// -----------------------------------------------------------------------------
// Purpose: Defines an autonomous AI agent with psychology, voice, and relationships.
// Characters are the core entities that drive emergent narrative generation.
//
// Syntax Design: Block-based with optional sections in any order.
// All sections are optional to allow minimal character sketches or fully-detailed
// psychographies.
//
// Relationships: Characters reference other characters via cross-references
// (strict same-file validation) or string identifiers (for imported characters).

Character:
    'character' name=ID '{'
        sections+=CharacterSection*
    '}';

CharacterSection:
    CharacterBio | CharacterPersonality | CharacterVoice |
    CharacterGoals | CharacterConflicts | CharacterRelationships;

CharacterBio:
    'bio' ':' value=STRING ','?;

CharacterPersonality:
    'personality' ':' value=PersonalityBlock ','?;

CharacterVoice:
    'voice' ':' value=STRING ','?;

CharacterGoals:
    'goals' ':' value=GoalList ','?;

CharacterConflicts:
    'conflicts' ':' value=StringList ','?;

CharacterRelationships:
    'relationships' ':' value=RelationshipMap ','?;

// -----------------------------------------------------------------------------
// Personality Block
// -----------------------------------------------------------------------------
// Rationale: Semi-structured approach - common personality traits are predefined
// keywords for autocomplete and validation, while custom() allows arbitrary traits.
// Values are 0-100 representing intensity of that trait.
//
// Common Traits: skepticism, melancholy, ambition, curiosity, desperation,
// empathy, aggression, optimism, caution, creativity
//
// Extension: custom("traitName") allows any additional trait without grammar changes.

PersonalityBlock:
    '{' (traits+=PersonalityTrait (',' traits+=PersonalityTrait)*)? ','? '}';

PersonalityTrait:
    CommonPersonalityTrait | CustomPersonalityTrait;

CommonPersonalityTrait:
    trait=CommonTraitKeyword ':' value=NUMBER;

// Predefined common personality traits for autocomplete and validation
CommonTraitKeyword returns string:
    'skepticism' | 'melancholy' | 'ambition' | 'curiosity' | 'desperation' |
    'empathy' | 'aggression' | 'optimism' | 'caution' | 'creativity' |
    'loyalty' | 'pride' | 'fear' | 'hope' | 'anger' | 'compassion';

CustomPersonalityTrait:
    'custom' '(' traitName=STRING ')' ':' value=NUMBER;

// -----------------------------------------------------------------------------
// Goal Definition
// -----------------------------------------------------------------------------
// Rationale: Structured goals with explicit text and optional priority weight.
// This provides type-safety and better tooling compared to embedding priority
// in the string (e.g., "goal text:90").
//
// Priority: 0-100 scale where 100 is highest priority. Optional - defaults to
// implicit ordering (first goal = highest priority) if not specified.

GoalList:
    '[' (goals+=Goal (',' goals+=Goal)*)? ','? ']';

Goal:
    StructuredGoal | SimpleGoal;

// Full structured goal with explicit priority
StructuredGoal:
    '{' 'text' ':' text=STRING ',' 'priority' ':' priority=NUMBER '}';

// Simple string goal (priority determined by list order)
SimpleGoal:
    text=STRING;

// -----------------------------------------------------------------------------
// Relationship Map
// -----------------------------------------------------------------------------
// Rationale: Maps character IDs to relationship descriptors.
// Uses cross-references for same-file characters (compile-time validation)
// or string identifiers for imported characters (runtime resolution).
//
// Weight: -100 (hostile) to +100 (devoted)
// Label: Brief descriptor (e.g., "reluctant mentor", "rival", "anchor")
// History: Backstory of the relationship

RelationshipMap:
    '{' (relationships+=RelationshipEntry (',' relationships+=RelationshipEntry)*)? ','? '}';

RelationshipEntry:
    // Cross-reference to character in same file, or use quoted string for imported
    (target=[Character:ID] | externalTarget=STRING) ':' descriptor=RelationshipDescriptor;

RelationshipDescriptor:
    '{'
        'weight' ':' weight=SignedNumber ','
        'label' ':' label=STRING
        (',' 'history' ':' history=STRING)?
        ','?
    '}';

// Signed number for relationship weights (-100 to 100)
SignedNumber returns number:
    '-'? NUMBER;

// -----------------------------------------------------------------------------
// World Definition
// -----------------------------------------------------------------------------
// Purpose: Defines the setting, rules, and temporal context for the story.
// Worlds contain locations (named settings), immutable rules, and time descriptors.
//
// Syntax Design: Named world blocks allow multiple worlds (e.g., flashback settings,
// parallel dimensions) within a single story.

World:
    'world' name=ID '{'
        sections+=WorldSection*
    '}';

WorldSection:
    WorldLocations | WorldRules | WorldTime;

WorldLocations:
    'locations' ':' value=LocationMap ','?;

WorldRules:
    'rules' ':' value=StringList ','?;

WorldTime:
    'time' ':' value=TimeDescriptor ','?;

// -----------------------------------------------------------------------------
// Location Map
// -----------------------------------------------------------------------------
// Rationale: Named locations with sensory descriptions and affordances.
// Locations can be referenced by scenes via cross-reference.

LocationMap:
    '{' (locations+=LocationEntry (',' locations+=LocationEntry)*)? ','? '}';

LocationEntry:
    name=ID ':' description=STRING;

// Time descriptor for world
TimeDescriptor:
    '{'
        sections+=TimeSection*
    '}';

TimeSection:
    TimePeriod | TimeClock;

TimePeriod:
    'period' ':' value=STRING ','?;

TimeClock:
    'clock' ':' value=STRING ','?;

// -----------------------------------------------------------------------------
// Scene Definition
// -----------------------------------------------------------------------------
// Purpose: Defines an interaction arena where characters meet and drama unfolds.
// Scenes are containers with participants, setting, mood, objectives, and constraints.
//
// Relationships:
// - participants: References to characters in this story
// - setting: Reference to a location in a world

Scene:
    'scene' name=ID '{'
        sections+=SceneSection*
    '}';

SceneSection:
    SceneParticipants | SceneSetting | SceneAtmosphere |
    SceneObjective | SceneConstraints | SceneTriggers;

SceneParticipants:
    'participants' ':' value=ParticipantList ','?;

SceneSetting:
    'setting' ':' value=SettingReference ','?;

SceneAtmosphere:
    'atmosphere' ':' value=AtmosphereBlock ','?;

SceneObjective:
    'objective' ':' value=STRING ','?;

SceneConstraints:
    'constraints' ':' value=StringList ','?;

SceneTriggers:
    'triggers' ':' value=TriggerBlock ','?;

// -----------------------------------------------------------------------------
// Participant List
// -----------------------------------------------------------------------------
// Rationale: List of character references for scene participants.
// Uses cross-references for compile-time validation within same file.

ParticipantList:
    '[' (participants+=ParticipantRef (',' participants+=ParticipantRef)*)? ','? ']';

ParticipantRef:
    character=[Character:ID] | externalCharacter=STRING;

// -----------------------------------------------------------------------------
// Setting Reference
// -----------------------------------------------------------------------------
// Rationale: References a location within a world. Can be a simple location ID
// (inferred world) or fully qualified World.Location syntax.

SettingReference:
    location=ID;

// -----------------------------------------------------------------------------
// Atmosphere Block
// -----------------------------------------------------------------------------
// Rationale: Semi-structured mood vectors with predefined common moods
// and custom() escape hatch for domain-specific atmospheres.
// Values are 0-100 representing intensity.
//
// Common Moods: tension, urgency, intimacy, dread, hope, chaos, calm, mystery

AtmosphereBlock:
    '{' (moods+=AtmosphereMood (',' moods+=AtmosphereMood)*)? ','? '}';

AtmosphereMood:
    CommonAtmosphereMood | CustomAtmosphereMood;

CommonAtmosphereMood:
    mood=CommonMoodKeyword ':' value=NUMBER;

CommonMoodKeyword returns string:
    'tension' | 'urgency' | 'intimacy' | 'dread' | 'hope' |
    'chaos' | 'calm' | 'mystery' | 'joy' | 'sorrow' | 'anticipation';

CustomAtmosphereMood:
    'custom' '(' moodName=STRING ')' ':' value=NUMBER;

// -----------------------------------------------------------------------------
// Trigger Block
// -----------------------------------------------------------------------------
// Rationale: Defines conditions for scene start and end.
// Triggers are narrative conditions, not programmatic events.

TriggerBlock:
    '{'
        sections+=TriggerSection*
    '}';

TriggerSection:
    TriggerStart | TriggerEnd;

TriggerStart:
    'start' ':' value=STRING ','?;

TriggerEnd:
    'end' ':' value=STRING ','?;

// -----------------------------------------------------------------------------
// Plot Arc Definition
// -----------------------------------------------------------------------------
// Purpose: Defines the narrative arc as a constraint graph, not a step-by-step outline.
// Beats are milestones with gaps for emergent story development.
//
// Syntax Design: Uses enums for conflict types and resolution patterns to provide
// structured guidance to AI agents while maintaining creative flexibility.

Plot:
    'plot' name=ID '{'
        sections+=PlotSection*
    '}';

PlotSection:
    PlotBeats | PlotConflictType | PlotResolutionPattern;

PlotBeats:
    'beats' ':' value=BeatList ','?;

PlotConflictType:
    'conflict_type' ':' value=ConflictType ','?;

PlotResolutionPattern:
    'resolution_pattern' ':' value=ResolutionPattern ','?;

BeatList:
    '[' (beats+=STRING (',' beats+=STRING)*)? ','? ']';

// Conflict type enum - fundamental dramatic conflicts
ConflictType returns string:
    'Internal' | 'Interpersonal' | 'Societal' | 'Cosmic' |
    'Environmental' | 'Technological' | 'Supernatural';

// Resolution pattern enum - how the story arc resolves
ResolutionPattern returns string:
    'Tragic' | 'Growth' | 'Circular' | 'Transformative' |
    'Ambiguous' | 'Redemptive' | 'Pyrrhic';

// -----------------------------------------------------------------------------
// Interaction Pattern Definition
// -----------------------------------------------------------------------------
// Purpose: Reusable dialogue/interaction templates that can be applied to scenes.
// Patterns describe rhythm and flow without scripting actual dialogue.
//
// Syntax Design: Participants, pattern string (regex-like rhythm), and style mix
// percentages to blend character voices.

Interaction:
    'interaction' name=ID '{'
        sections+=InteractionSection*
    '}';

InteractionSection:
    InteractionParticipants | InteractionPattern | InteractionStyleMix;

InteractionParticipants:
    'participants' ':' value=ParticipantList ','?;

InteractionPattern:
    'pattern' ':' value=STRING ','?;

InteractionStyleMix:
    'style_mix' ':' value=StyleMixBlock ','?;

// -----------------------------------------------------------------------------
// Style Mix Block
// -----------------------------------------------------------------------------
// Rationale: Percentage blend of each character's voice template.
// Values are 0.0-1.0 representing contribution to the blended style.

StyleMixBlock:
    '{' (entries+=StyleMixEntry (',' entries+=StyleMixEntry)*)? ','? '}';

StyleMixEntry:
    (character=[Character:ID] | externalCharacter=STRING) ':' weight=NUMBER;

// -----------------------------------------------------------------------------
// Generation Block
// -----------------------------------------------------------------------------
// Purpose: AI generation parameters that control narrative output.
// These settings influence how AI agents generate story content.
//
// Parameters:
// - temperature: 0.0-2.0 (creativity vs. coherence)
// - max_tokens: Per-generation token limit
// - continuity_loss: 0-1 (how much agents forget over time)
// - style_bleed: Boolean (allow voice traits to infect other agents)

GenerationBlock:
    'generate' '{'
        sections+=GenerationSection*
    '}';

GenerationSection:
    GenerationTemperature | GenerationMaxTokens |
    GenerationContinuityLoss | GenerationStyleBleed;

GenerationTemperature:
    'temperature' ':' value=NUMBER ','?;

GenerationMaxTokens:
    'max_tokens' ':' value=NUMBER ','?;

GenerationContinuityLoss:
    'continuity_loss' ':' value=NUMBER ','?;

GenerationStyleBleed:
    'style_bleed' ':' value=BooleanValue ','?;

BooleanValue returns boolean:
    'true' | 'false';

// -----------------------------------------------------------------------------
// Utility Rules
// -----------------------------------------------------------------------------
// Reusable list types for common patterns

StringList:
    '[' (items+=STRING (',' items+=STRING)*)? ','? ']';

// -----------------------------------------------------------------------------
// Terminal Definitions
// -----------------------------------------------------------------------------
// Standard Langium terminal definitions following conventions.
// These provide the lexical building blocks for the grammar.

// Identifier: Starts with letter or underscore, followed by alphanumerics
// Used for character names, world names, location names, etc.
terminal ID: /[_a-zA-Z][_a-zA-Z0-9]*/;

// String literal: Double or single quoted, with escape sequence support
terminal STRING: /"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/;

// Number: Integer or decimal (unsigned - SignedNumber rule handles negatives)
terminal NUMBER: /[0-9]+(\.[0-9]+)?/;

// -----------------------------------------------------------------------------
// Hidden Terminals (Whitespace and Comments)
// -----------------------------------------------------------------------------
// These tokens are recognized but not included in the AST.
// Comments can appear anywhere and are useful for narrative notes.

hidden terminal WS: /\s+/;
hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
