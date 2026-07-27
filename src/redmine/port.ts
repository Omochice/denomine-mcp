import type { Result } from "@praha/byethrow";

/** Connection details for one Redmine instance. */
export type RedmineContext = {
  endpoint: string;
  apiKey: string;
};

/**
 * A failed Redmine call, reduced to what is safe to hand back to the model:
 * the HTTP status and Redmine's validation messages. Headers and any
 * authentication material are deliberately excluded (see ADR-0002).
 */
export type RedmineError = {
  status: number;
  errors: string[];
};

/**
 * Success or failure of a Redmine call, branched at each call site. Bound to
 * `@praha/byethrow` so the whole codebase shares one Result representation and
 * its combinators, with the failure fixed to {@link RedmineError}.
 */
export type RedmineResult<T> = Result.Result<T, RedmineError>;

/** An absolute date bound, written as an ISO date (`YYYY-MM-DD`). */
export type IsoDate = string;

/** A period Redmine resolves against the day the query runs. */
export type DatePeriod =
  | "today"
  | "yesterday"
  | "thisWeek"
  | "lastWeek"
  | "lastTwoWeeks"
  | "thisMonth"
  | "lastMonth"
  | "thisYear"
  | "any"
  | "none";

/** A period that looks forward; only {@link DateFilter} fields accept one. */
export type FutureDatePeriod = "tomorrow" | "nextWeek" | "nextMonth";

/**
 * A filter on an issue date field Redmine types as `:date_past` — `createdOn`,
 * `updatedOn`, `closedOn`. Every bound is inclusive, because Redmine's absolute
 * date operators are limited to `=`, `>=`, `<=` and `><`.
 *
 * Forward-looking forms are absent: Redmine answers 422 for them on these
 * fields, so {@link DateFilter} is the wider type that carries them.
 */
export type PastDateFilter =
  | IsoDate
  | DatePeriod
  | { daysAgo: number }
  | { from: IsoDate; to?: IsoDate }
  | { from?: IsoDate; to: IsoDate }
  | { from: { daysAgo: number }; to?: "today" }
  | { to: { daysAgo: number } };

/**
 * A filter on an issue date field Redmine types as `:date` — `startDate`,
 * `dueDate` — which also accept the forward-looking forms.
 */
export type DateFilter =
  | PastDateFilter
  | FutureDatePeriod
  | { daysFromNow: number }
  | { from: { daysFromNow: number } }
  | { to: { daysFromNow: number } }
  | { from: "today"; to: { daysFromNow: number } };

/**
 * An association Redmine will add to a listed issue. The list endpoint carries
 * only these two, unlike {@link IssueInclude} for a single issue.
 */
export type IssueListInclude = "attachments" | "relations";

export type IssueListQuery = {
  include?: IssueListInclude[];
  projectId?: number;
  trackerId?: number;
  statusId?: "open" | "closed" | "*" | number;
  fixedVersionId?: number;
  assignedToId?: number | "me";
  startDate?: DateFilter;
  dueDate?: DateFilter;
  createdOn?: PastDateFilter;
  updatedOn?: PastDateFilter;
  closedOn?: PastDateFilter;
  limit?: number;
};

/**
 * An association Redmine leaves out of an issue unless it is asked for.
 * `journals` are the comments and the field-change history.
 */
export type IssueInclude =
  | "journals"
  | "attachments"
  | "relations"
  | "children"
  | "changesets"
  | "watchers"
  | "allowedStatuses";

export type IssueCreate = {
  projectId: number;
  trackerId: number;
  statusId: number;
  priorityId: number;
  subject: string;
  description?: string;
  assignedToId?: number;
  parentIssueId?: number;
  isPrivate?: boolean;
  estimatedHours?: number;
};

export type IssueUpdate = {
  subject?: string;
  description?: string;
  doneRatio?: number;
  isPrivate?: boolean;
  estimatedHours?: number;
  notes?: string;
  privateNotes?: boolean;
};

/**
 * The issue operations the tool layer depends on. The core depends only on this
 * port; the real backend binds it to `@omochice/redmine`, and a fake backs the
 * unit tests (see ADR-0007).
 */
