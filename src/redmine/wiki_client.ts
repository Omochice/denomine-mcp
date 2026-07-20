import { Redmine } from "@omochice/redmine";
import { Result } from "@praha/byethrow";
import { toRedmineError } from "./error.ts";
import type {
  RedmineContext,
  RedmineResult,
  WikiContent,
  WikiPort,
} from "./port.ts";

/**
 * Real {@link WikiPort} backed by `@omochice/redmine`.
 *
 * The library throws on failure (ADR-0002), so each operation runs through
 * `Result.try`, mapping a throw to a {@link RedmineError} via
 * {@link toRedmineError}. `list` is an async generator, so it is drained into an
 * array; `create`/`update`/`delete` carry no body, so they resolve to `null`.
 */
export class WikiClient implements WikiPort {
  readonly #redmine: Redmine;

  constructor(context: RedmineContext) {
    this.#redmine = new Redmine(context);
  }

  list(projectId: number): Promise<RedmineResult<unknown>> {
    return Result.try({
      try: () => Array.fromAsync(this.#redmine.wiki.list(projectId)),
      catch: toRedmineError,
    });
  }

  show(
    projectId: number,
    title: string,
    version?: number,
  ): Promise<RedmineResult<unknown>> {
    return Result.try({
      try: () => this.#redmine.wiki.show({ projectId, title, version }),
      catch: toRedmineError,
    });
  }

  create(
    projectId: number,
    wiki: WikiContent,
  ): Promise<RedmineResult<null>> {
    return Result.try({
      try: async () => {
        await this.#redmine.wiki.create(projectId, wiki);
        return null;
      },
      catch: toRedmineError,
    });
  }

  update(
    projectId: number,
    wiki: WikiContent,
  ): Promise<RedmineResult<null>> {
    return Result.try({
      try: async () => {
        await this.#redmine.wiki.update(projectId, wiki);
        return null;
      },
      catch: toRedmineError,
    });
  }

  delete(
    projectId: number,
    title: string,
  ): Promise<RedmineResult<null>> {
    return Result.try({
      try: async () => {
        await this.#redmine.wiki.delete(projectId, title);
        return null;
      },
      catch: toRedmineError,
    });
  }
}
