const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Offset of Europe/London from UTC in minutes at the given instant.
 * Positive = ahead of UTC (BST is +60, GMT is 0).
 */
export function londonOffsetMinutes(utc: Date): number {
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(utc);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return (asUtc - utc.getTime()) / 60000;
}

/**
 * UTC instant of the decision cutoff for a UTC delivery date:
 * the preceding day (D-1) at `hour:minute` Europe/London local time,
 * converted to UTC using the zone's offset on that day (GMT/BST aware).
 */
export function cutoffUtcIso(
  deliveryDateUtc: string,
  hour: number,
  minute: number,
): string {
  const dMinus1 = new Date(`${deliveryDateUtc}T00:00:00Z`);
  dMinus1.setUTCDate(dMinus1.getUTCDate() - 1);
  const wall = `${dMinus1.getUTCFullYear()}-${pad2(dMinus1.getUTCMonth() + 1)}-${pad2(dMinus1.getUTCDate())}T${pad2(hour)}:${pad2(minute)}:00Z`;
  // Treat the London wall-clock time as if it were UTC, then shift by the
  // zone offset to find the true UTC instant.
  const guess = new Date(wall);
  let result = new Date(guess.getTime() - londonOffsetMinutes(guess) * 60000);
  // One refinement handles instants adjacent to a DST transition.
  result = new Date(guess.getTime() - londonOffsetMinutes(result) * 60000);
  return result.toISOString();
}

/** Settlement period start time (UTC ISO) for a settlement date and 1-based period. */
export function periodStartUtc(settlementDate: string, period: number): string {
  const hour = Math.floor((period - 1) / 2);
  const minute = period % 2 === 1 ? 0 : 30;
  return `${settlementDate}T${pad2(hour)}:${pad2(minute)}:00Z`;
}

/** Settlement date (UTC calendar day) of an ISO UTC timestamp. */
export function settlementDateOf(isoUtc: string): string {
  return isoUtc.slice(0, 10);
}

/** Settlement period (1..48) of an ISO UTC timestamp on its UTC calendar day. */
export function settlementPeriodOf(isoUtc: string): number {
  const hour = Number(isoUtc.slice(11, 13));
  const minute = Number(isoUtc.slice(14, 16));
  return hour * 2 + (minute >= 30 ? 2 : 1);
}
