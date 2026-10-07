import { Result } from "@praha/byethrow";
import { basename } from "@std/path";
import type { FilePort, FileResult, LocalContent } from "./port.ts";
import { releaseStream } from "../stream.ts";

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
 * Real {@link FilePort} backed by Deno's filesystem. Content is streamed in both
 * directions, so a file of any size never has to be held in memory.
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

  async open(path: string): Promise<FileResult<LocalContent>> {
    try {
      using stack = new DisposableStack();
      const file = stack.use(await Deno.open(path, { read: true }));
      const info = await file.stat();
      if (!info.isFile) {
        throw new Error(`${path} is not a regular file`);
      }
      stack.move();
      const body = file.readable;
      return Result.succeed({
        filename: basename(path),
        size: info.size,
        body,
        [Symbol.asyncDispose]: () => releaseStream(body),
      });
    } catch (error) {
      return Result.fail(toError(error));
    }
  }
}
