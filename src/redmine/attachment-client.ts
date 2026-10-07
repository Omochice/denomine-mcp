import { Redmine } from "@omochice/redmine";
import { Result } from "@praha/byethrow";
import { toRedmineError } from "./error.ts";
import type {
  AttachmentContent,
  AttachmentPort,
  IssueAttachment,
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

  /**
   * Redmine attaches in two requests, an upload that answers with a token and
   * an issue update that takes it. A failed update leaves the upload stored
   * and attached to nothing; it is not removed, because the library's upload
   * returns only the token, not an attachment id to delete it by.
   */
  attach(
    issueId: number,
    body: ReadableStream<Uint8Array>,
    { filename, description, notes }: IssueAttachment,
  ): Promise<RedmineResult<null>> {
    return Result.try({
      try: async () => {
        const token = await this.#redmine.file.upload(body, filename);
        await this.#redmine.issue.update(issueId, {
          notes,
          uploads: [{ token, filename, description }],
        });
        return null;
      },
      catch: toRedmineError,
    });
  }
}
