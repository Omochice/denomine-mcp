import { Redmine } from "@omochice/redmine";
import { Result } from "@praha/byethrow";
import { toRedmineError } from "./error.ts";
import type {
  ProjectRef,
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

  list(projectId: ProjectRef): Promise<RedmineResult<unknown>> {
    return Result.try({
      try: () =>
        Array.fromAsync(this.#redmine.wiki.list(asLibraryId(projectId))),
      catch: toRedmineError,
    });
  }

  show(
    projectId: ProjectRef,
    title: string,
    version?: number,
  ): Promise<RedmineResult<unknown>> {
    return Result.try({
      try: () =>
        this.#redmine.wiki.show({
          projectId: asLibraryId(projectId),
          title,
          version,
        }),
      catch: toRedmineError,
    });
  }

  create(
    projectId: ProjectRef,
    wiki: WikiContent,
  ): Promise<RedmineResult<null>> {
    return Result.try({
      try: async () => {
        await this.#redmine.wiki.create(asLibraryId(projectId), wiki);
        return null;
      },
      catch: toRedmineError,
    });
  }

  update(
    projectId: ProjectRef,
    wiki: WikiContent,
  ): Promise<RedmineResult<null>> {
    return Result.try({
      try: async () => {
        await this.#redmine.wiki.update(asLibraryId(projectId), wiki);
        return null;
      },
      catch: toRedmineError,
    });
  }

  delete(
    projectId: ProjectRef,
    title: string,
  ): Promise<RedmineResult<null>> {
    return Result.try({
      try: async () => {
        await this.#redmine.wiki.delete(asLibraryId(projectId), title);
        return null;
      },
      catch: toRedmineError,
    });
  }
}

/**
 * `@omochice/redmine` types the path parameter as `number` although Redmine
 * accepts the identifier there too; confining the cast here keeps it deletable.
 */
function asLibraryId(projectId: ProjectRef): number {
  return projectId as number;
}
