import type {
  CreateIssueQuery,
  UpdateIssueQuery,
} from "@omochice/redmine/issues/type";
import { toDate } from "./iso-date.ts";
import type { IsoDate, IssueCreate, IssueUpdate } from "./port.ts";

/**
 * Rewrites the start and due dates of issue attributes into the shape
 * `@omochice/redmine` expects, leaving every other attribute untouched.
 *
 * @throws {Error} when a date names a day the calendar does not have.
 */
export function toIssueDates(attrs: IssueCreate): CreateIssueQuery;
export function toIssueDates(attrs: IssueUpdate): UpdateIssueQuery;
export function toIssueDates(
  attrs: IssueCreate | IssueUpdate,
): CreateIssueQuery | UpdateIssueQuery {
  const { startDate, dueDate, ...rest } = attrs;
  return {
    ...rest,
    ...(startDate === undefined ? {} : { startDate: convert(startDate) }),
    ...(dueDate === undefined ? {} : { dueDate: convert(dueDate) }),
  } as CreateIssueQuery | UpdateIssueQuery;
}

function convert(value: IsoDate | null): Date | null {
  return value === null ? null : toDate(value);
}
