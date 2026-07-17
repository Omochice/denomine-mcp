import * as v from "@valibot/valibot";
import type { Mode } from "../mode.ts";

const relationType = v.picklist([
  "relates",
  "duplicates",
  "duplicated",
  "blocks",
  "blocked",
  "precedes",
  "follows",
  "copied_to",
  "copied_from",
]);

export const listInput = v.object({
  action: v.literal("list"),
  issueId: v.number(),
});

export const showInput = v.object({
  action: v.literal("show"),
  id: v.number(),
});

export const createInput = v.object({
  action: v.literal("create"),
  issueId: v.number(),
  issueToId: v.number(),
  relationType,
  delay: v.optional(v.number()),
});

export const deleteInput = v.object({
  action: v.literal("delete"),
  id: v.number(),
});

/** Every relation-tool argument shape, discriminated by `action`. */
export type RelationToolInput =
  | v.InferOutput<typeof listInput>
  | v.InferOutput<typeof showInput>
  | v.InferOutput<typeof createInput>
  | v.InferOutput<typeof deleteInput>;

/**
 * Builds the relation-tool argument schema for the given mode; `readonly` drops
 * the write actions so a mutation is inexpressible (ADR-0001). Redmine has no
 * relation update, so the write actions are just create and delete.
 */
export function relationInputSchema(mode: Mode) {
  const read = [listInput, showInput] as const;
  const write = [createInput, deleteInput] as const;
  return mode === "readonly"
    ? v.variant("action", [...read])
    : v.variant("action", [...read, ...write]);
}
