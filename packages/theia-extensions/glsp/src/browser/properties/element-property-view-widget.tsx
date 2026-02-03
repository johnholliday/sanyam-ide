/**
 * Element Property View Form Widget (SurveyJS + React)
 *
 * PropertyViewContentWidget that renders editable property fields
 * for selected diagram elements using SurveyJS inside a Theia ReactWidget.
 *
 * @packageDocumentation
 */

import * as React from 'react';
import { createLogger } from '@sanyam/logger';
import { injectable, inject } from 'inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import type { PropertyDataService } from '@theia/property-view/lib/browser/property-data-service';
import type { PropertyViewContentWidget } from '@theia/property-view/lib/browser/property-view-content-widget';
import { Model } from 'survey-core';
import { Survey } from 'survey-react-ui';
import {
  type GlspPropertyDescriptor,
  type GetPropertiesResponse,
  type SanyamGlspServiceInterface,
  SanyamGlspService as SanyamGlspServiceSymbol,
} from '@sanyam/types';
import { ElementPropertySelection } from './element-selection';
import { PropertyFormClasses } from './property-utils';
import { toSurveyModel } from './survey-model-converter';
import { applyTheiaTheme } from './surveyjs-theia-theme';

/** Debounce delay for property value changes (ms). */
const VALUE_CHANGE_DEBOUNCE_MS = 300;

/**
 * Form widget that renders editable properties for diagram elements
 * using SurveyJS within a Theia ReactWidget.
 *
 * Implements Theia's PropertyViewContentWidget interface.
 */
@injectable()
export class ElementPropertyViewFormWidget extends ReactWidget implements PropertyViewContentWidget {
  static readonly ID = 'element-property-view-form';

  protected readonly logger = createLogger({ name: 'ElementPropertyForm' });

  /** Current selection */
  protected currentSelection: ElementPropertySelection | undefined;

  /** Current properties */
  protected properties: GlspPropertyDescriptor[] = [];

  /** Type label for current selection */
  protected typeLabel: string = '';

  /** Whether loading */
  protected loading: boolean = false;

  /** Error message */
  protected error: string | undefined;

  /** Current SurveyJS model instance */
  protected surveyModel: Model | undefined;

  /** Debounce timer for value changes */
  protected debounceTimer: ReturnType<typeof setTimeout> | undefined;

  @inject(SanyamGlspServiceSymbol)
  protected readonly glspService: SanyamGlspServiceInterface;

  constructor() {
    super();
    this.id = ElementPropertyViewFormWidget.ID;
    this.addClass(PropertyFormClasses.CONTAINER);
  }

  /**
   * Called by the property view framework when selection changes.
   *
   * @param propertyDataService - The data service that matched the selection
   * @param selection - The current selection object
   */
  updatePropertyViewContent(propertyDataService?: PropertyDataService, selection?: Object): void {
    this.logger.debug({ isElementSelection: ElementPropertySelection.is(selection), selectionKind: (selection as Record<string, unknown>)?.kind, hasDataService: !!propertyDataService }, 'updatePropertyViewContent');
    if (!ElementPropertySelection.is(selection)) {
      this.currentSelection = undefined;
      this.properties = [];
      this.typeLabel = 'No selection';
      this.error = undefined;
      this.surveyModel = undefined;
      this.update();
      return;
    }

    this.currentSelection = selection;
    void this.loadProperties(propertyDataService, selection);
  }

  /**
   * Load properties via the data service.
   */
  protected async loadProperties(
    propertyDataService: PropertyDataService | undefined,
    selection: ElementPropertySelection
  ): Promise<void> {
    this.loading = true;
    this.error = undefined;
    this.surveyModel = undefined;
    this.update();

    try {
      let response: GetPropertiesResponse | undefined;
      if (propertyDataService) {
        response = await propertyDataService.providePropertyData(selection) as GetPropertiesResponse | undefined;
      } else {
        response = await this.glspService.getProperties(selection.uri, selection.elementIds);
      }

      this.logger.debug({ success: response?.success, propertyCount: response?.properties?.length, typeLabel: response?.typeLabel, error: response?.error }, 'loadProperties response');

      if (response && response.success) {
        this.properties = response.properties;
        this.typeLabel = response.typeLabel;
        this.error = undefined;
        this.buildSurveyModel();
      } else {
        this.properties = [];
        this.typeLabel = 'Error';
        this.error = response?.error || 'Failed to load properties';
        this.surveyModel = undefined;
      }
    } catch (err) {
      this.properties = [];
      this.typeLabel = 'Error';
      this.error = err instanceof Error ? err.message : String(err);
      this.surveyModel = undefined;
    } finally {
      this.loading = false;
      this.update();
    }
  }

