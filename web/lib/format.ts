/** Small formatting helpers shared across the UI. */

export function formatDateTime(iso?: string): string {
  if (!iso) return "--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--";
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export function formatDate(iso?: string): string {
  if (!iso) return "--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** "in 3 hours" / "2 days ago" - used for next send times and run timestamps. */
export function relativeTime(iso?: string): string {
  if (!iso) return "--";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "--";
  const diff = then - Date.now();
  const abs = Math.abs(diff);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["second", 1000], ["minute", 60_000], ["hour", 3_600_000],
    ["day", 86_400_000], ["month", 2_592_000_000], ["year", 31_536_000_000],
  ];
  let unit: Intl.RelativeTimeFormatUnit = "second";
  let size = 1000;
  for (const [u, ms] of units) {
    if (abs >= ms) {
      unit = u;
      size = ms;
    }
  }
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  return rtf.format(Math.round(diff / size), unit);
}

export function duration(from?: string, to?: string): string {
  if (!from || !to) return "--";
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (Number.isNaN(ms) || ms < 0) return "--";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

export function initials(person: { name?: string; email: string }): string {
  const source = person.name?.trim() || person.email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").concat(parts[1]?.[0] ?? "").toUpperCase();
}

export function displayName(person: { name?: string; email: string }): string {
  return person.name?.trim() || person.email;
}

/** "meeting_booked" -> "Meeting booked" */
export function humanize(value: string): string {
  const spaced = value.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** 14 -> "2:00 PM", used by the sending-window pickers. */
export function formatHour(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const suffix = h < 12 ? "AM" : "PM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:00 ${suffix}`;
}

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
