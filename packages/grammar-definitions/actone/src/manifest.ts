/**
 * ActOne Grammar Manifest
 *
 * Declarative configuration for UI presentation, file organization,
 * and diagram rendering for ActOne - a DSL for fiction writers
 * orchestrating multi-agent AI story generation.
 *
 * @packageDocumentation
 */

import type { GrammarManifest } from '@sanyam/types';

/**
 * ActOne Grammar Manifest
 *
 * Note: Logo is handled by webpack asset bundling. The logo.svg file is copied
 * to assets/logos/actone.svg at build time.
 */
export const manifest: GrammarManifest = {
  languageId: 'actone',
  displayName: 'ActOne Story DSL',
  fileExtension: '.actone',
  baseExtension: '.actone',
  // logo field omitted - handled by webpack asset bundling (assets/logos/actone.svg)
  packageFile: {
    fileName: 'story.actone',
    displayName: 'Story',
    icon: 'book',
  },
  rootTypes: [
    {
      astType: 'Story',
      displayName: 'Story',
      fileSuffix: '.story',
      folder: 'stories',
      icon: 'book',
      template: `story "\${title}" {
  generate {
    temperature: 0.8,
    max_tokens: 2000
  }

  // Characters
  // character Hero { bio: "...", personality: { ... } }

  // Worlds
  // world MainWorld { locations: { ... }, rules: [...] }

  // Scenes
  // scene Opening { participants: [...], setting: location, atmosphere: { ... } }

  // Plot
  // plot MainArc { beats: [...], conflict_type: Interpersonal }
}
`,
      templateInputs: [
        { id: 'title', label: 'Story Title', type: 'string', required: true },
      ],
      diagramNode: {
        glspType: 'node:story',
        shape: 'rectangle',
        cssClass: 'story-node',
        defaultSize: { width: 200, height: 120 },
      },
    },
    {
      astType: 'Character',
      displayName: 'Character',
      fileSuffix: '.character',
      folder: 'characters',
      icon: 'person',
      template: `character \${name} {
  bio: "\${bio}",
  personality: {
    // Values 0-100
    curiosity: 50,
    ambition: 50,
    empathy: 50
  },
  voice: "\${voiceStyle}",
  goals: [
    "\${mainGoal}"
  ],
  conflicts: [
    "\${mainConflict}"
  ]
}
`,
      templateInputs: [
        { id: 'name', label: 'Character Name', type: 'string', required: true },
        { id: 'bio', label: 'Biography', type: 'string', required: true },
        { id: 'voiceStyle', label: 'Voice Style', type: 'string', required: false },
        { id: 'mainGoal', label: 'Main Goal', type: 'string', required: false },
        { id: 'mainConflict', label: 'Main Conflict', type: 'string', required: false },
      ],
      diagramNode: {
        glspType: 'node:character',
        shape: 'ellipse',
        cssClass: 'character-node',
        defaultSize: { width: 140, height: 100 },
      },
    },
    {
      astType: 'World',
      displayName: 'World',
      fileSuffix: '.world',
      folder: 'worlds',
      icon: 'globe',
      template: `world \${name} {
  locations: {
    \${locationName}: "\${locationDescription}"
  },
  rules: [
    "\${worldRule}"
  ],
  time: {
    period: "\${timePeriod}",
    clock: "\${clockSetting}"
  }
}
`,
      templateInputs: [
        { id: 'name', label: 'World Name', type: 'string', required: true },
        { id: 'locationName', label: 'First Location Name', type: 'string', required: false },
        { id: 'locationDescription', label: 'Location Description', type: 'string', required: false },
        { id: 'worldRule', label: 'World Rule', type: 'string', required: false },
        { id: 'timePeriod', label: 'Time Period', type: 'string', required: false },
        { id: 'clockSetting', label: 'Clock/Time of Day', type: 'string', required: false },
      ],
      diagramNode: {
        glspType: 'node:world',
        shape: 'rectangle',
        cssClass: 'world-node',
        defaultSize: { width: 180, height: 100 },
      },
    },
    {
      astType: 'Scene',
      displayName: 'Scene',
      fileSuffix: '.scene',
      folder: 'scenes',
      icon: 'video',
      template: `scene \${name} {
  participants: [\${participants}],
  setting: \${location},
  atmosphere: {
    tension: \${tensionLevel},
    intimacy: \${intimacyLevel}
  },
  objective: "\${sceneObjective}",
  constraints: [
    "\${constraint}"
  ],
  triggers: {
    start: "\${startTrigger}",
    end: "\${endTrigger}"
  }
}
`,
      templateInputs: [
        { id: 'name', label: 'Scene Name', type: 'string', required: true },
        { id: 'participants', label: 'Participants (comma-separated)', type: 'string', required: false },
        { id: 'location', label: 'Location Reference', type: 'string', required: false },
        { id: 'tensionLevel', label: 'Tension (0-100)', type: 'number', required: false },
        { id: 'intimacyLevel', label: 'Intimacy (0-100)', type: 'number', required: false },
        { id: 'sceneObjective', label: 'Scene Objective', type: 'string', required: false },
        { id: 'constraint', label: 'Constraint', type: 'string', required: false },
        { id: 'startTrigger', label: 'Start Trigger', type: 'string', required: false },
        { id: 'endTrigger', label: 'End Trigger', type: 'string', required: false },
      ],
      diagramNode: {
        glspType: 'node:scene',
        shape: 'rectangle',
        cssClass: 'scene-node',
        defaultSize: { width: 160, height: 80 },
      },
    },
    {
      astType: 'Plot',
      displayName: 'Plot Arc',
      fileSuffix: '.plot',
      folder: 'plots',
      icon: 'git-merge',
      template: `plot \${name} {
  beats: [
    "\${beat1}",
    "\${beat2}",
    "\${beat3}"
  ],
  conflict_type: \${conflictType},
  resolution_pattern: \${resolutionPattern}
}
`,
      templateInputs: [
        { id: 'name', label: 'Plot Name', type: 'string', required: true },
        { id: 'beat1', label: 'Beat 1', type: 'string', required: false },
        { id: 'beat2', label: 'Beat 2', type: 'string', required: false },
        { id: 'beat3', label: 'Beat 3', type: 'string', required: false },
        { id: 'conflictType', label: 'Conflict Type', type: 'select', required: false },
        { id: 'resolutionPattern', label: 'Resolution Pattern', type: 'select', required: false },
      ],
      diagramNode: {
        glspType: 'node:plot',
        shape: 'hexagon',
        cssClass: 'plot-node',
        defaultSize: { width: 160, height: 90 },
      },
    },
    {
      astType: 'Interaction',
      displayName: 'Interaction Pattern',
      fileSuffix: '.interaction',
      folder: 'interactions',
      icon: 'comment-discussion',
      template: `interaction \${name} {
  participants: [\${participants}],
  pattern: "\${dialoguePattern}",
  style_mix: {
    // Character weights for voice blending
  }
}
`,
      templateInputs: [
        { id: 'name', label: 'Interaction Name', type: 'string', required: true },
        { id: 'participants', label: 'Participants (comma-separated)', type: 'string', required: false },
        { id: 'dialoguePattern', label: 'Dialogue Pattern', type: 'string', required: false },
      ],
      diagramNode: {
        glspType: 'node:interaction',
        shape: 'diamond',
        cssClass: 'interaction-node',
        defaultSize: { width: 120, height: 80 },
      },
    },
  ],
  diagrammingEnabled: true,
  diagramTypes: [
    {
      id: 'actone-story',
      displayName: 'Story Structure',
      fileType: 'Story',
      nodeTypes: [
        { glspType: 'node:character', creatable: true, showable: true },
        { glspType: 'node:world', creatable: true, showable: true },
        { glspType: 'node:scene', creatable: true, showable: true },
        { glspType: 'node:plot', creatable: true, showable: true },
        { glspType: 'node:interaction', creatable: true, showable: true },
      ],
      edgeTypes: [
        { glspType: 'edge:relationship', creatable: true, showable: true },
        { glspType: 'edge:participation', creatable: true, showable: true },
        { glspType: 'edge:sequence', creatable: true, showable: true },
      ],
      toolPalette: {
        groups: [
          {
            id: 'characters',
            label: 'Characters',
            items: [
              {
                id: 'create-character',
                label: 'Character',
                icon: 'person',
                action: { type: 'create-node', glspType: 'node:character' },
              },
            ],
          },
          {
            id: 'structure',
            label: 'Story Structure',
            items: [
              {
                id: 'create-world',
                label: 'World',
                icon: 'globe',
                action: { type: 'create-node', glspType: 'node:world' },
              },
              {
                id: 'create-scene',
                label: 'Scene',
                icon: 'video',
                action: { type: 'create-node', glspType: 'node:scene' },
              },
              {
                id: 'create-plot',
                label: 'Plot Arc',
                icon: 'git-merge',
                action: { type: 'create-node', glspType: 'node:plot' },
              },
            ],
          },
          {
            id: 'interactions',
            label: 'Interactions',
            items: [
              {
                id: 'create-interaction',
                label: 'Interaction Pattern',
                icon: 'comment-discussion',
                action: { type: 'create-node', glspType: 'node:interaction' },
              },
            ],
          },
          {
            id: 'connections',
            label: 'Connections',
            items: [
              {
                id: 'create-relationship',
                label: 'Relationship',
                icon: 'arrow-both',
                action: { type: 'create-edge', glspType: 'edge:relationship' },
              },
              {
                id: 'create-participation',
                label: 'Participation',
                icon: 'link',
                action: { type: 'create-edge', glspType: 'edge:participation' },
              },
              {
                id: 'create-sequence',
                label: 'Sequence',
                icon: 'arrow-right',
                action: { type: 'create-edge', glspType: 'edge:sequence' },
              },
            ],
          },
        ],
      },
    },
    {
      id: 'actone-characters',
      displayName: 'Character Web',
      fileType: 'Story',
      nodeTypes: [
        { glspType: 'node:character', creatable: true, showable: true },
      ],
      edgeTypes: [
        { glspType: 'edge:relationship', creatable: true, showable: true },
      ],
      toolPalette: {
        groups: [
          {
            id: 'characters',
            label: 'Characters',
            items: [
              {
                id: 'create-character',
                label: 'Character',
                icon: 'person',
                action: { type: 'create-node', glspType: 'node:character' },
              },
            ],
          },
          {
            id: 'relationships',
            label: 'Relationships',
            items: [
              {
                id: 'create-relationship',
                label: 'Relationship',
                icon: 'arrow-both',
                action: { type: 'create-edge', glspType: 'edge:relationship' },
              },
            ],
          },
        ],
      },
    },
    {
      id: 'actone-scenes',
      displayName: 'Scene Timeline',
      fileType: 'Story',
      nodeTypes: [
        { glspType: 'node:scene', creatable: true, showable: true },
        { glspType: 'node:plot', creatable: true, showable: true },
      ],
      edgeTypes: [
        { glspType: 'edge:sequence', creatable: true, showable: true },
      ],
      toolPalette: {
        groups: [
          {
            id: 'scenes',
            label: 'Scenes',
            items: [
              {
                id: 'create-scene',
                label: 'Scene',
                icon: 'video',
                action: { type: 'create-node', glspType: 'node:scene' },
              },
              {
                id: 'create-plot',
                label: 'Plot Arc',
                icon: 'git-merge',
                action: { type: 'create-node', glspType: 'node:plot' },
              },
            ],
          },
          {
            id: 'flow',
            label: 'Flow',
            items: [
              {
                id: 'create-sequence',
                label: 'Sequence',
                icon: 'arrow-right',
                action: { type: 'create-edge', glspType: 'edge:sequence' },
              },
            ],
          },
        ],
      },
    },
  ],
};

export default manifest;
