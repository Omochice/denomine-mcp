import { Redmine } from "@omochice/redmine";
import { Result } from "@praha/byethrow";
import { toRedmineError } from "./error.ts";
import type {
  RedmineContext,
  RedmineResult,
  SearchPort,
  SearchQuery,
} from "./port.ts";

/**
 * Real {@link SearchPort} backed by `@omochice/redmine`.
 *
 * The library throws on failure (ADR-0002), so the call runs through
 * `Result.try`, mapping a throw to a {@link RedmineError} via
 * {@link toRedmineError}. `search` is an async generator that paginates, so it is
 * drained into an array.
 */
export class SearchClient implements SearchPort {
  readonly #redmine: Redmine;

  constructor(context: RedmineContext) {
    this.#redmine = new Redmine(context);
  }

  search(query: SearchQuery): Promise<RedmineResult<unknown>> {
    return Result.try({
      try: () => Array.fromAsync(this.#redmine.search.search(query)),
      catch: toRedmineError,
    });
  }
}
