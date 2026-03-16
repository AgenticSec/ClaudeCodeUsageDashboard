// --- Period filter ---
export const PERIOD_OPTIONS = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 0, label: "All" },
] as const;

export const DEFAULT_DAYS = 7;

// --- Chart dimensions ---
export const CHART_HEIGHT = 300;
export const CHART_HEIGHT_LARGE = 350;

// --- Date formatting ---
/** Slice index to extract "MM-DD" from "YYYY-MM-DD" */
export const DATE_MM_DD_SLICE_START = 5;
