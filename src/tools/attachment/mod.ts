import { dedent } from "@std/text/unstable-dedent";
import type { AttachmentPort } from "../../redmine/port.ts";
import type { FilePort } from "../../file/port.ts";
import type { Mode } from "../mode.ts";
import type { ToolModule } from "../../mcp/tool.ts";
import { handleAttachment } from "./handler.ts";
import { attachmentInputSchema, type AttachmentToolInput } from "./schema.ts";

/**
 * Describes the attachment tool for the given mode. `attach` is mentioned only
 * in `full` mode, where the schema offers it (ADR-0001).
 */
function describe(mode: Mode): string {
  const summary = mode === "readonly"
    ? dedent`
      Reads Redmine attachments: \`show\` returns the metadata of one attachment, and \`download\` saves its content to a local file.
      Pass exactly one key, \`show\` or \`download\`, whose value is an object of its arguments: \`{"show": {"id": 1}}\`.
    `
    : dedent`
      Reads and adds Redmine attachments: \`show\` returns the metadata of one attachment, \`download\` saves its content to a local file, and \`attach\` adds a local file to an issue.
      Pass exactly one key, \`show\`, \`download\`, or \`attach\`, whose value is an object of its arguments: \`{"show": {"id": 1}}\`.
    `;
  const base = dedent`
    ${summary}
    Call \`show\` first to inspect \`filesize\` and \`contentType\`, since the content is never returned inline.
    \`download\` takes \`path\`, the destination file path to write (absolute is recommended); it never overwrites a file that already exists, and answers with the path it wrote plus the filename, content type, and size.
    \`maxSize\` bounds how many bytes may be written, 500 MiB by default; pass a smaller limit when the attachment should be refused above it, reading \`filesize\` from \`show\` to choose one.
  `;
  if (mode === "readonly") {
    return base;
  }
  return dedent`
    ${base}
    \`attach\` takes \`path\`, the local file to send (absolute is recommended), and \`issueId\`, the existing issue to add it to; \`notes\` adds a comment in the same history entry. To attach a file to a new issue, create the issue with \`redmine_issues\` first.
  `;
}

/**
 * Binds the attachment schema and handler to the Redmine and filesystem ports
 * as a {@link ToolModule}. The server validates arguments against the same
 * schema before calling `handle`, so the cast to {@link AttachmentToolInput} is
 * sound.
 */
export function attachmentTool(
  port: AttachmentPort,
  files: FilePort,
): ToolModule {
  return {
    name: "redmine_attachments",
    description: describe,
    schema: (mode) => attachmentInputSchema(mode),
    handle: (input) =>
      handleAttachment(port, files, input as AttachmentToolInput),
  };
}
