/**
 * Properties Panel Widget (T032, T035, T036, FR-009 to FR-013)
 *
 * Theia widget that displays editable properties for selected diagram elements.
 *
 * @packageDocumentation
 */

import { createLogger } from '@sanyam/logger';
import { injectable, inject, postConstruct } from 'inversify';
import { BaseWidget, Message } from '@theia/core/lib/browser';
import { Emitter, Event, DisposableCollection } from '@theia/core/lib/common';
import {
  PROPERTIES_PANEL_ID,
  type GlspPropertyDescriptor,
  type GetPropertiesResponse,
  type SanyamGlspService,
  SanyamGlspService as SanyamGlspServiceSymbol,
} from '@sanyam/types';

import { PropertyFormClasses, formatPropertyValue, parsePropertyValue, getInputType, validatePropertyValue, isMixedValue } from './property-utils';

/**
 * Properties panel widget options.
 */
export interface PropertiesPanelOptions {
  /** Title for the panel */
  title?: string;
}

/**
 * Properties Panel Widget.
 *
 * Shows editable properties for selected diagram elements.
 * Updates automatically when selection changes.
 */
@injectable()
export class PropertiesPanelWidget extends BaseWidget {
  static readonly ID = PROPERTIES_PANEL_ID;

  protected readonly logger = createLogger({ name: 'PropertiesPanel' });

  /** Current document URI */
  protected currentUri: string | undefined;

  /** Currently selected element IDs */
  protected selectedIds: string[] = [];

  /** Current properties */
  protected properties: GlspPropertyDescriptor[] = [];

  /** Type label for current selection */
  protected typeLabel: string = '';

  /** Whether loading */
  protected loading: boolean = false;

  /** Error message */
  protected error: string | undefined;

  /** Disposables */
  protected readonly toDispose = new DisposableCollection();

  /** Property changed emitter */
  protected readonly onPropertyChangedEmitter = new Emitter<{
    property: string;
    value: unknown;
    elementIds: string[];
  }>();

  /** Property changed event */
  readonly onPropertyChanged: Event<{
    property: string;
    value: unknown;
    elementIds: string[];
  }> = this.onPropertyChangedEmitter.event;

  @inject(SanyamGlspServiceSymbol)
  protected readonly glspService: SanyamGlspService;

  constructor() {
    super();
    this.id = PropertiesPanelWidget.ID;
    this.title.label = 'Properties';
    this.title.caption = 'Element Properties';
    this.title.iconClass = 'codicon codicon-symbol-property';
    this.title.closable = true;
    this.addClass(PropertyFormClasses.CONTAINER);

    this.toDispose.push(this.onPropertyChangedEmitter);
  }

  @postConstruct()
  protected init(): void {
    this.update();
  }

  /**
   * T035: Set selection from diagram widget or other sources.
   *
   * @param uri - Document URI
   * @param elementIds - Selected element IDs
   * @param source - Source of selection change
   */
  async setSelection(
    uri: string,
    elementIds: string[],
    source: 'diagram' | 'outline' | 'textEditor' | 'explorer' | 'propertiesPanel' = 'diagram'
  ): Promise<void> {
    // Avoid redundant updates from our own changes
    if (source === 'propertiesPanel') {
      return;
    }

    this.currentUri = uri;
    this.selectedIds = elementIds;

    if (elementIds.length === 0) {
      this.properties = [];
      this.typeLabel = 'No selection';
      this.error = undefined;
      this.update();
      return;
    }

    await this.loadProperties();
  }

  /**
   * T039a: Set selection from explorer.
   */
  async setExplorerSelection(uri: string, elementIds: string[]): Promise<void> {
    await this.setSelection(uri, elementIds, 'explorer');
  }

  /**
   * Load properties from the server.
   */
  protected async loadProperties(): Promise<void> {
    if (!this.currentUri || this.selectedIds.length === 0) {
      return;
    }

    this.loading = true;
    this.error = undefined;
    this.update();

    try {
      const response: GetPropertiesResponse = await this.glspService.getProperties(
        this.currentUri,
        this.selectedIds
      );

      if (response.success) {
        this.properties = response.properties;
        this.typeLabel = response.typeLabel;
        this.error = undefined;
      } else {
        this.properties = [];
        this.typeLabel = 'Error';
        this.error = response.error || 'Failed to load properties';
      }
    } catch (err) {
      this.properties = [];
      this.typeLabel = 'Error';
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.loading = false;
      this.update();
    }
  }

