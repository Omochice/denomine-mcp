import * as v from "@valibot/valibot";
import type { Mode } from "../mode.ts";

export const listInput = v.object({
  action: v.literal("list"),
  projectId: v.number(),
});

export const showInput = v.object({
  action: v.literal("show"),
  projectId: v.number(),
  title: v.string(),
  version: v.optional(v.number()),
});

export const createInput = v.object({
  action: v.literal("create"),
  projectId: v.number(),
  title: v.string(),
  text: v.string(),
  comments: v.optional(v.string()),
  parentTitle: v.optional(v.string()),
});

export const updateInput = v.object({
  action: v.literal("update"),
  projectId: v.number(),
  title: v.string(),
  text: v.string(),
  comments: v.optional(v.string()),
  version: v.optional(v.number()),
  parentTitle: v.optional(v.string()),
});

export const deleteInput = v.object({
  action: v.literal("delete"),
  projectId: v.number(),
  title: v.string(),
});

/** Every wiki-tool argument shape, discriminated by `action`. */
export type WikiToolInput =
  | v.InferOutput<typeof listInput>
  | v.InferOutput<typeof showInput>
  | v.InferOutput<typeof createInput>
  | v.InferOutput<typeof updateInput>
  | v.InferOutput<typeof deleteInput>;

/**
 * Builds the wiki-tool argument schema for the given mode; `readonly` drops the
 * write actions so a mutation is inexpressible (ADR-0001).
 */
export function wikiInputSchema(mode: Mode) {
  const read = [listInput, showInput] as const;
  const write = [createInput, updateInput, deleteInput] as const;
  return mode === "readonly"
    ? v.variant("action", [...read])
    : v.variant("action", [...read, ...write]);
}
