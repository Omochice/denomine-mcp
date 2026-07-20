import { Result } from "@praha/byethrow";
import type {
  IssueCreate,
  IssueListQuery,
  IssuePort,
  IssueUpdate,
  RedmineResult,
  RelationCreate,
  RelationPort,
  SearchPort,
  SearchQuery,
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
 * lookup, and a 404 on a missing id — to exercise the handler and MCP layers.
 */
export class FakeIssuePort implements IssuePort {
  readonly #issues = new Map<number, StoredIssue>();
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

  show(id: number): Promise<RedmineResult<unknown>> {
    const issue = this.#issues.get(id);
    if (issue === undefined) {
      return Promise.resolve(Result.fail(this.#notFound()));
    }
    return Promise.resolve(Result.succeed({ issue }));
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
    this.#issues.set(id, { ...issue, ...attrs });
    return Promise.resolve(Result.succeed(null));
  }

  delete(id: number): Promise<RedmineResult<null>> {
    if (!this.#issues.delete(id)) {
      return Promise.resolve(Result.fail(this.#notFound()));
    }
    return Promise.resolve(Result.succeed(null));
  }

  #notFound(): { status: number; errors: string[] } {
    return { status: 404, errors: [] };
  }
}

type StoredWiki = { projectId: number; version: number } & WikiContent;

/**
 * In-memory {@link WikiPort} for deterministic unit tests. Pages are keyed by
 * project and title; `create` starts a page at version 1 and `update` requires
 * an existing page and bumps its version, mirroring Redmine's model closely
 * enough to exercise the handler and MCP layers.
 */
export class FakeWikiPort implements WikiPort {
  readonly #pages = new Map<string, StoredWiki>();

  list(projectId: number): Promise<RedmineResult<unknown>> {
    const pages = [...this.#pages.values()].filter(
      (page) => page.projectId === projectId,
    );
    return Promise.resolve(Result.succeed({ wiki_pages: pages }));
  }

  show(
    projectId: number,
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
    projectId: number,
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
    projectId: number,
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

  delete(projectId: number, title: string): Promise<RedmineResult<null>> {
    if (!this.#pages.delete(this.#key(projectId, title))) {
      return Promise.resolve(Result.fail(this.#notFound()));
    }
    return Promise.resolve(Result.succeed(null));
  }

  #key(projectId: number, title: string): string {
    return `${projectId} ${title}`;
  }

  #notFound(): { status: number; errors: string[] } {
    return { status: 404, errors: [] };
  }
}

type StoredVersion = { id: number; projectId: number } & VersionCreate;

/**
 * In-memory {@link VersionPort} for deterministic unit tests. Versions are
 * created under a project but addressed by their own id, mirroring Redmine.
 */
export class FakeVersionPort implements VersionPort {
  readonly #versions = new Map<number, StoredVersion>();
  #nextId = 1;

  list(projectId: number): Promise<RedmineResult<unknown>> {
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
    projectId: number,
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
