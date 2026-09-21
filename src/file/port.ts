import type { Result } from "@praha/byethrow";

/**
 * Success or failure of a filesystem call. The failure is the raw {@link Error}
 * the filesystem reported, because a port knows nothing of the HTTP-shaped
 * payload the tool layer hands back to the model.
 */
export type FileResult<T> = Result.Result<T, Error>;

/**
 * The filesystem writes the tool layer depends on. The core depends only on this
 * port; the real backend binds it to Deno, and a fake backs the unit tests,
 * which run without write permission (see ADR-0007).
 */
export type FilePort = {
  /**
   * Writes a stream to `path` without ever replacing an existing file, failing
   * once more than `maxSize` bytes have arrived. The bytes are counted as they
   * stream, because the size a server declares is not the size it sends.
   *
   * @returns The absolute path written.
   */
  save(
    path: string,
    body: ReadableStream<Uint8Array>,
    maxSize: number,
  ): Promise<FileResult<string>>;
};
