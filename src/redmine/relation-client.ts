import { Redmine } from "@omochice/redmine";
import { Result } from "@praha/byethrow";
import { toRedmineError } from "./error.ts";
import type {
  RedmineContext,
  RedmineResult,
  RelationCreate,
  RelationPort,
} from "./port.ts";

/**
 * Real {@link RelationPort} backed by `@omochice/redmine`.
 *
 * The library throws on failure (ADR-0002), so each operation runs through
 * `Result.try`, mapping a throw to a {@link RedmineError} via
 * {@link toRedmineError}. `list` is an async generator, so it is drained into an
 * array; `create`/`delete` carry no body, so they resolve to `null`.
 */
export class RelationClient implements RelationPort {
  readonly #redmine: Redmine;

  constructor(context: RedmineContext) {
    this.#redmine = new Redmine(context);
  }

  list(issueId: number): Promise<RedmineResult<unknown>> {
    return Result.try({
      try: () => Array.fromAsync(this.#redmine.issueRelation.list(issueId)),
      catch: toRedmineError,
    });
  }

  show(id: number): Promise<RedmineResult<unknown>> {
    return Result.try({
      try: () => this.#redmine.issueRelation.show(id),
      catch: toRedmineError,
    });
  }

  create(
    issueId: number,
    attrs: RelationCreate,
  ): Promise<RedmineResult<null>> {
    return Result.try({
      try: async () => {
        await this.#redmine.issueRelation.create(issueId, attrs);
        return null;
      },
      catch: toRedmineError,
    });
  }

  delete(id: number): Promise<RedmineResult<null>> {
    return Result.try({
      try: async () => {
        await this.#redmine.issueRelation.delete(id);
        return null;
      },
      catch: toRedmineError,
    });
  }
}