  /**
   * Build a SurveyJS Model from the current properties.
   * The model is stored as an instance field so it persists across re-renders
   * (avoiding recreation on every React render cycle).
   */
  protected buildSurveyModel(): void {
    if (this.properties.length === 0) {
      this.surveyModel = undefined;
      return;
    }

    const json = toSurveyModel(this.properties, this.typeLabel);
    const model = new Model(json);
    applyTheiaTheme(model);

    // Set current values.
    // For object-type properties, flatten children into the data namespace
    // using their prefixed names (e.g. "roles.roles") to avoid key collisions
    // in SurveyJS's flat model.data namespace.
    const data: Record<string, unknown> = {};
    const flattenProperties = (props: GlspPropertyDescriptor[]): void => {
      for (const prop of props) {
        if (prop.value === undefined) {
          continue;
        }
        if (prop.type === 'object' && prop.children && prop.children.length > 0) {
          // Recurse into children — they already have prefixed names from the backend
          flattenProperties(prop.children);
        } else {
          data[prop.name] = prop.value;
        }
      }
    };
    flattenProperties(this.properties);
    model.data = data;

    // Handle scalar value changes with debounce.
    // Suppress onValueChanged for paneldynamic questions — those are handled
    // by onDynamicPanelItemValueChanged for surgical dot-path updates.
    model.onValueChanged.add((_sender, options) => {
      const question = options.question;
      if (question && question.getType() === 'paneldynamic') {
        return; // Handled by onDynamicPanelItemValueChanged
      }
      this.debouncedPropertyChange(options.name, options.value);
    });

    // Handle individual field changes within paneldynamic (array) questions.
    // Constructs a dot-path like "scores[2].notes" for surgical backend updates.
    model.onDynamicPanelItemValueChanged.add((_sender, options) => {
      const questionName = options.question.name;
      const panelIndex = options.panelIndex;
      const fieldName = options.name;
      const propertyPath = `${questionName}[${panelIndex}].${fieldName}`;
      this.debouncedPropertyChange(propertyPath, options.value);
    });

    this.surveyModel = model;
  }

  /**
   * Debounced handler for property value changes.
   * Avoids flooding the backend during rapid edits.
   */
  protected debouncedPropertyChange(property: string, value: unknown): void {
    if (this.debounceTimer !== undefined) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = undefined;
      void this.handlePropertyChange(property, value);
    }, VALUE_CHANGE_DEBOUNCE_MS);
  }

  /**
   * Handle property value change — send to backend.
   */
  protected async handlePropertyChange(property: string, value: unknown): Promise<void> {
    if (!this.currentSelection) {
      return;
    }

    try {
      const response = await this.glspService.updateProperty(
        this.currentSelection.uri,
        this.currentSelection.elementIds,
        property,
        value
      );

      if (response.success) {
        const prop = this.properties.find(p => p.name === property);
        if (prop) {
          (prop as unknown as Record<string, unknown>).value = value;
        }
      } else {
        this.logger.error({ error: response.error }, 'Failed to update property');
      }
    } catch (err) {
      this.logger.error({ err }, 'Error updating property');
    }
  }

  /**
   * Render the React component tree.
   */
  protected render(): React.ReactNode {
    return (
      <div className={PropertyFormClasses.CONTAINER}>
        <div className={PropertyFormClasses.HEADER} role="heading" aria-level={2}>
          <span>{this.typeLabel}</span>
        </div>
        <div role="form" aria-label="Element properties">
          {this.renderContent()}
        </div>
      </div>
    );
  }

  /**
   * Render the form content based on current state.
   */
  protected renderContent(): React.ReactNode {
    if (this.loading) {
      return (
        <div className={PropertyFormClasses.LOADING} role="status" aria-live="polite">
          Loading...
        </div>
      );
    }

    if (this.error) {
      return (
        <div className={PropertyFormClasses.EMPTY} role="alert">
          {this.error}
        </div>
      );
    }

    if (this.properties.length === 0 || !this.surveyModel) {
      return (
        <div className={PropertyFormClasses.EMPTY} role="status">
          No editable properties
        </div>
      );
    }

    return <Survey model={this.surveyModel} />;
  }
}
