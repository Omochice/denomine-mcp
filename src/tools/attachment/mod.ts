import { dedent } from "@std/text/unstable-dedent";
import type { AttachmentPort } from "../../redmine/port.ts";
import type { FilePort } from "../../file/port.ts";
import type { ToolModule } from "../../mcp/tool.ts";
import { handleAttachment } from "./handler.ts";
import { attachmentInputSchema, type AttachmentToolInput } from "./schema.ts";

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
    description: () =>
      dedent`
        Reads Redmine attachments: \`show\` returns the metadata of one attachment, and \`download\` saves its content to a local file.
        Call \`show\` first to inspect \`filesize\` and \`contentType\`, since the content is never returned inline.
        \`download\` takes \`path\`, the destination file path to write (absolute is recommended); it never overwrites a file that already exists, and answers with the path it wrote plus the filename, content type, and size.
        \`maxSize\` bounds how many bytes may be written, 500 MiB by default; pass a smaller limit when the attachment should be refused above it, reading \`filesize\` from \`show\` to choose one.
      `,
    schema: (mode) => attachmentInputSchema(mode),
    handle: (input) =>
      handleAttachment(port, files, input as AttachmentToolInput),
  };
}
