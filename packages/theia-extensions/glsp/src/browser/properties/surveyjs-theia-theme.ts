/**
 * SurveyJS Theme for Theia Integration
 *
 * Provides a custom SurveyJS theme that uses Theia CSS variables
 * to match the IDE's look and feel in both light and dark modes.
 *
 * @packageDocumentation
 */

/**
 * SurveyJS theme CSS class overrides for Theia integration.
 *
 * These CSS classes are applied to SurveyJS elements to remap
 * styling to Theia's design system via CSS variables.
 */
export const theiaThemeCss = {
  root: 'sanyam-survey-root',
  container: 'sanyam-survey-container',
  header: 'sanyam-survey-header',
  body: 'sanyam-survey-body',
  bodyEmpty: 'sanyam-survey-body--empty',
  footer: 'sanyam-survey-footer',
  title: 'sanyam-survey-title',
  description: 'sanyam-survey-description',
  logo: 'sanyam-survey-logo',
  logoImage: 'sanyam-survey-logo-image',
  headerText: 'sanyam-survey-header-text',
  headerClose: 'sanyam-survey-header-close',
  navigationButton: 'sanyam-survey-nav-btn',
  completedPage: 'sanyam-survey-completed',
  navigation: {
    complete: 'sanyam-survey-nav-btn--complete',
    prev: 'sanyam-survey-nav-btn--prev',
    next: 'sanyam-survey-nav-btn--next',
    start: 'sanyam-survey-nav-btn--start',
    preview: 'sanyam-survey-nav-btn--preview',
    edit: 'sanyam-survey-nav-btn--edit',
  },
  panel: {
    title: 'sanyam-survey-panel-title',
    titleExpandable: 'sanyam-survey-panel-title--expandable',
    titleOnExpand: 'sanyam-survey-panel-title--expanded',
    titleOnError: 'sanyam-survey-panel-title--error',
    description: 'sanyam-survey-panel-description',
    container: 'sanyam-survey-panel-container',
    content: 'sanyam-survey-panel-content',
    icon: 'sanyam-survey-panel-icon',
    iconExpanded: 'sanyam-survey-panel-icon--expanded',
    footer: 'sanyam-survey-panel-footer',
    requiredText: 'sanyam-survey-panel-required',
    number: 'sanyam-survey-panel-number',
  },
  question: {
    mainRoot: 'sanyam-survey-question',
    flowRoot: 'sanyam-survey-question--flow',
    header: 'sanyam-survey-question-header',
    headerLeft: 'sanyam-survey-question-header--left',
    headerTop: 'sanyam-survey-question-header--top',
    headerBottom: 'sanyam-survey-question-header--bottom',
    content: 'sanyam-survey-question-content',
    contentLeft: 'sanyam-survey-question-content--left',
    titleLeftRoot: 'sanyam-survey-question-title-left',
    title: 'sanyam-survey-question-title',
    titleExpandable: 'sanyam-survey-question-title--expandable',
    number: 'sanyam-survey-question-number',
    description: 'sanyam-survey-question-description',
    comment: 'sanyam-survey-question-comment',
    required: 'sanyam-survey-question-required',
    titleRequired: 'sanyam-survey-question-title--required',
    hasError: 'sanyam-survey-question--error',
    indent: 20,
    footer: 'sanyam-survey-question-footer',
    formGroup: 'sanyam-survey-question-formgroup',
    hasErrorTop: 'sanyam-survey-question--error-top',
    hasErrorBottom: 'sanyam-survey-question--error-bottom',
    disabled: 'sanyam-survey-question--disabled',
    collapsed: 'sanyam-survey-question--collapsed',
    nested: 'sanyam-survey-question--nested',
  },
  error: {
    root: 'sanyam-survey-error',
    icon: 'sanyam-survey-error-icon',
    item: 'sanyam-survey-error-item',
    locationTop: 'sanyam-survey-error--top',
    locationBottom: 'sanyam-survey-error--bottom',
  },
  boolean: {
    root: 'sanyam-survey-boolean',
    rootChecked: 'sanyam-survey-boolean--checked',
    item: 'sanyam-survey-boolean-item',
    control: 'sanyam-survey-boolean-control',
    itemChecked: 'sanyam-survey-boolean-item--checked',
    itemIndeterminate: 'sanyam-survey-boolean-item--indeterminate',
    itemDisabled: 'sanyam-survey-boolean-item--disabled',
    switch: 'sanyam-survey-boolean-switch',
    slider: 'sanyam-survey-boolean-slider',
    label: 'sanyam-survey-boolean-label',
    disabledLabel: 'sanyam-survey-boolean-label--disabled',
    materialDecorator: 'sanyam-survey-boolean-decorator',
    itemDecorator: 'sanyam-survey-boolean-decorator-item',
    checkedPath: 'sanyam-survey-boolean-checked-path',
    uncheckedPath: 'sanyam-survey-boolean-unchecked-path',
    indeterminatePath: 'sanyam-survey-boolean-indeterminate-path',
  },
  text: {
    root: 'sanyam-survey-text',
    onError: 'sanyam-survey-text--error',
  },
  dropdown: {
    root: 'sanyam-survey-dropdown',
    control: 'sanyam-survey-dropdown-control',
    selectWrapper: 'sanyam-survey-dropdown-wrapper',
    other: 'sanyam-survey-dropdown-other',
    onError: 'sanyam-survey-dropdown--error',
    cleanButton: 'sanyam-survey-dropdown-clean-btn',
    cleanButtonSvg: 'sanyam-survey-dropdown-clean-svg',
    cleanButtonIconId: 'sanyam-survey-dropdown-clean-icon',
    filterStringInput: 'sanyam-survey-dropdown-filter',
  },
  checkbox: {
    root: 'sanyam-survey-checkbox',
    item: 'sanyam-survey-checkbox-item',
    itemChecked: 'sanyam-survey-checkbox-item--checked',
    itemInline: 'sanyam-survey-checkbox-item--inline',
    label: 'sanyam-survey-checkbox-label',
    labelChecked: 'sanyam-survey-checkbox-label--checked',
    itemControl: 'sanyam-survey-checkbox-control',
    itemDecorator: 'sanyam-survey-checkbox-decorator',
    controlLabel: 'sanyam-survey-checkbox-control-label',
    materialDecorator: 'sanyam-survey-checkbox-material-decorator',
    other: 'sanyam-survey-checkbox-other',
    column: 'sanyam-survey-checkbox-column',
  },
} as const;

/**
 * Apply the Theia theme to a SurveyJS model.
 *
 * Call this after creating a SurveyJS `Model` to set its CSS classes
 * to the Theia-compatible values.
 *
 * @param surveyModel - SurveyJS Model instance
 */
export function applyTheiaTheme(surveyModel: { css: Record<string, unknown> }): void {
  surveyModel.css = theiaThemeCss as unknown as Record<string, unknown>;
}
