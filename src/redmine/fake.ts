import { Result } from "@praha/byethrow";
import type {
  AttachmentContent,
  AttachmentPort,
  EnumerationPort,
  IssueCreate,
  IssueInclude,
  IssueListQuery,
  IssuePort,
  IssueUpdate,
  ProjectRef,
  RedmineResult,
  RelationCreate,
  RelationPort,
  SearchPort,
  SearchQuery,
  TimeEntryCreate,
  TimeEntryListQuery,
  TimeEntryPort,
  TimeEntryUpdate,
  VersionCreate,
  VersionPort,
  VersionUpdate,
  WikiContent,
  WikiPort,
} from "./port.ts";

type StoredIssue = { id: number } & Record<string, unknown>;

/**
 * In-memory {@link IssuePort} for deterministic unit tests, standing in for a
 * live Redmine (ADR-0007). It models just enough behavior — id assignment,
 * lookup, a 404 on a missing id, and a journal per note — to exercise the
 * handler and MCP layers.
 */
export class FakeIssuePort implements IssuePort {
  readonly #issues = new Map<number, StoredIssue>();
  readonly #journals = new Map<number, { notes: string }[]>();
  #nextId = 1;

  list(query: IssueListQuery): Promise<RedmineResult<unknown>> {
    let issues = [...this.#issues.values()];
    if (query.projectId !== undefined) {
      issues = issues.filter((i) => i.projectId === query.projectId);
    }
    if (query.limit !== undefined) {
      issues = issues.slice(0, query.limit);
    }
    return Promise.resolve(Result.succeed({ issues }));
  }

  show(
    id: number,
    include?: IssueInclude[],
  ): Promise<RedmineResult<unknown>> {
    const issue = this.#issues.get(id);
    if (issue === undefined) {
      return Promise.resolve(Result.fail(this.#notFound()));
    }
    // Redmine leaves an association out entirely unless it was asked for, so
    // the fake does too: a caller that forgets `include` must not see journals.
    const journals = include?.includes("journals") === true
      ? { journals: this.#journals.get(id) ?? [] }
      : {};
    return Promise.resolve(
      Result.succeed({ issue: { ...issue, ...journals } }),
    );
  }

  create(attrs: IssueCreate): Promise<RedmineResult<null>> {
    if (attrs.subject.trim() === "") {
      return Promise.resolve(
        Result.fail({ status: 422, errors: ["Subject cannot be blank"] }),
      );
    }
    const id = this.#nextId++;
    this.#issues.set(id, { id, ...attrs });
    return Promise.resolve(Result.succeed(null));
  }

  update(id: number, attrs: IssueUpdate): Promise<RedmineResult<null>> {
    const issue = this.#issues.get(id);
    if (issue === undefined) {
      return Promise.resolve(Result.fail(this.#notFound()));
    }
    const { notes, ...fields } = attrs;
    if (notes !== undefined) {
      this.#journals.set(id, [...(this.#journals.get(id) ?? []), { notes }]);
    }
    this.#issues.set(id, { ...issue, ...fields });
    return Promise.resolve(Result.succeed(null));
  }

  delete(id: number): Promise<RedmineResult<null>> {
    if (!this.#issues.delete(id)) {
      return Promise.resolve(Result.fail(this.#notFound()));
    }
    this.#journals.delete(id);
    return Promise.resolve(Result.succeed(null));
  }

  #notFound(): { status: number; errors: string[] } {
    return { status: 404, errors: [] };
  }
}

type StoredWiki = { projectId: ProjectRef; version: number } & WikiContent;

/**
 * In-memory {@link WikiPort} for deterministic unit tests. Pages are keyed by
 * project and title; `create` starts a page at version 1 and `update` requires
 * an existing page and bumps its version, mirroring Redmine's model closely
 * enough to exercise the handler and MCP layers.
 */
export class FakeWikiPort implements WikiPort {
  readonly #pages = new Map<string, StoredWiki>();

  list(projectId: ProjectRef): Promise<RedmineResult<unknown>> {
    const pages = [...this.#pages.values()].filter(
      (page) => `${page.projectId}` === `${projectId}`,
    );
    return Promise.resolve(Result.succeed({ wiki_pages: pages }));
  }

  show(
    projectId: ProjectRef,
    title: string,
    _version?: number,
  ): Promise<RedmineResult<unknown>> {
    const page = this.#pages.get(this.#key(projectId, title));
    if (page === undefined) {
      return Promise.resolve(Result.fail(this.#notFound()));
    }
    return Promise.resolve(Result.succeed({ wiki_page: page }));
  }

  create(
    projectId: ProjectRef,
    wiki: WikiContent,
  ): Promise<RedmineResult<null>> {
    if (wiki.title.trim() === "") {
      return Promise.resolve(
        Result.fail({ status: 422, errors: ["Title cannot be blank"] }),
      );
    }
    this.#pages.set(this.#key(projectId, wiki.title), {
      projectId,
      version: 1,
      ...wiki,
    });
    return Promise.resolve(Result.succeed(null));
  }

  update(
    projectId: ProjectRef,
    wiki: WikiContent,
  ): Promise<RedmineResult<null>> {
    const key = this.#key(projectId, wiki.title);
    const page = this.#pages.get(key);
    if (page === undefined) {
      return Promise.resolve(Result.fail(this.#notFound()));
    }
    this.#pages.set(key, { ...page, ...wiki, version: page.version + 1 });
    return Promise.resolve(Result.succeed(null));
  }

  delete(projectId: ProjectRef, title: string): Promise<RedmineResult<null>> {
    if (!this.#pages.delete(this.#key(projectId, title))) {
      return Promise.resolve(Result.fail(this.#notFound()));
    }
    return Promise.resolve(Result.succeed(null));
  }

  #key(projectId: ProjectRef, title: string): string {
    return `${projectId} ${title}`;
  }

  #notFound(): { status: number; errors: string[] } {
    return { status: 404, errors: [] };
  }
}

type StoredVersion = { id: number; projectId: ProjectRef } & VersionCreate;

/**
 * In-memory {@link VersionPort} for deterministic unit tests. Versions are
 * created under a project but addressed by their own id, mirroring Redmine.
 */
export class FakeVersionPort implements VersionPort {
  readonly #versions = new Map<number, StoredVersion>();
  #nextId = 1;

  list(projectId: ProjectRef): Promise<RedmineResult<unknown>> {
    const versions = [...this.#versions.values()].filter(
      (version) => version.projectId === projectId,
    );
    return Promise.resolve(Result.succeed({ versions }));
  }

  show(id: number): Promise<RedmineResult<unknown>> {
    const version = this.#versions.get(id);
    if (version === undefined) {
      return Promise.resolve(Result.fail(this.#notFound()));
    }
    return Promise.resolve(Result.succeed({ version }));
  }

  create(
    projectId: ProjectRef,
    attrs: VersionCreate,
  ): Promise<RedmineResult<null>> {
    if (attrs.name.trim() === "") {
      return Promise.resolve(
        Result.fail({ status: 422, errors: ["Name cannot be blank"] }),
      );
    }
    const id = this.#nextId++;
    this.#versions.set(id, { id, projectId, ...attrs });
    return Promise.resolve(Result.succeed(null));
  }

  update(id: number, attrs: VersionUpdate): Promise<RedmineResult<null>> {
    const version = this.#versions.get(id);
    if (version === undefined) {
      return Promise.resolve(Result.fail(this.#notFound()));
    }
    this.#versions.set(id, { ...version, ...attrs });
    return Promise.resolve(Result.succeed(null));
  }

  delete(id: number): Promise<RedmineResult<null>> {
    if (!this.#versions.delete(id)) {
      return Promise.resolve(Result.fail(this.#notFound()));
    }
    return Promise.resolve(Result.succeed(null));
  }

  #notFound(): { status: number; errors: string[] } {
    return { status: 404, errors: [] };
  }
}

/** One indexed document a {@link FakeSearchPort} can return. */
export type SearchDoc = {
  id: number;
  title: string;
  type: string;
  url: string;
};

/** Maps each query type flag to the `type` its matching documents carry. */
const searchTypeByFlag: Record<string, string> = {
  issues: "issue",
  news: "news",
  documents: "document",
  changesets: "changeset",
  wikiPages: "wiki-page",
  messages: "message",
  projects: "project",
};

/**
 * In-memory {@link SearchPort} for deterministic unit tests. Seeded with a
 * corpus, it matches documents whose title contains `q` (case-insensitively) and
 * restricts to the requested types when any type flag is set, mirroring
 * Redmine's search closely enough to exercise the handler and MCP layers.
 */
export class FakeSearchPort implements SearchPort {
  readonly #docs: readonly SearchDoc[];

  constructor(docs: readonly SearchDoc[] = []) {
    this.#docs = docs;
  }

  search(query: SearchQuery): Promise<RedmineResult<unknown>> {
    if (query.q.trim() === "") {
      return Promise.resolve(
        Result.fail({ status: 422, errors: ["q cannot be blank"] }),
      );
    }
    const needle = query.q.toLowerCase();
    const types = Object.entries(searchTypeByFlag)
      .filter(([flag]) => query[flag as keyof SearchQuery] === true)
      .map(([, type]) => type);
    const results = this.#docs.filter((doc) => {
      if (!doc.title.toLowerCase().includes(needle)) {
        return false;
      }
      return types.length === 0 || types.includes(doc.type);
    });
    return Promise.resolve(Result.succeed(results));
  }
}

type StoredRelation = { id: number; issueId: number } & RelationCreate;

/**
 * In-memory {@link RelationPort} for deterministic unit tests. Relations are
 * created under a source issue but addressed by their own id, mirroring Redmine.
 */
export class FakeRelationPort implements RelationPort {
  readonly #relations = new Map<number, StoredRelation>();
  #nextId = 1;

  list(issueId: number): Promise<RedmineResult<unknown>> {
    const relations = [...this.#relations.values()].filter(
      (relation) => relation.issueId === issueId,
    );
    return Promise.resolve(Result.succeed({ relations }));
  }

  show(id: number): Promise<RedmineResult<unknown>> {
    const relation = this.#relations.get(id);
    if (relation === undefined) {
      return Promise.resolve(Result.fail(this.#notFound()));
    }
    return Promise.resolve(Result.succeed({ relation }));
  }

  create(
    issueId: number,
    attrs: RelationCreate,
  ): Promise<RedmineResult<null>> {
    if (attrs.issueToId === issueId) {
      return Promise.resolve(
        Result.fail({
          status: 422,
          errors: ["Cannot relate an issue to itself"],
        }),
      );
    }
    const id = this.#nextId++;
    this.#relations.set(id, { id, issueId, ...attrs });
    return Promise.resolve(Result.succeed(null));
  }

  delete(id: number): Promise<RedmineResult<null>> {
    if (!this.#relations.delete(id)) {
      return Promise.resolve(Result.fail(this.#notFound()));
    }
    return Promise.resolve(Result.succeed(null));
  }

  #notFound(): { status: number; errors: string[] } {
    return { status: 404, errors: [] };
  }
}

type StoredTimeEntry = { id: number; userId: number } & TimeEntryCreate;

/**
 * In-memory {@link TimeEntryPort} for deterministic unit tests. Redmine takes the
 * owning user from the API key, so the fake is constructed with one instead.
 */
export class FakeTimeEntryPort implements TimeEntryPort {
  readonly #entries = new Map<number, StoredTimeEntry>();
  readonly #userId: number;
  #nextId = 1;

  constructor(userId = 1) {
    this.#userId = userId;
  }

  list(query: TimeEntryListQuery): Promise<RedmineResult<unknown>> {
    const timeEntries = [...this.#entries.values()].filter((entry) => {
      if (
        query.projectId !== undefined && entry.projectId !== query.projectId
      ) {
        return false;
      }
      return query.userId === undefined || entry.userId === query.userId;
    });
    return Promise.resolve(Result.succeed({ timeEntries }));
  }

  show(id: number): Promise<RedmineResult<unknown>> {
    const entry = this.#entries.get(id);
    if (entry === undefined) {
      return Promise.resolve(Result.fail(this.#notFound()));
    }
    return Promise.resolve(Result.succeed({ timeEntry: entry }));
  }

  create(attrs: TimeEntryCreate): Promise<RedmineResult<null>> {
    const invalid = this.#invalidHours(attrs.hours);
    if (invalid !== undefined) {
      return Promise.resolve(Result.fail(invalid));
    }
    const id = this.#nextId++;
    this.#entries.set(id, { id, userId: this.#userId, ...attrs });
    return Promise.resolve(Result.succeed(null));
  }

  update(id: number, attrs: TimeEntryUpdate): Promise<RedmineResult<null>> {
    const entry = this.#entries.get(id);
    if (entry === undefined) {
      return Promise.resolve(Result.fail(this.#notFound()));
    }
    const invalid = attrs.hours === undefined
      ? undefined
      : this.#invalidHours(attrs.hours);
    if (invalid !== undefined) {
      return Promise.resolve(Result.fail(invalid));
    }
    this.#entries.set(id, { ...entry, ...attrs });
    return Promise.resolve(Result.succeed(null));
  }

  delete(id: number): Promise<RedmineResult<null>> {
    if (!this.#entries.delete(id)) {
      return Promise.resolve(Result.fail(this.#notFound()));
    }
    return Promise.resolve(Result.succeed(null));
  }

  #invalidHours(
    hours: number | undefined,
  ): { status: number; errors: string[] } | undefined {
    if (typeof hours === "number" && hours > 0) {
      return undefined;
    }
    return { status: 422, errors: ["Hours must be greater than zero"] };
  }

  #notFound(): { status: number; errors: string[] } {
    return { status: 404, errors: [] };
  }
}

/** In-memory {@link EnumerationPort} for deterministic unit tests. */
export class FakeEnumerationPort implements EnumerationPort {
  listTimeEntryActivities(): Promise<RedmineResult<unknown>> {
    return this.#succeed([
      { id: 8, name: "Design", isDefault: false, active: true },
      { id: 9, name: "Development", isDefault: true, active: true },
    ]);
  }

  listIssuePriorities(): Promise<RedmineResult<unknown>> {
    return this.#succeed([
      { id: 3, name: "Low", isDefault: false, active: true },
      { id: 4, name: "Normal", isDefault: true, active: true },
    ]);
  }

  listDocumentCategories(): Promise<RedmineResult<unknown>> {
    return this.#succeed([
      { id: 1, name: "User documentation", isDefault: true, active: true },
    ]);
  }

  #succeed(enumerations: unknown[]): Promise<RedmineResult<unknown>> {
    return Promise.resolve(Result.succeed(enumerations));
  }
}

/**
 * An attachment the fake serves: its metadata and the content behind it. A
 * `filesize` in the metadata is reported as declared even when it disagrees
 * with the content, so a server that misreports a size can be exercised.
 */
export type FakeAttachment = {
  metadata: Record<string, unknown>;
  content: string;
};

/**
 * In-memory {@link AttachmentPort} for deterministic unit tests. It is seeded
 * with the attachments it serves, because nothing in the tool surface creates
 * one: an attachment reaches Redmine through an upload the API exposes
 * elsewhere.
 */
export class FakeAttachmentPort implements AttachmentPort {
  readonly cancelled: number[] = [];
  readonly #attachments: Map<number, FakeAttachment>;

  constructor(seed: Record<number, FakeAttachment> = {}) {
    this.#attachments = new Map(
      Object.entries(seed).map(([id, attachment]) => [Number(id), attachment]),
    );
  }

  show(id: number): Promise<RedmineResult<unknown>> {
    const attachment = this.#attachments.get(id);
    if (attachment === undefined) {
      return Promise.resolve(Result.fail(this.#notFound()));
    }
    return Promise.resolve(Result.succeed({ attachment: attachment.metadata }));
  }

  download(id: number): Promise<RedmineResult<AttachmentContent>> {
    const attachment = this.#attachments.get(id);
    if (attachment === undefined) {
      return Promise.resolve(Result.fail(this.#notFound()));
    }
    const bytes = new TextEncoder().encode(attachment.content);
    const declared = attachment.metadata.filesize;
    return Promise.resolve(Result.succeed({
      filename: String(attachment.metadata.filename),
      contentType: String(attachment.metadata.contentType),
      filesize: typeof declared === "number" ? declared : bytes.byteLength,
      body: new ReadableStream({
        start: (controller) => {
          controller.enqueue(bytes);
          controller.close();
        },
        cancel: () => {
          this.cancelled.push(id);
        },
      }),
    }));
  }

  #notFound(): { status: number; errors: string[] } {
    return { status: 404, errors: [] };
  }
}
