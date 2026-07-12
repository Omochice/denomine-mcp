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

/** Explicit success/failure of a Redmine call, branched at each call site. */
export type RedmineResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: RedmineError };

export type IssueListQuery = {
  projectId?: number;
  trackerId?: number;
  statusId?: "open" | "closed" | "*" | number;
  assignedToId?: number | "me";
  limit?: number;
};

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
  show(id: number): Promise<RedmineResult<unknown>>;
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
