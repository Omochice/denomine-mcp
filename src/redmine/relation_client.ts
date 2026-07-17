import { Redmine } from "@omochice/redmine";
import { errorFromCause } from "./error.ts";
import type {
  RedmineContext,
  RedmineResult,
  RelationCreate,
  RelationPort,
} from "./port.ts";

/**
 * Real {@link RelationPort} backed by `@omochice/redmine`.
 *
 * Each operation branches the library's Result explicitly (ADR-0002).
 * `create`/`delete` carry no body, so they resolve to `null`.
 */
export class RelationClient implements RelationPort {
  readonly #redmine: Redmine;

  constructor(context: RedmineContext) {
    this.#redmine = new Redmine(context);
  }

  async list(issueId: number): Promise<RedmineResult<unknown>> {
    const result = await this.#redmine.issueRelation.list(issueId);
    if (result.isErr()) {
      return { ok: false, error: await errorFromCause(result.error) };
    }
    return { ok: true, value: result.value };
  }

  async show(id: number): Promise<RedmineResult<unknown>> {
    const result = await this.#redmine.issueRelation.show(id);
    if (result.isErr()) {
      return { ok: false, error: await errorFromCause(result.error) };
    }
    return { ok: true, value: result.value };
  }

  async create(
    issueId: number,
    attrs: RelationCreate,
  ): Promise<RedmineResult<null>> {
    const result = await this.#redmine.issueRelation.create(issueId, attrs);
    if (result.isErr()) {
      return { ok: false, error: await errorFromCause(result.error) };
    }
    return { ok: true, value: null };
  }

  async delete(id: number): Promise<RedmineResult<null>> {
    const result = await this.#redmine.issueRelation.delete(id);
    if (result.isErr()) {
      return { ok: false, error: await errorFromCause(result.error) };
    }
    return { ok: true, value: null };
  }
}
