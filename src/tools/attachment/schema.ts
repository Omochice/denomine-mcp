import * as v from "@valibot/valibot";
import type { Mode } from "../mode.ts";

const path = v.pipe(
  v.string(),
  v.regex(/\S/, "must not be blank"),
  v.description(
    "Destination file path for the saved content. An absolute path is recommended, because a relative one resolves against the working directory of the server process. The file must not already exist.",
  ),
);

/** The byte limit a download falls back to when the caller names none. */
export const defaultMaxSize = 500 * 1024 * 1024;

const maxSize = v.optional(
  v.pipe(
    v.number(),
    v.integer(),
    v.minValue(1),
    v.description(
      `Maximum number of bytes to write, ${defaultMaxSize} (500 MiB) by default. The download is refused, and nothing is saved, when the attachment turns out to be larger. Read \`filesize\` from \`show\` to choose a tighter limit.`,
    ),
  ),
  defaultMaxSize,
);

export const showInput = v.object({
  action: v.literal("show"),
  id: v.number(),
});

export const downloadInput = v.object({
  action: v.literal("download"),
  id: v.number(),
  path,
  maxSize,
});

/** Every attachment-tool argument shape, discriminated by `action`. */
export type AttachmentToolInput =
  | v.InferOutput<typeof showInput>
  | v.InferOutput<typeof downloadInput>;

/**
 * Builds the attachment-tool argument schema. Both actions survive `readonly`,
 * which prunes what mutates Redmine (ADR-0001); a download only reads it, and
 * writes to the caller's own filesystem.
 */
export function attachmentInputSchema(_mode: Mode) {
  return v.variant("action", [showInput, downloadInput]);
}