  /**
   * T036: Handle property value change.
   */
  protected async handlePropertyChange(property: string, value: unknown): Promise<void> {
    if (!this.currentUri || this.selectedIds.length === 0) {
      return;
    }

    try {
      const response = await this.glspService.updateProperty(
        this.currentUri,
        this.selectedIds,
        property,
        value
      );

      if (response.success) {
        // Update local state
        const prop = this.properties.find(p => p.name === property);
        if (prop) {
          (prop as any).value = value;
        }

        // Emit change event
        this.onPropertyChangedEmitter.fire({
          property,
          value,
          elementIds: this.selectedIds,
        });

        this.update();
      } else {
        this.logger.error({ error: response.error }, 'Failed to update property');
      }
    } catch (err) {
      this.logger.error({ err }, 'Error updating property');
    }
  }

  /**
   * Refresh properties.
   */
  async refresh(): Promise<void> {
    await this.loadProperties();
  }

  /**
   * Render the widget content.
   */
  protected onUpdateRequest(msg: Message): void {
    super.onUpdateRequest(msg);
    this.render();
  }

  /**
   * T075c: Render the properties form with performance logging.
   */
  protected render(): void {
    const startTime = performance.now();

    // Clear existing content
    this.node.innerHTML = '';

    // Header with ARIA
    const header = document.createElement('div');
    header.className = PropertyFormClasses.HEADER;
    header.setAttribute('role', 'heading');
    header.setAttribute('aria-level', '2');
    header.innerHTML = `<span>${this.escapeHtml(this.typeLabel)}</span>`;
    this.node.appendChild(header);

    // Content with ARIA
    const content = document.createElement('div');
    content.className = PropertyFormClasses.CONTENT;
    content.setAttribute('role', 'form');
    content.setAttribute('aria-label', 'Element properties');

    if (this.loading) {
      content.innerHTML = `<div class="${PropertyFormClasses.LOADING}" role="status" aria-live="polite">Loading...</div>`;
    } else if (this.error) {
      content.innerHTML = `<div class="${PropertyFormClasses.EMPTY}" role="alert">${this.escapeHtml(this.error)}</div>`;
    } else if (this.properties.length === 0) {
      content.innerHTML = `<div class="${PropertyFormClasses.EMPTY}" role="status">No editable properties</div>`;
    } else {
      // Render property fields
      for (const prop of this.properties) {
        content.appendChild(this.renderPropertyField(prop));
      }
    }

    this.node.appendChild(content);

    // T070b: Auto-focus first field on selection change
    this.focusFirstField();

    // T075c: Log render performance
    const duration = performance.now() - startTime;
    if (duration > 100) {
      this.logger.warn({ durationMs: duration.toFixed(2) }, 'Render took longer than target (<100ms)');
    } else {
      this.logger.info({ durationMs: duration.toFixed(2) }, 'Render completed');
    }
  }

  /**
   * T070b: Focus the first editable field after selection changes.
   */
  protected focusFirstField(): void {
    // Use setTimeout to ensure DOM is updated
    setTimeout(() => {
      const firstInput = this.node.querySelector<HTMLInputElement | HTMLSelectElement>(
        `.${PropertyFormClasses.INPUT}, .${PropertyFormClasses.CHECKBOX}, .${PropertyFormClasses.SELECT}`
      );
      if (firstInput && !firstInput.disabled) {
        firstInput.focus();
      }
    }, 0);
  }

  /**
   * T070: Render a single property field with aria-labels.
   */
  protected renderPropertyField(prop: GlspPropertyDescriptor): HTMLElement {
    const field = document.createElement('div');
    field.className = PropertyFormClasses.FIELD;

    // Generate unique ID for accessibility linking
    const inputId = `prop-${prop.name}-${Date.now()}`;

    // Label with for attribute
    const label = document.createElement('label');
    label.className = PropertyFormClasses.LABEL;
    label.textContent = prop.label;
    label.title = prop.description || prop.name;
    label.setAttribute('for', inputId);
    field.appendChild(label);

    // Input with aria-label
    let input: HTMLElement;

    if (prop.type === 'boolean') {
      input = this.createCheckboxInput(prop, inputId);
    } else if (prop.type === 'enum' && prop.options) {
      input = this.createSelectInput(prop, inputId);
    } else {
      input = this.createTextInput(prop, inputId);
    }

    field.appendChild(input);

    return field;
  }

