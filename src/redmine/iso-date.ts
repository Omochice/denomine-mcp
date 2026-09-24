import type { IsoDate } from "./port.ts";

/**
 * Turns an ISO date (`YYYY-MM-DD`) into a `Date` at UTC midnight of that day.
 *
 * @throws {Error} when the calendar has no such day.
 */
export function toDate(value: IsoDate): Date {
  const date = new Date(`${value}T00:00:00Z`);
  if (
    Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`no such date: ${value}`);
  }
  return date;
}
