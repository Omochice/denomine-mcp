import type {
  DateFilter as LibraryDateFilter,
  ListIssueQuery,
  PastDateFilter as LibraryPastDateFilter,
} from "@omochice/redmine/issues/type";
import type {
  DateFilter,
  DatePeriod,
  FutureDatePeriod,
  IsoDate,
  IssueListQuery,
  PastDateFilter,
} from "./port.ts";

/**
 * Rewrites an issue list query into the shape `@omochice/redmine` expects.
 *
 * The two differ only in how an absolute bound is written: the port carries an
 * ISO date, because the tool layer speaks JSON and has no `Date` to hand over.
 * A filter the caller omitted is left out rather than set to `undefined`, since
 * the library stringifies whatever key it finds and would send `undefined` on
 * the wire.
 */
export function toListQuery(query: IssueListQuery): ListIssueQuery {
  const { startDate, dueDate, createdOn, updatedOn, closedOn, ...rest } = query;
  return {
    ...rest,
    ...(startDate === undefined ? {} : { startDate: toFilter(startDate) }),
    ...(dueDate === undefined ? {} : { dueDate: toFilter(dueDate) }),
    ...(createdOn === undefined ? {} : { createdOn: toFilter(createdOn) }),
    ...(updatedOn === undefined ? {} : { updatedOn: toFilter(updatedOn) }),
    ...(closedOn === undefined ? {} : { closedOn: toFilter(closedOn) }),
  };
}

// A `:date_past` field keeps its narrower filter type: only the schema layer
// stops a forward-looking form from reaching one, and Redmine answers 422 for
// it, so the narrowing must not be lost on the way to the library.
function toFilter(filter: PastDateFilter): LibraryPastDateFilter;
function toFilter(filter: DateFilter): LibraryDateFilter;
function toFilter(filter: DateFilter): LibraryDateFilter {
  if (typeof filter === "string") {
    return isPeriod(filter) ? filter : toDate(filter);
  }
  if ("daysAgo" in filter) {
    return filter;
  }
  if ("daysFromNow" in filter) {
    return filter;
  }

  const from = "from" in filter ? filter.from : undefined;
  const to = "to" in filter ? filter.to : undefined;
  if (typeof to === "object") {
    if ("daysAgo" in to) {
      return { to };
    }
    return from === "today" ? { from, to } : { to };
  }
  if (typeof from === "object") {
    if ("daysFromNow" in from) {
      return { from };
    }
    return to === "today" ? { from, to } : { from };
  }
  if (from !== undefined && to !== undefined) {
    return { from: toDate(from), to: toDate(to) };
  }
  if (from !== undefined) {
    return { from: toDate(from) };
  }
  if (to !== undefined) {
    return { to: toDate(to) };
  }
  // Every filter shape carries at least one bound, and the schema layer rejects
  // an empty object, so no caller can reach this.
  throw new Error("date filter carries no bound");
}

// Keyed over both period types so that a period added to the port without an
// entry here is a compile error: the missing entry would otherwise fall through
// to date parsing and reach Redmine as an invalid date.
const periods: Record<DatePeriod | FutureDatePeriod, true> = {
  today: true,
  yesterday: true,
  thisWeek: true,
  lastWeek: true,
  lastTwoWeeks: true,
  thisMonth: true,
  lastMonth: true,
  thisYear: true,
  any: true,
  none: true,
  tomorrow: true,
  nextWeek: true,
  nextMonth: true,
};

function isPeriod(value: string): value is DatePeriod | FutureDatePeriod {
  return Object.hasOwn(periods, value);
}

// Parsed at UTC midnight because the library serializes a Date by its UTC day;
// a Date built from local calendar fields would name the previous day in any
// zone east of UTC.
function toDate(value: IsoDate): Date {
  return new Date(`${value}T00:00:00Z`);
}
