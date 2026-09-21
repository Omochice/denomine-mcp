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
  fixedVersionId?: number;
  assignedToId?: number;
  parentIssueId?: number;
  isPrivate?: boolean;
  estimatedHours?: number;
};

export type IssueUpdate = {
  subject?: string;
  description?: string;
  statusId?: number;
  priorityId?: number;
  trackerId?: number;
  assignedToId?: number | null;
  categoryId?: number | null;
  fixedVersionId?: number | null;
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
export type IssuePort = {
  list(query: IssueListQuery): Promise<RedmineResult<unknown>>;
  show(
    id: number,
    include?: IssueInclude[],
  ): Promise<RedmineResult<unknown>>;
  create(attrs: IssueCreate): Promise<RedmineResult<null>>;
  update(id: number, attrs: IssueUpdate): Promise<RedmineResult<null>>;
  delete(id: number): Promise<RedmineResult<null>>;
};

/** Attributes of a wiki page; a page is identified by its project and title. */
export type WikiContent = {
  title: string;
  text: string;
  comments?: string;
  version?: number;
  parentTitle?: string;
};

/**
 * A project reference as Redmine's `/projects/:project_id/...` routes accept
 * it: the numeric id or the string identifier that appears in project URLs.
 * Redmine rejects all-digit identifiers, so the two forms never collide.
 */
export type ProjectRef = number | string;

/**
 * The wiki-page operations the tool layer depends on. Wiki pages are keyed by
 * project and title, and `create`/`update`/`delete` carry no body, so they
 * resolve to `null`.
 */
export type WikiPort = {
  list(projectId: ProjectRef): Promise<RedmineResult<unknown>>;
  show(
    projectId: ProjectRef,
    title: string,
    version?: number,
  ): Promise<RedmineResult<unknown>>;
  create(
    projectId: ProjectRef,
    wiki: WikiContent,
  ): Promise<RedmineResult<null>>;
  update(
    projectId: ProjectRef,
    wiki: WikiContent,
  ): Promise<RedmineResult<null>>;
  delete(projectId: ProjectRef, title: string): Promise<RedmineResult<null>>;
};

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
export type VersionPort = {
  list(projectId: ProjectRef): Promise<RedmineResult<unknown>>;
  show(id: number): Promise<RedmineResult<unknown>>;
  create(
    projectId: ProjectRef,
    attrs: VersionCreate,
  ): Promise<RedmineResult<null>>;
  update(id: number, attrs: VersionUpdate): Promise<RedmineResult<null>>;
  delete(id: number): Promise<RedmineResult<null>>;
};

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
export type SearchPort = {
  search(query: SearchQuery): Promise<RedmineResult<unknown>>;
};

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
export type RelationPort = {
  list(issueId: number): Promise<RedmineResult<unknown>>;
  show(id: number): Promise<RedmineResult<unknown>>;
  create(issueId: number, attrs: RelationCreate): Promise<RedmineResult<null>>;
  delete(id: number): Promise<RedmineResult<null>>;
};

/** A filter on the time entry list; every date is an ISO date (`YYYY-MM-DD`). */
export type TimeEntryListQuery = {
  projectId?: number;
  userId?: number;
  spentOn?: IsoDate;
  from?: IsoDate;
  to?: IsoDate;
};

/** Attributes of a logged time entry; `spentOn` is an ISO date (`YYYY-MM-DD`). */
export type TimeEntryCreate = {
  hours: number;
  issueId?: number;
  projectId?: number;
  spentOn?: IsoDate;
  activityId?: number;
  comments?: string;
};

export type TimeEntryUpdate = Partial<TimeEntryCreate>;

/** The time entry operations the tool layer depends on. */
export type TimeEntryPort = {
  list(query: TimeEntryListQuery): Promise<RedmineResult<unknown>>;
  show(id: number): Promise<RedmineResult<unknown>>;
  create(attrs: TimeEntryCreate): Promise<RedmineResult<null>>;
  update(id: number, attrs: TimeEntryUpdate): Promise<RedmineResult<null>>;
  delete(id: number): Promise<RedmineResult<null>>;
};

/**
 * The bytes of an attachment together with the metadata describing them. The
 * content is a stream so an attachment of any size can be consumed without
 * being held in memory.
 */
export type AttachmentContent = {
  filename: string;
  contentType: string;
  filesize: number;
  body: ReadableStream<Uint8Array>;
};

/**
 * The attachment operations the tool layer depends on. Both read: `show`
 * returns the metadata, `download` the content, and neither changes anything in
 * Redmine.
 */
export type AttachmentPort = {
  show(id: number): Promise<RedmineResult<unknown>>;
  download(id: number): Promise<RedmineResult<AttachmentContent>>;
};

/** The enumeration listings the tool layer depends on; read-only in Redmine's API. */
export type EnumerationPort = {
  listTimeEntryActivities(): Promise<RedmineResult<unknown>>;
  listIssuePriorities(): Promise<RedmineResult<unknown>>;
  listDocumentCategories(): Promise<RedmineResult<unknown>>;
};
