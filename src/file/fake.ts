import { Result } from "@praha/byethrow";
import type { FilePort, FileResult } from "./port.ts";

/** A save the fake recorded, with the stream drained to text. */
export type SavedFile = {
  path: string;
  content: string;
  maxSize: number;
};

/**
 * In-memory {@link FilePort} for unit tests, standing in for the filesystem so
 * the handler can be exercised without write permission (ADR-0007). The
 * recorded saves let a test assert that a failed download never reached the
 * filesystem at all, and that the byte limit arrived with it.
 */
export class FakeFilePort implements FilePort {
  readonly saved: SavedFile[] = [];
  readonly #failWith?: string;

  constructor(options?: { failWith: string }) {
    this.#failWith = options?.failWith;
  }

  async save(
    path: string,
    body: ReadableStream<Uint8Array>,
    maxSize: number,
  ): Promise<FileResult<string>> {
    const bytes = new Uint8Array(await new Response(body).arrayBuffer());
    if (this.#failWith !== undefined) {
      return Result.fail(new Error(this.#failWith));
    }
    if (bytes.byteLength > maxSize) {
      return Result.fail(
        new Error(`content exceeds the maxSize limit of ${maxSize} bytes`),
      );
    }
    this.saved.push({
      path,
      content: new TextDecoder().decode(bytes),
      maxSize,
    });
    return Result.succeed(`/absolute/${path}`);
  }
}
