/**
 * Survey Model Converter
 *
 * Converts GlspPropertyDescriptor arrays into SurveyJS JSON model
 * definitions for rendering in the properties panel.
 *
 * Supports scalar fields, arrays (rendered as paneldynamic),
 * and nested objects (rendered as panels).
 *
 * @packageDocumentation
 */

import type { GlspPropertyDescriptor } from '@sanyam/types';
import { groupProperties } from './property-utils';

/**
 * SurveyJS question JSON definition.
 */
interface SurveyQuestion {
  type: string;
  name: string;
  title: string;
  description?: string;
  defaultValue?: unknown;
  readOnly?: boolean;
  inputType?: string;
  choices?: string[];
  /** For paneldynamic: template elements for each panel row */
  templateElements?: SurveyElement[];
  /** For paneldynamic: number of panels (array length) */
  panelCount?: number;
  /** For paneldynamic: minimum number of panels */
  minPanelCount?: number;
  /** For panel: nested question elements */
  elements?: SurveyElement[];
}

/**
 * SurveyJS panel JSON definition.
 */
interface SurveyPanel {
  type: 'panel';
  name: string;
  title: string;
  elements: SurveyElement[];
}

/**
 * Union type for any SurveyJS element.
 */
type SurveyElement = SurveyQuestion | SurveyPanel;

/**
 * SurveyJS model JSON definition.
 */
export interface SurveyModelJson {
  showQuestionNumbers: string;
  showNavigationButtons: string;
  showCompletedPage: boolean;
  pages: Array<{
    name: string;
    elements: SurveyElement[];
  }>;
}

/**
 * Convert a GlspPropertyDescriptor to a SurveyJS question definition.
 * Handles scalar types, arrays (paneldynamic), and nested objects (panel).
 *
 * @param prop - Property descriptor
 * @returns SurveyJS question JSON
 */
function toSurveyQuestion(prop: GlspPropertyDescriptor): SurveyQuestion {
  const base: SurveyQuestion = {
    type: 'text',
    name: prop.name,
    title: prop.label,
    readOnly: prop.readOnly,
  };

  if (prop.description) {
    base.description = prop.description;
  }

  switch (prop.type) {
    case 'string':
      base.type = 'text';
      if (prop.value !== undefined) {
        base.defaultValue = prop.value;
      }
      break;

    case 'number':
      base.type = 'text';
      base.inputType = 'number';
      if (prop.value !== undefined) {
        base.defaultValue = prop.value;
      }
      break;

    case 'boolean':
      base.type = 'boolean';
      if (prop.value !== undefined) {
        base.defaultValue = prop.value;
      }
      break;

    case 'enum':
      base.type = 'dropdown';
      base.choices = prop.options ? [...prop.options] : [];
      if (prop.value !== undefined) {
        base.defaultValue = prop.value;
      }
      break;

    case 'reference':
      base.type = 'dropdown';
      base.choices = prop.referenceTypes
        ? [...prop.referenceTypes]
        : prop.options
          ? [...prop.options]
          : [];
      if (prop.value !== undefined) {
        base.defaultValue = prop.value;
      }
      break;

    case 'array': {
      // Render as paneldynamic — each array element becomes one panel row
      base.type = 'paneldynamic';
      const arrayValue = Array.isArray(prop.value) ? prop.value : [];
      base.panelCount = arrayValue.length;
      base.minPanelCount = 0;

      // Convert children descriptors to template elements
      if (prop.children && prop.children.length > 0) {
        base.templateElements = prop.children.map(toSurveyQuestion);
      } else {
        base.templateElements = [];
      }
      break;
    }

    case 'object': {
      // Render as panel — nested fields shown in a collapsible group
      base.type = 'panel';
      if (prop.children && prop.children.length > 0) {
        base.elements = prop.children.map(toSurveyQuestion);
      } else {
        base.elements = [];
      }
      break;
    }

    default:
      base.type = 'text';
      if (prop.value !== undefined) {
        base.defaultValue = prop.value;
      }
  }

  return base;
}

/**
 * Convert an array of GlspPropertyDescriptors to a SurveyJS JSON model.
 *
 * Groups properties using the groupProperties() utility, mapping each
 * group to a SurveyJS panel. Single-group scenarios emit questions
 * directly without a wrapping panel.
 *
 * @param properties - Property descriptors from the backend
 * @param typeLabel - Type label for display (e.g., "Entity")
 * @returns SurveyJS model JSON ready for `new Model(json)`
 */
export function toSurveyModel(
  properties: GlspPropertyDescriptor[],
  typeLabel: string
): SurveyModelJson {
  const groups = groupProperties(properties);
  const elements: SurveyElement[] = [];

  if (groups.size <= 1) {
    // Single group or no groups — emit questions directly
    for (const prop of properties) {
      elements.push(toSurveyQuestion(prop));
    }
  } else {
    // Multiple groups — wrap in panels
    for (const [groupName, groupProps] of groups) {
      elements.push({
        type: 'panel',
        name: `group-${groupName}`,
        title: groupName,
        elements: groupProps.map(toSurveyQuestion),
      });
    }
  }

  return {
    showQuestionNumbers: 'off',
    showNavigationButtons: 'none',
    showCompletedPage: false,
    pages: [{
      name: typeLabel,
      elements,
    }],
  };
}
