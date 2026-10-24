export function fmtMW(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined) return "—";
  return `${value.toLocaleString("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function fmtSignedMW(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toLocaleString("en-GB", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}`;
}

export function fmtPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(digits)}%`;
}

/** "2026-01-05T14:00:00Z" -> "14:00" */
export function isoTime(iso: string): string {
  return `${iso.slice(11, 13)}:${iso.slice(14, 16)}`;
}

/** "2026-01-05T14:00:00Z" -> "05 Jan 2026, 14:00 UTC" */
export function isoDateTimeUtc(iso: string): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const day = Number(iso.slice(8, 10));
  const month = months[Number(iso.slice(5, 7)) - 1] ?? "";
  return `${String(day).padStart(2, "0")} ${month} ${iso.slice(0, 4)}, ${isoTime(iso)} UTC`;
}

/** "2026-01-05" -> "05 Jan" */
export function shortDate(dateIso: string): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const day = Number(dateIso.slice(8, 10));
  const month = months[Number(dateIso.slice(5, 7)) - 1] ?? "";
  return `${String(day).padStart(2, "0")} ${month}`;
}

export function leadTime(minutes: number): string {
  if (minutes >= 1440) {
    const d = Math.floor(minutes / 1440);
    const h = Math.round((minutes % 1440) / 60);
    return h === 0 ? `${d}d` : `${d}d ${h}h`;
  }
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }
  return `${minutes}m`;
}
