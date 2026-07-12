import * as v from "@valibot/valibot";
import type { Mode } from "../mode.ts";

const status = v.picklist(["open", "locked", "closed"]);
const sharing = v.picklist([
  "none",
  "descendants",
  "hierarchy",
  "tree",
  "system",
]);

export const listInput = v.object({
  action: v.literal("list"),
  projectId: v.number(),
});

export const showInput = v.object({
  action: v.literal("show"),
  id: v.number(),
});

export const createInput = v.object({
  action: v.literal("create"),
  projectId: v.number(),
  name: v.string(),
  description: v.optional(v.string()),
  status: v.optional(status),
  dueDate: v.optional(v.string()),
  sharing: v.optional(sharing),
  wikiPageTitle: v.optional(v.string()),
});

export const updateInput = v.object({
  action: v.literal("update"),
  id: v.number(),
  name: v.optional(v.string()),
  description: v.optional(v.string()),
  status: v.optional(status),
  dueDate: v.optional(v.string()),
  sharing: v.optional(sharing),
  wikiPageTitle: v.optional(v.string()),
});

export const deleteInput = v.object({
  action: v.literal("delete"),
  id: v.number(),
});

/** Every version-tool argument shape, discriminated by `action`. */
export type VersionToolInput =
  | v.InferOutput<typeof listInput>
  | v.InferOutput<typeof showInput>
  | v.InferOutput<typeof createInput>
  | v.InferOutput<typeof updateInput>
  | v.InferOutput<typeof deleteInput>;

/**
 * Builds the version-tool argument schema for the given mode; `readonly` drops
 * the write actions so a mutation is inexpressible (ADR-0001).
 */
export function versionInputSchema(mode: Mode) {
  const read = [listInput, showInput] as const;
  const write = [createInput, updateInput, deleteInput] as const;
  return mode === "readonly"
    ? v.variant("action", [...read])
    : v.variant("action", [...read, ...write]);
}