export interface IssuePort {
  list(query: IssueListQuery): Promise<RedmineResult<unknown>>;
  show(
    id: number,
    include?: IssueInclude[],
  ): Promise<RedmineResult<unknown>>;
  create(attrs: IssueCreate): Promise<RedmineResult<null>>;
  update(id: number, attrs: IssueUpdate): Promise<RedmineResult<null>>;
  delete(id: number): Promise<RedmineResult<null>>;
}

/** Attributes of a wiki page; a page is identified by its project and title. */
export type WikiContent = {
  title: string;
  text: string;
  comments?: string;
  version?: number;
  parentTitle?: string;
};

/**
 * The wiki-page operations the tool layer depends on. Wiki pages are keyed by
 * project id and title (not a numeric id), and `create`/`update`/`delete` carry
 * no body, so they resolve to `null`.
 */
export interface WikiPort {
  list(projectId: number): Promise<RedmineResult<unknown>>;
  show(
    projectId: number,
    title: string,
    version?: number,
  ): Promise<RedmineResult<unknown>>;
  create(projectId: number, wiki: WikiContent): Promise<RedmineResult<null>>;
  update(projectId: number, wiki: WikiContent): Promise<RedmineResult<null>>;
  delete(projectId: number, title: string): Promise<RedmineResult<null>>;
}

export type VersionStatus = "open" | "locked" | "closed";

export type VersionSharing =
  | "none"
  | "descendants"
  | "hierarchy"
  | "tree"
  | "system";

/** Attributes of a project version; `dueDate` is an ISO date (`YYYY-MM-DD`). */
export type VersionCreate = {
  name: string;
  description?: string;
  status?: VersionStatus;
  dueDate?: string;
  sharing?: VersionSharing;
  wikiPageTitle?: string;
};

export type VersionUpdate = Partial<VersionCreate>;

/**
 * The version operations the tool layer depends on. A version is listed and
 * created under a project, but shown, updated, and deleted by its own numeric
 * id; `create`/`update`/`delete` carry no body, so they resolve to `null`.
 */
export interface VersionPort {
  list(projectId: number): Promise<RedmineResult<unknown>>;
  show(id: number): Promise<RedmineResult<unknown>>;
  create(projectId: number, attrs: VersionCreate): Promise<RedmineResult<null>>;
  update(id: number, attrs: VersionUpdate): Promise<RedmineResult<null>>;
  delete(id: number): Promise<RedmineResult<null>>;
}

/**
 * A Redmine search query. Only `q` is required; `scope` narrows where to look
 * ("all", "my_projects", "subprojects", or a project identifier), and the
 * remaining flags each restrict the result to one resource type (any combination
 * ORs them together). `attachments` is tri-state ("0" | "1" | "only"), so it is
 * a string rather than a boolean.
 */
export type SearchQuery = {
  q: string;
  scope?: string;
  allWords?: boolean;
  titlesOnly?: boolean;
  openIssues?: boolean;
  issues?: boolean;
  news?: boolean;
  documents?: boolean;
  changesets?: boolean;
  wikiPages?: boolean;
  messages?: boolean;
  projects?: boolean;
  attachments?: boolean | string;
};

/**
 * The full-text search operation the tool layer depends on. Search is a single
 * read-only query across every indexed resource, so unlike the CRUD ports it
 * exposes just one method (see ADR-0001).
 */
export interface SearchPort {
  search(query: SearchQuery): Promise<RedmineResult<unknown>>;
}

export type RelationType =
  | "relates"
  | "duplicates"
  | "duplicated"
  | "blocks"
  | "blocked"
  | "precedes"
  | "follows"
  | "copied_to"
  | "copied_from";

/** Attributes of a new issue relation from the source issue to `issueToId`. */
export type RelationCreate = {
  issueToId: number;
  relationType: RelationType;
  delay?: number;
};

/**
 * The issue-relation operations the tool layer depends on. Relations are listed
 * and created under a source issue, but shown and deleted by their own id;
 * Redmine has no relation update. `create`/`delete` carry no body, so they
 * resolve to `null`.
 */
export interface RelationPort {
  list(issueId: number): Promise<RedmineResult<unknown>>;
  show(id: number): Promise<RedmineResult<unknown>>;
  create(issueId: number, attrs: RelationCreate): Promise<RedmineResult<null>>;
  delete(id: number): Promise<RedmineResult<null>>;
}
