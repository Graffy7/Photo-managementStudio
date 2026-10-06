// The device's own calendar day as "yyyy-mm-dd". Not toISOString(): that's the UTC date, which in India
// is still "yesterday" until 05:30 in the morning.
export function localDateString(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
