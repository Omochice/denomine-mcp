import { Redmine } from "@omochice/redmine";
import { Result } from "@praha/byethrow";
import { toRedmineError } from "./error.ts";
import type {
  RedmineContext,
  RedmineResult,
  VersionCreate,
  VersionPort,
  VersionUpdate,
} from "./port.ts";

/**
 * Adapts a port query to the library query. The tool speaks an ISO-date string
 * (`YYYY-MM-DD`) for `dueDate`, while `@omochice/redmine` expects a `Date`,
 * which its validator then serializes back to `YYYY-MM-DD` in UTC.
 */
function toLibraryQuery<T extends { dueDate?: string }>(
  attrs: T,
): Omit<T, "dueDate"> & { dueDate?: Date } {
  const { dueDate, ...rest } = attrs;
  return dueDate === undefined ? rest : { ...rest, dueDate: new Date(dueDate) };
}

/**
 * Real {@link VersionPort} backed by `@omochice/redmine`.
 *
 * The library throws on failure (ADR-0002), so each operation runs through
 * `Result.try`, mapping a throw to a {@link RedmineError} via
 * {@link toRedmineError}. `list` is an async generator, so it is drained into an
 * array; `create`/`update`/`delete` carry no body, so they resolve to `null`.
 */
export class VersionClient implements VersionPort {
  readonly #redmine: Redmine;

  constructor(context: RedmineContext) {
    this.#redmine = new Redmine(context);
  }

  list(projectId: number): Promise<RedmineResult<unknown>> {
    return Result.try({
      try: () => Array.fromAsync(this.#redmine.version.list(projectId)),
      catch: toRedmineError,
    });
  }

  show(id: number): Promise<RedmineResult<unknown>> {
    return Result.try({
      try: () => this.#redmine.version.show(id),
      catch: toRedmineError,
    });
  }

  create(
    projectId: number,
    attrs: VersionCreate,
  ): Promise<RedmineResult<null>> {
    return Result.try({
      try: async () => {
        await this.#redmine.version.create(projectId, toLibraryQuery(attrs));
        return null;
      },
      catch: toRedmineError,
    });
  }

  update(
    id: number,
    attrs: VersionUpdate,
  ): Promise<RedmineResult<null>> {
    return Result.try({
      try: async () => {
        await this.#redmine.version.update(id, toLibraryQuery(attrs));
        return null;
      },
      catch: toRedmineError,
    });
  }

  delete(id: number): Promise<RedmineResult<null>> {
    return Result.try({
      try: async () => {
        await this.#redmine.version.delete(id);
        return null;
      },
      catch: toRedmineError,
    });
  }
}
