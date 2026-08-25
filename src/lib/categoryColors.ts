// Single source of truth for category colors — used app-wide (sidebar, chart tabs, chart
// bars, badges) so every category has ONE consistent color everywhere.
export const CATEGORY_COLOR: Record<string, string> = {
  questions:          '#3b82f6', // blue
  requests:           '#22c55e', // green
  claims:             '#f59e0b', // amber
  predictions:        '#8b5cf6', // violet
  namedEntities:      '#06b6d4', // cyan
  brackets:           '#ef4444', // red
  themes:             '#6366f1', // indigo
  impliedConclusions: '#f97316', // orange
  verificationHooks:  '#d946ef', // fuchsia
  overlaps:           '#eab308', // gold
  questionsAll:       '#3b82f6',
}

export function catColor(key: string): string {
  return CATEGORY_COLOR[key] ?? '#9ca3af'
}

// Chart series DISPLAY name → color. Recharts hands a tooltip the `name` prop from each
// <Bar>, not its data key, so tooltips need this second lookup to tint a row the same
// colour as the bar it describes. Derived from CATEGORY_COLOR above so the two can never
// drift; aliases are listed because different charts label the same series differently.
export const SERIES_COLOR: Record<string, string> = {
  'Q Posts':              '#9ca3af',
  'Posts':                '#9ca3af',
  'Questions':            CATEGORY_COLOR.questions,
  'Q Questions':          CATEGORY_COLOR.questions,
  'Requests':             CATEGORY_COLOR.requests,
  'Directives':           CATEGORY_COLOR.requests,
  'Q Directives':           CATEGORY_COLOR.requests,
  'Claims':               CATEGORY_COLOR.claims,
  'Predictions':          CATEGORY_COLOR.predictions,
  'Named Entities':       CATEGORY_COLOR.namedEntities,
  'Themes':               CATEGORY_COLOR.themes,
  'Brackets':             CATEGORY_COLOR.brackets,
  'brackets':             CATEGORY_COLOR.brackets,

  // The chart tab labels (CHART_TABS in PostArchive) — the names the single-category chart
  // and the phone readout actually pass in. Only 'Q Questions', 'Q Directives' and
  // 'Checkable Claims' happened to be listed above, so those three were the ONLY series
  // that came out coloured; everything else fell through to the grey default.
  'Q Claims':             CATEGORY_COLOR.claims,
  'Q Predictions':        CATEGORY_COLOR.predictions,
  'Q Entities':           CATEGORY_COLOR.namedEntities,
  'Q Themes':             CATEGORY_COLOR.themes,
  'Q [ Brackets ]':       CATEGORY_COLOR.brackets,
}

/** Colour for a chart series by its display name; grey when unknown. */
export function seriesColor(name: string): string {
  return SERIES_COLOR[name] ?? '#9ca3af'
}
