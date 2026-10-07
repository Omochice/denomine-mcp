import * as v from "@valibot/valibot";
import { recordId } from "../record-id.ts";
import type { Mode } from "../mode.ts";

const notBlank = v.pipe(v.string(), v.regex(/\S/, "must not be blank"));

const path = v.pipe(
  notBlank,
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

export const showInput = v.strictObject({
  action: v.literal("show"),
  id: recordId,
});

export const downloadInput = v.strictObject({
  action: v.literal("download"),
  id: recordId,
  path,
  maxSize,
});

export const attachInput = v.strictObject({
  action: v.literal("attach"),
  path: v.pipe(
    notBlank,
    v.description(
      "Local file to attach. An absolute path is recommended, because a relative one resolves against the working directory of the server process.",
    ),
  ),
  issueId: recordId,
  filename: v.optional(
    v.pipe(
      notBlank,
      v.description(
        "Name the attachment is shown under; the last segment of `path` by default.",
      ),
    ),
  ),
  description: v.optional(v.string()),
  notes: v.optional(
    v.pipe(
      v.string(),
      v.description(
        "Comment to add to the issue in the same history entry as the attachment.",
      ),
    ),
  ),
});

/** Every attachment-tool argument shape, discriminated by `action`. */
export type AttachmentToolInput =
  | v.InferOutput<typeof showInput>
  | v.InferOutput<typeof downloadInput>
  | v.InferOutput<typeof attachInput>;

/**
 * Builds the attachment-tool argument schema for the given mode. `readonly`
 * prunes what mutates Redmine (ADR-0001), so it drops `attach` but keeps
 * `download`, which only reads Redmine and writes to the caller's own
 * filesystem.
 */
export function attachmentInputSchema(mode: Mode) {
  const read = [showInput, downloadInput] as const;
  return mode === "readonly"
    ? v.variant("action", [...read])
    : v.variant("action", [...read, attachInput]);
}
