import type {
  CreateIssueQuery,
  UpdateIssueQuery,
} from "@omochice/redmine/issues/type";
import { toDate } from "./iso-date.ts";
import type { IsoDate, IssueCreate, IssueUpdate } from "./port.ts";

/**
 * Turns the start and due dates of issue attributes into `Date`s, leaving
 * every other attribute untouched.
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
    ...(isOmitted(startDate) ? {} : { startDate: convert(startDate) }),
    ...(isOmitted(dueDate) ? {} : { dueDate: convert(dueDate) }),
  } as CreateIssueQuery | UpdateIssueQuery;
}

// A date sent as null clears it on Redmine, so `== null` would turn a clear
// into leaving the date as it was; only an absent date may be dropped.
function isOmitted<T>(value: T | undefined): value is undefined {
  // deno-lint-ignore local/eqeqeq
  return value === undefined;
}

function convert(value: IsoDate | null): Date | null {
  return value == null ? null : toDate(value);
}
