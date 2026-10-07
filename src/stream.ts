/**
 * Cancels a stream so the resource behind it is released, for use as the
 * disposer of a value that carries the stream. Cancelling a stream that has
 * already been read to the end does nothing, and a stream still locked by a
 * reader is left to that reader, so disposal never throws over the error that
 * ended the scope.
 */
export async function releaseStream(
  stream: ReadableStream<Uint8Array>,
): Promise<void> {
  await stream.cancel().catch(() => {});
}
