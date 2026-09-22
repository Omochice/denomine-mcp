import type { IsoDate } from "./port.ts";

/**
 * Turns an ISO date (`YYYY-MM-DD`) into the `Date` `@omochice/redmine` expects.
 *
 * Parsed at UTC midnight rather than from local calendar fields, because the
 * library serializes a Date by its UTC day.
 *
 * @throws {Error} when the calendar has no such day, since `Date` would roll
 * it over into the next month instead.
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
