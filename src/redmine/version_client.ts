import { Redmine } from "@omochice/redmine";
import { errorFromCause } from "./error.ts";
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
 * Each operation branches the library's Result explicitly (ADR-0002).
 * `create`/`update`/`delete` carry no body, so they resolve to `null`.
 */
export class VersionClient implements VersionPort {
  readonly #redmine: Redmine;

  constructor(context: RedmineContext) {
    this.#redmine = new Redmine(context);
  }

  async list(projectId: number): Promise<RedmineResult<unknown>> {
    const result = await this.#redmine.version.list(projectId);
    if (result.isErr()) {
      return { ok: false, error: await errorFromCause(result.error) };
    }
    return { ok: true, value: result.value };
  }

  async show(id: number): Promise<RedmineResult<unknown>> {
    const result = await this.#redmine.version.show(id);
    if (result.isErr()) {
      return { ok: false, error: await errorFromCause(result.error) };
    }
    return { ok: true, value: result.value };
  }

  async create(
    projectId: number,
    attrs: VersionCreate,
  ): Promise<RedmineResult<null>> {
    const result = await this.#redmine.version.create(
      projectId,
      toLibraryQuery(attrs),
    );
    if (result.isErr()) {
      return { ok: false, error: await errorFromCause(result.error) };
    }
    return { ok: true, value: null };
  }

  async update(
    id: number,
    attrs: VersionUpdate,
  ): Promise<RedmineResult<null>> {
    const result = await this.#redmine.version.update(
      id,
      toLibraryQuery(attrs),
    );
    if (result.isErr()) {
      return { ok: false, error: await errorFromCause(result.error) };
    }
    return { ok: true, value: null };
  }

  async delete(id: number): Promise<RedmineResult<null>> {
    const result = await this.#redmine.version.delete(id);
    if (result.isErr()) {
      return { ok: false, error: await errorFromCause(result.error) };
    }
    return { ok: true, value: null };
  }
}
