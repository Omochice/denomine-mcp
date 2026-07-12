import { Redmine } from "@omochice/redmine";
import { errorFromCause } from "./error.ts";
import type {
  IssueCreate,
  IssueListQuery,
  IssuePort,
  IssueUpdate,
  RedmineContext,
  RedmineResult,
} from "./port.ts";

/**
 * Real {@link IssuePort} backed by `@omochice/redmine`.
 *
 * Each operation branches the library's Result explicitly (ADR-0002): success
 * maps to a value, failure maps to a {@link RedmineError} carrying the status
 * and Redmine's validation messages. `create`/`update`/`delete` carry no body,
 * so they resolve to `null`.
 */
export class RedmineClient implements IssuePort {
  readonly #redmine: Redmine;

  constructor(context: RedmineContext) {
    this.#redmine = new Redmine(context);
  }

  async list(query: IssueListQuery): Promise<RedmineResult<unknown>> {
    const result = await this.#redmine.issue.list(query);
    if (result.isErr()) {
      return { ok: false, error: await errorFromCause(result.error) };
    }
    return { ok: true, value: result.value };
  }

  async show(id: number): Promise<RedmineResult<unknown>> {
    const result = await this.#redmine.issue.show(id);
    if (result.isErr()) {
      return { ok: false, error: await errorFromCause(result.error) };
    }
    return { ok: true, value: result.value };
  }

  async create(attrs: IssueCreate): Promise<RedmineResult<null>> {
    const result = await this.#redmine.issue.create(attrs);
    if (result.isErr()) {
      return { ok: false, error: await errorFromCause(result.error) };
    }
    return { ok: true, value: null };
  }

  async update(id: number, attrs: IssueUpdate): Promise<RedmineResult<null>> {
    const result = await this.#redmine.issue.update(id, attrs);
    if (result.isErr()) {
      return { ok: false, error: await errorFromCause(result.error) };
    }
    return { ok: true, value: null };
  }

  async delete(id: number): Promise<RedmineResult<null>> {
    const result = await this.#redmine.issue.delete(id);
    if (result.isErr()) {
      return { ok: false, error: await errorFromCause(result.error) };
    }
    return { ok: true, value: null };
  }
}
