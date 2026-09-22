import type { UpdateIssueQuery } from "@omochice/redmine/issues/type";
import { toDate } from "./iso-date.ts";
import type { IssueUpdate } from "./port.ts";

/**
 * Rewrites the attributes of an issue update into the shape
 * `@omochice/redmine` expects, turning each ISO date into a `Date`.
 *
 * @throws {Error} when a date names a day the calendar does not have.
 */
export function toUpdateQuery(attrs: IssueUpdate): UpdateIssueQuery {
  const { startDate, dueDate, ...rest } = attrs;
  return {
    ...rest,
    ...(startDate === undefined ? {} : { startDate: toDate(startDate) }),
    ...(dueDate === undefined ? {} : { dueDate: toDate(dueDate) }),
  };
}
