import type { IsoDate } from "./port.ts";

/**
 * Turns an ISO date (`YYYY-MM-DD`) into the `Date` `@omochice/redmine` expects.
 *
 * Parsed at UTC midnight because the library serializes a Date by its UTC day;
 * a Date built from local calendar fields would name the previous day in any
 * zone east of UTC.
 *
 * The schema layer checks the shape of the date but not the calendar, and Date
 * rolls a day past the end of its month over into the next one, so a filter on
 * 2026-02-30 would quietly return the issues of 2026-03-02 instead.
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
