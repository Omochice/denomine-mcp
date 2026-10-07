import { Result } from "@praha/byethrow";
import type { AttachmentPort } from "../../redmine/port.ts";
import type { FilePort } from "../../file/port.ts";
import { type ToolResponse, toToolResponse } from "../response.ts";
import type { AttachmentToolInput } from "./schema.ts";

type DownloadInput = Extract<AttachmentToolInput, { action: "download" }>;
type AttachInput = Extract<AttachmentToolInput, { action: "attach" }>;

/**
 * Runs one attachment-tool call and maps the outcome to an MCP response
 * (ADR-0002). A download or an attach crosses two boundaries — Redmine and the
 * filesystem — and a failure at either is reported in the same shape.
 */
export async function handleAttachment(
  port: AttachmentPort,
  files: FilePort,
  input: AttachmentToolInput,
): Promise<ToolResponse> {
  switch (input.action) {
    case "show":
      return toToolResponse(await port.show(input.id));
    case "download":
      return await download(port, files, input);
    case "attach":
      return await attach(port, files, input);
  }
}

/**
 * `maxSize` is checked twice: against the size Redmine declares, so an
 * oversized attachment never opens a file at all, and again by the file port
 * against the bytes that actually arrive.
 */
async function download(
  port: AttachmentPort,
  files: FilePort,
  input: DownloadInput,
): Promise<ToolResponse> {
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

async function attach(
  port: AttachmentPort,
  files: FilePort,
  input: AttachInput,
): Promise<ToolResponse> {
  const opened = await files.open(input.path);
  if (Result.isFailure(opened)) {
    return toToolResponse(
      Result.fail({ status: 0, errors: [opened.error.message] }),
    );
  }

  const { body, size } = opened.value;
  const filename = input.filename ?? opened.value.filename;
  const attached = await port.attach(input.issueId, body, {
    filename,
    ...(input.description == null ? {} : { description: input.description }),
    ...(input.notes == null ? {} : { notes: input.notes }),
  });
  if (Result.isFailure(attached)) {
    // A request that failed before reading the stream leaves the file open.
    await body.cancel().catch(() => {});
    return toToolResponse(attached);
  }
  return toToolResponse(
    Result.succeed({ issueId: input.issueId, filename, filesize: size }),
  );
}
