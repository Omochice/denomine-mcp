import { Redmine } from "@omochice/redmine";
import { Result } from "@praha/byethrow";
import { toListQuery } from "./date_filter.ts";
import { toRedmineError } from "./error.ts";
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
 * The library throws on failure (ADR-0002), so each operation runs through
 * `Result.try`, mapping a throw to a {@link RedmineError} via
 * {@link toRedmineError}. `list` is an async generator that paginates, so it is
 * drained into an array; `create`/`update`/`delete` carry no body, so they
 * resolve to `null`.
 */
export class RedmineClient implements IssuePort {
  readonly #redmine: Redmine;

  constructor(context: RedmineContext) {
    this.#redmine = new Redmine(context);
  }

  list(query: IssueListQuery): Promise<RedmineResult<unknown>> {
    return Result.try({
      try: () => Array.fromAsync(this.#redmine.issue.list(toListQuery(query))),
      catch: toRedmineError,
    });
  }

  show(id: number): Promise<RedmineResult<unknown>> {
    return Result.try({
      try: () => this.#redmine.issue.show(id),
      catch: toRedmineError,
    });
  }

  create(attrs: IssueCreate): Promise<RedmineResult<null>> {
    return Result.try({
      try: async () => {
        await this.#redmine.issue.create(attrs);
        return null;
      },
      catch: toRedmineError,
    });
  }

  update(id: number, attrs: IssueUpdate): Promise<RedmineResult<null>> {
    return Result.try({
      try: async () => {
        await this.#redmine.issue.update(id, attrs);
        return null;
      },
      catch: toRedmineError,
    });
  }

  delete(id: number): Promise<RedmineResult<null>> {
    return Result.try({
      try: async () => {
        await this.#redmine.issue.delete(id);
        return null;
      },
      catch: toRedmineError,
    });
  }
}
