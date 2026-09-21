import { Redmine } from "@omochice/redmine";
import { Result } from "@praha/byethrow";
import { toRedmineError } from "./error.ts";
import type {
  AttachmentContent,
  AttachmentPort,
  RedmineContext,
  RedmineResult,
} from "./port.ts";

/**
 * Real {@link AttachmentPort} backed by `@omochice/redmine`.
 *
 * The library throws on failure (ADR-0002), so each operation runs through
 * `Result.try`, mapping a throw to a {@link RedmineError} via
 * {@link toRedmineError}.
 */
export class AttachmentClient implements AttachmentPort {
  readonly #redmine: Redmine;

  constructor(context: RedmineContext) {
    this.#redmine = new Redmine(context);
  }

  show(id: number): Promise<RedmineResult<unknown>> {
    return Result.try({
      try: () => this.#redmine.attachment.show(id),
      catch: toRedmineError,
    });
  }

  download(id: number): Promise<RedmineResult<AttachmentContent>> {
    return Result.try({
      try: () => this.#redmine.attachment.download(id),
      catch: toRedmineError,
    });
  }
}
