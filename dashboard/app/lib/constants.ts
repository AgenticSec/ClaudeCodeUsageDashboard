// --- Period filter ---
export const PERIOD_OPTIONS = [
  { days: 7, label: "7日" },
  { days: 30, label: "30日" },
  { days: 0, label: "全期間" },
] as const;

export const DEFAULT_DAYS = 7;

// --- Chart dimensions ---
export const CHART_HEIGHT = 300;
export const CHART_HEIGHT_LARGE = 350;

// --- Date formatting ---
/** Slice index to extract "MM-DD" from "YYYY-MM-DD" */
export const DATE_MM_DD_SLICE_START = 5;
