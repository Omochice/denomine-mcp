import type { Include } from "@omochice/redmine/issues/show";
import type { IssueInclude } from "./port.ts";

// Keyed over every association so one added to the port without a name here is
// a compile error rather than a request Redmine silently ignores.
const names: Record<IssueInclude, Include> = {
  journals: "journals",
  attachments: "attachments",
  relations: "relations",
  children: "children",
  changesets: "changesets",
  watchers: "watchers",
  allowedStatuses: "allowed_statuses",
};

/**
 * Rewrites the associations to fetch into the shape `@omochice/redmine`
 * expects: Redmine's own spelling, and `undefined` rather than an empty list,
 * since asking for nothing must leave the `include` parameter off the request
 * entirely.
 */
export function toIncludes(
  include: IssueInclude[] | undefined,
): [Include, ...Include[]] | undefined {
  if (include === undefined || include.length === 0) {
    return undefined;
  }
  const [first, ...rest] = include.map((value) => names[value]);
  return [first, ...rest];
}
