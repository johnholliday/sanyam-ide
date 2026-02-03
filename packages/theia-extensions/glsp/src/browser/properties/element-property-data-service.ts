/**
 * Element Property Data Service
 *
 * PropertyDataService implementation that provides property data
 * for ElementPropertySelection objects via the GLSP backend service.
 *
 * @packageDocumentation
 */

import { injectable, inject } from 'inversify';
import type { PropertyDataService } from '@theia/property-view/lib/browser/property-data-service';
import {
  type GetPropertiesResponse,
  SanyamGlspService as SanyamGlspServiceSymbol,
  type SanyamGlspServiceInterface,
} from '@sanyam/types';
import { ElementPropertySelection } from './element-selection';

/**
 * Provides property data for diagram element selections.
 *
 * Registered as a PropertyDataService contribution so the Theia
 * property view framework discovers it automatically.
 */
@injectable()
export class ElementPropertyDataService implements PropertyDataService {
  readonly id = 'element-properties';
  readonly label = 'Element Properties';

  @inject(SanyamGlspServiceSymbol)
  protected readonly glspService: SanyamGlspServiceInterface;

  /**
   * Return a high priority for ElementPropertySelection, zero otherwise.
   *
   * @param selection - Current selection from SelectionService
   * @returns Priority number
   */
  canHandleSelection(selection: Object | undefined): number {
    return ElementPropertySelection.is(selection) ? 100 : 0;
  }

  /**
   * Fetch properties from the GLSP backend for the selected elements.
   *
   * @param selection - Current selection
   * @returns Properties response or undefined
   */
  async providePropertyData(selection: Object | undefined): Promise<GetPropertiesResponse | undefined> {
    if (!ElementPropertySelection.is(selection)) {
      return undefined;
    }
    return this.glspService.getProperties(selection.uri, selection.elementIds);
  }
}
