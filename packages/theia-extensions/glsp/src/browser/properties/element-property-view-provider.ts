/**
 * Element Property View Widget Provider
 *
 * PropertyViewWidgetProvider that returns the ElementPropertyViewFormWidget
 * for ElementPropertySelection objects.
 *
 * @packageDocumentation
 */

import { createLogger } from '@sanyam/logger';
import { injectable, inject } from 'inversify';
import type { PropertyViewWidgetProvider } from '@theia/property-view/lib/browser/property-view-widget-provider';
import type { PropertyViewContentWidget } from '@theia/property-view/lib/browser/property-view-content-widget';
import { ElementPropertySelection } from './element-selection';
import { ElementPropertyDataService } from './element-property-data-service';
import { ElementPropertyViewFormWidget } from './element-property-view-widget';

/**
 * Provides the element property form widget for diagram element selections.
 */
@injectable()
export class ElementPropertyViewWidgetProvider implements PropertyViewWidgetProvider {
  readonly id = 'element-property-view-provider';
  readonly label = 'Element Properties';
  protected readonly logger = createLogger({ name: 'ElementPropertyViewProvider' });

  @inject(ElementPropertyDataService)
  protected readonly dataService: ElementPropertyDataService;

  @inject(ElementPropertyViewFormWidget)
  protected readonly formWidget: ElementPropertyViewFormWidget;

  /**
   * Return a high priority for ElementPropertySelection.
   *
   * @param selection - Current selection
   * @returns Priority number
   */
  canHandle(selection: Object | undefined): number {
    const result = ElementPropertySelection.is(selection) ? 100 : 0;
    this.logger.debug({ isElementSelection: ElementPropertySelection.is(selection), result, selectionKind: (selection as any)?.kind }, 'canHandle');
    return result;
  }

  /**
   * Return the form widget, updating its content.
   *
   * @param selection - Current selection
   * @returns The form content widget
   */
  async provideWidget(selection: Object | undefined): Promise<PropertyViewContentWidget> {
    this.logger.debug({ selectionKind: (selection as any)?.kind, formWidgetId: this.formWidget.id }, 'provideWidget');
    this.formWidget.updatePropertyViewContent(this.dataService, selection);
    return this.formWidget;
  }

  /**
   * Update the content widget with new selection data.
   *
   * @param selection - Current selection
   */
  updateContentWidget(selection: Object | undefined): void {
    this.formWidget.updatePropertyViewContent(this.dataService, selection);
  }
}
