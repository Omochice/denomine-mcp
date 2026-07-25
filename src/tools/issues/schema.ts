import * as v from "@valibot/valibot";
import type { Mode } from "../mode.ts";

export const listInput = v.object({
  action: v.literal("list"),
  projectId: v.optional(v.number()),
  trackerId: v.optional(v.number()),
  statusId: v.optional(
    v.union([v.number(), v.picklist(["open", "closed", "*"])]),
  ),
  fixedVersionId: v.optional(v.number()),
  assignedToId: v.optional(v.union([v.number(), v.literal("me")])),
  limit: v.optional(v.number()),
});

export const showInput = v.object({
  action: v.literal("show"),
  id: v.number(),
});

export const createInput = v.object({
  action: v.literal("create"),
  projectId: v.number(),
  trackerId: v.number(),
  statusId: v.number(),
  priorityId: v.number(),
  subject: v.string(),
  description: v.optional(v.string()),
  assignedToId: v.optional(v.number()),
  parentIssueId: v.optional(v.number()),
  isPrivate: v.optional(v.boolean()),
  estimatedHours: v.optional(v.number()),
});

export const updateInput = v.object({
  action: v.literal("update"),
  id: v.number(),
  subject: v.optional(v.string()),
  description: v.optional(v.string()),
  doneRatio: v.optional(v.number()),
  isPrivate: v.optional(v.boolean()),
  estimatedHours: v.optional(v.number()),
  notes: v.optional(v.string()),
  privateNotes: v.optional(v.boolean()),
});

export const deleteInput = v.object({
  action: v.literal("delete"),
  id: v.number(),
});

/** Every issue-tool argument shape, discriminated by `action`. */
export type IssueToolInput =
  | v.InferOutput<typeof listInput>
  | v.InferOutput<typeof showInput>
  | v.InferOutput<typeof createInput>
  | v.InferOutput<typeof updateInput>
  | v.InferOutput<typeof deleteInput>;

/**
 * Builds the issue-tool argument schema for the given mode.
 *
 * In `readonly` mode the write actions are absent from the variant, so a write
 * is inexpressible rather than merely rejected at runtime (ADR-0001).
 */
export function issueInputSchema(mode: Mode) {
  const read = [listInput, showInput] as const;
  const write = [createInput, updateInput, deleteInput] as const;
  return mode === "readonly"
    ? v.variant("action", [...read])
    : v.variant("action", [...read, ...write]);
}