  /**
   * T070, T070a: Create text input for property with accessibility.
   */
  protected createTextInput(prop: GlspPropertyDescriptor, inputId: string): HTMLInputElement {
    const input = document.createElement('input');
    input.id = inputId;
    input.className = PropertyFormClasses.INPUT;
    input.type = getInputType(prop.type);
    input.value = formatPropertyValue(prop.value, prop.type);
    input.disabled = prop.readOnly === true;
    input.placeholder = isMixedValue(prop) ? '(Mixed values)' : '';

    // T070: Accessibility attributes
    input.setAttribute('aria-label', prop.label);
    if (prop.description) {
      input.setAttribute('aria-describedby', `${inputId}-desc`);
    }

    // Handle blur to commit changes
    input.addEventListener('blur', () => {
      const error = validatePropertyValue(input.value, prop);
      if (error) {
        input.classList.add(PropertyFormClasses.INPUT_ERROR);
        input.title = error;
        input.setAttribute('aria-invalid', 'true');
      } else {
        input.classList.remove(PropertyFormClasses.INPUT_ERROR);
        input.title = '';
        input.removeAttribute('aria-invalid');
        const parsedValue = parsePropertyValue(input.value, prop.type);
        if (parsedValue !== prop.value) {
          this.handlePropertyChange(prop.name, parsedValue);
        }
      }
    });

    // T070a: Handle Enter key to commit, Escape to cancel
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        input.blur();
      } else if (e.key === 'Escape') {
        input.value = formatPropertyValue(prop.value, prop.type);
        input.removeAttribute('aria-invalid');
      }
    });

    return input;
  }

  /**
   * T070: Create checkbox input for boolean property with accessibility.
   */
  protected createCheckboxInput(prop: GlspPropertyDescriptor, inputId: string): HTMLInputElement {
    const input = document.createElement('input');
    input.id = inputId;
    input.className = PropertyFormClasses.CHECKBOX;
    input.type = 'checkbox';
    input.checked = prop.value === true;
    input.disabled = prop.readOnly === true;
    input.indeterminate = isMixedValue(prop);

    // T070: Accessibility attributes
    input.setAttribute('aria-label', prop.label);
    input.setAttribute('aria-checked', String(input.checked));

    input.addEventListener('change', () => {
      input.setAttribute('aria-checked', String(input.checked));
      this.handlePropertyChange(prop.name, input.checked);
    });

    return input;
  }

  /**
   * T070: Create select input for enum property with accessibility.
   */
  protected createSelectInput(prop: GlspPropertyDescriptor, inputId: string): HTMLSelectElement {
    const select = document.createElement('select');
    select.id = inputId;
    select.className = PropertyFormClasses.SELECT;
    select.disabled = prop.readOnly === true;

    // T070: Accessibility attributes
    select.setAttribute('aria-label', prop.label);

    // Add placeholder for mixed values
    if (isMixedValue(prop)) {
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = '(Mixed values)';
      placeholder.disabled = true;
      placeholder.selected = true;
      select.appendChild(placeholder);
    }

    // Add options
    for (const option of prop.options || []) {
      const opt = document.createElement('option');
      opt.value = option;
      opt.textContent = option;
      opt.selected = prop.value === option;
      select.appendChild(opt);
    }

    select.addEventListener('change', () => {
      this.handlePropertyChange(prop.name, select.value);
    });

    return select;
  }

  /**
   * Escape HTML to prevent XSS.
   */
  protected escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Clear the panel.
   */
  clear(): void {
    this.currentUri = undefined;
    this.selectedIds = [];
    this.properties = [];
    this.typeLabel = 'No selection';
    this.error = undefined;
    this.update();
  }

  /**
   * Dispose the widget.
   */
  dispose(): void {
    this.toDispose.dispose();
    super.dispose();
  }
}
