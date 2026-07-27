import type { Include } from "@omochice/redmine/issues/show";
import type { ListIncludeValue } from "@omochice/redmine/issues/type";
import type { IssueInclude, IssueListInclude } from "./port.ts";

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
  return toNonEmpty(include?.map((value) => names[value]));
}

/**
 * The same rewrite for a list request, whose two associations Redmine spells
 * as the port does.
 */
export function toListIncludes(
  include: IssueListInclude[] | undefined,
): [ListIncludeValue, ...ListIncludeValue[]] | undefined {
  return toNonEmpty(include);
}

// The library takes a non-empty tuple, so asking for nothing has to be
// undefined rather than [].
function toNonEmpty<T>(values: T[] | undefined): [T, ...T[]] | undefined {
  if (values === undefined || values.length === 0) {
    return undefined;
  }
  const [first, ...rest] = values;
  return [first, ...rest];
}
