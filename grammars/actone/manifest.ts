import type { GrammarManifest } from '@sanyam/types';

export const ACTONE_MANIFEST: GrammarManifest = {
  languageId: 'actone',
  displayName: 'ActOne',
  fileExtension: '.actone',
  baseExtension: '.actone',
  rootTypes: [
    {
      astType: 'Story',
      displayName: 'Story',
      fileSuffix: '.story',
      folder: 'stories',
      icon: 'book',
      template: `story "\${name}" {
  // Add characters, worlds, scenes, and plots here
}
`,
      templateInputs: [
        { id: 'name', label: 'Story Name', type: 'string', required: true }
      ],
      diagramNode: {
        glspType: 'node:story',
        shape: 'rectangle',
        cssClass: 'story-node',
        defaultSize: { width: 200, height: 80 }
      }
    },
    {
      astType: 'Character',
      displayName: 'Character',
      fileSuffix: '.character',
      folder: 'characters',
      icon: 'person',
      template: `character \${name} {
  bio: "Add character biography here",
  personality: {
    // Add personality traits (0-100)
  },
  voice: "Describe character's voice and speech patterns",
  goals: [
    // Add character goals
  ]
}
`,
      templateInputs: [
        { id: 'name', label: 'Character Name', type: 'string', required: true }
      ],
      diagramNode: {
        glspType: 'node:character',
        shape: 'ellipse',
        cssClass: 'character-node',
        defaultSize: { width: 140, height: 70 }
      }
    },
    {
      astType: 'World',
      displayName: 'World',
      fileSuffix: '.world',
      folder: 'worlds',
      icon: 'globe',
      template: `world \${name} {
  locations: {
    // Define named locations
  },
  rules: [
    // World rules and constraints
  ],
  time: {
    period: "Describe the time period",
    clock: "Current time in narrative"
  }
}
`,
      templateInputs: [
        { id: 'name', label: 'World Name', type: 'string', required: true }
      ],
      diagramNode: {
        glspType: 'node:world',
        shape: 'hexagon',
        cssClass: 'world-node',
        defaultSize: { width: 160, height: 80 }
      }
    },
    {
      astType: 'Scene',
      displayName: 'Scene',
      fileSuffix: '.scene',
      folder: 'scenes',
      icon: 'symbol-event',
      template: `scene \${name} {
  participants: [
    // Character references
  ],
  setting: LocationName,
  atmosphere: {
    tension: 50
  },
  objective: "Scene's narrative objective"
}
`,
      templateInputs: [
        { id: 'name', label: 'Scene Name', type: 'string', required: true }
      ],
      diagramNode: {
        glspType: 'node:scene',
        shape: 'rectangle',
        cssClass: 'scene-node',
        defaultSize: { width: 150, height: 60 }
      }
    },
    {
      astType: 'Plot',
      displayName: 'Plot',
      fileSuffix: '.plot',
      folder: 'plots',
      icon: 'git-merge',
      template: `plot \${name} {
  beats: [
    "Opening hook",
    "Rising action",
    "Climax",
    "Resolution"
  ],
  conflict_type: Interpersonal,
  resolution_pattern: Growth
}
`,
      templateInputs: [
        { id: 'name', label: 'Plot Name', type: 'string', required: true }
      ],
      diagramNode: {
        glspType: 'node:plot',
        shape: 'diamond',
        cssClass: 'plot-node',
        defaultSize: { width: 140, height: 70 }
      }
    },
    {
      astType: 'Interaction',
      displayName: 'Interaction',
      fileSuffix: '.interaction',
      folder: 'interactions',
      icon: 'comment-discussion',
      template: `interaction \${name} {
  participants: [
    // Character references
  ],
  pattern: "A-B-A-B",
  style_mix: {
    // Character voice weights (0.0-1.0)
  }
}
`,
      templateInputs: [
        { id: 'name', label: 'Interaction Name', type: 'string', required: true }
      ],
      diagramNode: {
        glspType: 'node:interaction',
        shape: 'rectangle',
        cssClass: 'interaction-node',
        defaultSize: { width: 150, height: 60 }
      }
    }
  ],
  diagrammingEnabled: true,
  diagramTypes: [
    {
      id: 'actone-overview',
      displayName: 'ActOne Overview',
      fileType: 'Story',
      nodeTypes: [
        { glspType: 'node:story', creatable: true, showable: true },
        { glspType: 'node:character', creatable: true, showable: true },
        { glspType: 'node:world', creatable: true, showable: true },
        { glspType: 'node:scene', creatable: true, showable: true },
        { glspType: 'node:plot', creatable: true, showable: true },
        { glspType: 'node:interaction', creatable: true, showable: true }
      ],
      edgeTypes: [
        { glspType: 'edge:relationship', creatable: true, showable: true },
        { glspType: 'edge:participates', creatable: true, showable: true },
        { glspType: 'edge:sequence', creatable: true, showable: true }
      ],
      toolPalette: {
        groups: [
          {
            id: 'narrative',
            label: 'Narrative',
            items: [
              {
                id: 'create-story',
                label: 'Story',
                icon: 'book',
                action: { type: 'create-node', glspType: 'node:story' }
              },
              {
                id: 'create-plot',
                label: 'Plot',
                icon: 'git-merge',
                action: { type: 'create-node', glspType: 'node:plot' }
              },
              {
                id: 'create-scene',
                label: 'Scene',
                icon: 'symbol-event',
                action: { type: 'create-node', glspType: 'node:scene' }
              }
            ]
          },
          {
            id: 'entities',
            label: 'Entities',
            items: [
              {
                id: 'create-character',
                label: 'Character',
                icon: 'person',
                action: { type: 'create-node', glspType: 'node:character' }
              },
              {
                id: 'create-world',
                label: 'World',
                icon: 'globe',
                action: { type: 'create-node', glspType: 'node:world' }
              },
              {
                id: 'create-interaction',
                label: 'Interaction',
                icon: 'comment-discussion',
                action: { type: 'create-node', glspType: 'node:interaction' }
              }
            ]
          },
          {
            id: 'connections',
            label: 'Connections',
            items: [
              {
                id: 'create-relationship',
                label: 'Relationship',
                icon: 'link',
                action: { type: 'create-edge', glspType: 'edge:relationship' }
              },
              {
                id: 'create-participates',
                label: 'Participates',
                icon: 'arrow-right',
                action: { type: 'create-edge', glspType: 'edge:participates' }
              },
              {
                id: 'create-sequence',
                label: 'Sequence',
                icon: 'arrow-down',
                action: { type: 'create-edge', glspType: 'edge:sequence' }
              }
            ]
          }
        ]
      }
    }
  ]
};
