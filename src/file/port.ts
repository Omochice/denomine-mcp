import type { Result } from "@praha/byethrow";

/**
 * Success or failure of a filesystem call. The failure is the raw {@link Error}
 * the filesystem reported, because a port knows nothing of the HTTP-shaped
 * payload the tool layer hands back to the model.
 */
export type FileResult<T> = Result.Result<T, Error>;

/**
 * A local file opened for reading, with the name and size it has on disk.
 * Disposing it releases the file whether or not the stream was read.
 */
export type LocalContent = AsyncDisposable & {
  filename: string;
  size: number;
  body: ReadableStream<Uint8Array>;
};

/**
 * The filesystem access the tool layer depends on. The core depends only on
 * this port; the real backend binds it to Deno, and a fake backs the unit tests,
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
  /**
   * Opens the regular file at `path` for reading. The content is a stream, so
   * a file of any size can be passed on without being held in memory.
   */
  open(path: string): Promise<FileResult<LocalContent>>;
};
