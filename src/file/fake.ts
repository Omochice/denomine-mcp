import { Result } from "@praha/byethrow";
import { basename } from "@std/path";
import type { FilePort, FileResult, LocalContent } from "./port.ts";
import { releaseStream } from "../stream.ts";

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
 * filesystem at all, and that the byte limit arrived with it. Only the seeded
 * `files` can be opened, and each one disposed is listed in `released`.
 */
export class FakeFilePort implements FilePort {
  readonly saved: SavedFile[] = [];
  readonly released: string[] = [];
  readonly #failWith?: string;
  readonly #files: Map<string, string>;

  constructor(options?: { failWith?: string; files?: Record<string, string> }) {
    this.#failWith = options?.failWith;
    this.#files = new Map(Object.entries(options?.files ?? {}));
  }

  async save(
    path: string,
    body: ReadableStream<Uint8Array>,
    maxSize: number,
  ): Promise<FileResult<string>> {
    const bytes = new Uint8Array(await new Response(body).arrayBuffer());
    if (this.#failWith != null) {
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

  open(path: string): Promise<FileResult<LocalContent>> {
    const content = this.#files.get(path);
    if (content == null) {
      return Promise.resolve(
        Result.fail(new Error(`No such file or directory: ${path}`)),
      );
    }
    const bytes = new TextEncoder().encode(content);
    const body = ReadableStream.from([bytes]);
    return Promise.resolve(Result.succeed({
      filename: basename(path),
      size: bytes.byteLength,
      body,
      [Symbol.asyncDispose]: async () => {
        this.released.push(path);
        await releaseStream(body);
      },
    }));
  }
}
