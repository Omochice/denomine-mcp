import type {
  IssueCreate,
  IssueListQuery,
  IssuePort,
  IssueUpdate,
  RedmineResult,
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
    return Promise.resolve({ ok: true, value: { issues } });
  }

  show(id: number): Promise<RedmineResult<unknown>> {
    const issue = this.#issues.get(id);
    if (issue === undefined) {
      return Promise.resolve({ ok: false, error: this.#notFound() });
    }
    return Promise.resolve({ ok: true, value: { issue } });
  }

  create(attrs: IssueCreate): Promise<RedmineResult<null>> {
    if (attrs.subject.trim() === "") {
      return Promise.resolve({
        ok: false,
        error: { status: 422, errors: ["Subject cannot be blank"] },
      });
    }
    const id = this.#nextId++;
    this.#issues.set(id, { id, ...attrs });
    return Promise.resolve({ ok: true, value: null });
  }

  update(id: number, attrs: IssueUpdate): Promise<RedmineResult<null>> {
    const issue = this.#issues.get(id);
    if (issue === undefined) {
      return Promise.resolve({ ok: false, error: this.#notFound() });
    }
    this.#issues.set(id, { ...issue, ...attrs });
    return Promise.resolve({ ok: true, value: null });
  }

  delete(id: number): Promise<RedmineResult<null>> {
    if (!this.#issues.delete(id)) {
      return Promise.resolve({ ok: false, error: this.#notFound() });
    }
    return Promise.resolve({ ok: true, value: null });
  }

  #notFound(): { status: number; errors: string[] } {
    return { status: 404, errors: [] };
  }
}
