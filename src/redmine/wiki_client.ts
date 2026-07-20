import { Redmine } from "@omochice/redmine";
import { Result } from "@praha/byethrow";
import { errorFromCause } from "./error.ts";
import type {
  RedmineContext,
  RedmineResult,
  WikiContent,
  WikiPort,
} from "./port.ts";

/**
 * Real {@link WikiPort} backed by `@omochice/redmine`.
 *
 * Each operation branches the library's Result explicitly (ADR-0002).
 * `create`/`update`/`delete` carry no body, so they resolve to `null`.
 */
export class WikiClient implements WikiPort {
  readonly #redmine: Redmine;

  constructor(context: RedmineContext) {
    this.#redmine = new Redmine(context);
  }

  async list(projectId: number): Promise<RedmineResult<unknown>> {
    const result = await this.#redmine.wiki.list(projectId);
    if (result.isErr()) {
      return Result.fail(await errorFromCause(result.error));
    }
    return Result.succeed(result.value);
  }

  async show(
    projectId: number,
    title: string,
    version?: number,
  ): Promise<RedmineResult<unknown>> {
    const result = version === undefined
      ? await this.#redmine.wiki.show(projectId, title)
      : await this.#redmine.wiki.show(projectId, title, version);
    if (result.isErr()) {
      return Result.fail(await errorFromCause(result.error));
    }
    return Result.succeed(result.value);
  }

  async create(
    projectId: number,
    wiki: WikiContent,
  ): Promise<RedmineResult<null>> {
    const result = await this.#redmine.wiki.create(projectId, wiki);
    if (result.isErr()) {
      return Result.fail(await errorFromCause(result.error));
    }
    return Result.succeed(null);
  }

  async update(
    projectId: number,
    wiki: WikiContent,
  ): Promise<RedmineResult<null>> {
    const result = await this.#redmine.wiki.update(projectId, wiki);
    if (result.isErr()) {
      return Result.fail(await errorFromCause(result.error));
    }
    return Result.succeed(null);
  }

  async delete(
    projectId: number,
    title: string,
  ): Promise<RedmineResult<null>> {
    const result = await this.#redmine.wiki.delete(projectId, title);
    if (result.isErr()) {
      return Result.fail(await errorFromCause(result.error));
    }
    return Result.succeed(null);
  }
}
