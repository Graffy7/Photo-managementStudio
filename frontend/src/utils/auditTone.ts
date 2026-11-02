export type Tone = "good" | "bad" | "warn" | "neutral";

// Keyword-driven rather than a fixed action-string dictionary, since the audit trail now spans
// every module (Leads, Payments, Expenses, Lookups, ...) with many action strings that would
// otherwise need enumerating one by one. Order matters: the negative checks (deactivate, unassign,
// block-but-not-unblock) must run before the positive ones, since e.g. "deactivated" contains
// "activate" as a substring.
export function actionTone(action: string): Tone {
  const a = action.toLowerCase();

  if (a.includes("delete") || a.includes("cancel") || a.includes("reject") || a.includes("refund") || (a.includes("block") && !a.includes("unblock"))) {
    return "bad";
  }
  if (a.includes("deactivate") || a.includes("unassign")) {
    return "warn";
  }
  if (
    a.includes("create") || a.includes("activate") || a.includes("unblock") || a.includes("accept") ||
    a.includes("receiv") || a.includes("convert") || a.includes("assign") || a.includes("record") || a.includes("add")
  ) {
    return "good";
  }
  return "neutral";
}

export const TONE_COLORS: Record<Tone, string> = {
  good: "#16a36a",
  bad: "#ef4444",
  warn: "#f59e0b",
  neutral: "#6d4aff",
};
