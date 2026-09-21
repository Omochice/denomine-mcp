import { Result } from "@praha/byethrow";
import type { FilePort, FileResult } from "./port.ts";

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function bounded(maxSize: number): TransformStream<Uint8Array, Uint8Array> {
  let written = 0;
  return new TransformStream({
    transform(chunk, controller) {
      written += chunk.byteLength;
      if (written > maxSize) {
        throw new Error(
          `content exceeds the maxSize limit of ${maxSize} bytes`,
        );
      }
      controller.enqueue(chunk);
    },
  });
}

/**
 * Real {@link FilePort} backed by Deno's filesystem. The content is piped
 * straight to disk so an attachment of any size never has to be held in memory.
 */
export class LocalFile implements FilePort {
  async save(
    path: string,
    body: ReadableStream<Uint8Array>,
    maxSize: number,
  ): Promise<FileResult<string>> {
    let file: Deno.FsFile;
    try {
      file = await Deno.open(path, { write: true, createNew: true });
    } catch (error) {
      await body.cancel().catch(() => {});
      return Result.fail(toError(error));
    }

    try {
      await body.pipeThrough(bounded(maxSize)).pipeTo(file.writable);
    } catch (error) {
      // Removal is best-effort: its own failure must not replace the error that
      // actually explains why the download did not complete.
      await Deno.remove(path).catch(() => {});
      return Result.fail(toError(error));
    }

    try {
      return Result.succeed(await Deno.realPath(path));
    } catch (error) {
      return Result.fail(toError(error));
    }
  }
}
