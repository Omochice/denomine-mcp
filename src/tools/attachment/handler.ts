import { Result } from "@praha/byethrow";
import type { AttachmentPort } from "../../redmine/port.ts";
import type { FilePort } from "../../file/port.ts";
import { type ToolResponse, toToolResponse } from "../response.ts";
import type { AttachmentToolInput } from "./schema.ts";

/**
 * Runs one attachment-tool call and maps the outcome to an MCP response
 * (ADR-0002). A download crosses two boundaries — Redmine and the filesystem —
 * and a failure at either is reported in the same shape.
 *
 * `maxSize` is checked twice: against the size Redmine declares, so an
 * oversized attachment never opens a file at all, and again by the file port
 * against the bytes that actually arrive.
 */
export async function handleAttachment(
  port: AttachmentPort,
  files: FilePort,
  input: AttachmentToolInput,
): Promise<ToolResponse> {
  if (input.action === "show") {
    return toToolResponse(await port.show(input.id));
  }

  const downloaded = await port.download(input.id);
  if (Result.isFailure(downloaded)) {
    return toToolResponse(downloaded);
  }

  const { body, ...metadata } = downloaded.value;
  if (metadata.filesize > input.maxSize) {
    await body.cancel().catch(() => {});
    return toToolResponse(Result.fail({
      status: 0,
      errors: [
        `attachment ${input.id} is ${metadata.filesize} bytes, which exceeds the maxSize limit of ${input.maxSize} bytes`,
      ],
    }));
  }

  const saved = await files.save(input.path, body, input.maxSize);
  if (Result.isFailure(saved)) {
    return toToolResponse(
      Result.fail({ status: 0, errors: [saved.error.message] }),
    );
  }
  return toToolResponse(Result.succeed({ path: saved.value, ...metadata }));
}
