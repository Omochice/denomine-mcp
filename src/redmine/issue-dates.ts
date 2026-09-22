import { toDate } from "./iso-date.ts";
import type { IsoDate } from "./port.ts";

type DateKey = "startDate" | "dueDate";

type DatedAttrs =
  & Record<string, unknown>
  & { [K in DateKey]?: IsoDate | null };

type WithDates<T extends DatedAttrs> = {
  [K in keyof T]: K extends DateKey
    ? Exclude<T[K], IsoDate> | (IsoDate extends T[K] ? Date : never)
    : T[K];
};

/**
 * Rewrites the start and due dates of issue attributes into the shape
 * `@omochice/redmine` expects, leaving every other attribute untouched.
 *
 * @throws {Error} when a date names a day the calendar does not have.
 */
export function toIssueDates<T extends DatedAttrs>(attrs: T): WithDates<T> {
  const { startDate, dueDate, ...rest } = attrs;
  return {
    ...rest,
    ...(startDate === undefined ? {} : { startDate: convert(startDate) }),
    ...(dueDate === undefined ? {} : { dueDate: convert(dueDate) }),
  } as WithDates<T>;
}

function convert(value: IsoDate | null): Date | null {
  return value === null ? null : toDate(value);
}
