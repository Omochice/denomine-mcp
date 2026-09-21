import * as v from "@valibot/valibot";
import type { Mode } from "../mode.ts";

export const listInput = v.object({
  action: v.literal("list"),
  projectId: v.optional(v.number()),
  userId: v.optional(v.number()),
  spentOn: v.optional(v.string()),
  from: v.optional(v.string()),
  to: v.optional(v.string()),
});

export const showInput = v.object({
  action: v.literal("show"),
  id: v.number(),
});

export const createInput = v.object({
  action: v.literal("create"),
  hours: v.number(),
  issueId: v.optional(v.number()),
  projectId: v.optional(v.number()),
  spentOn: v.optional(v.string()),
  activityId: v.optional(v.number()),
  comments: v.optional(v.string()),
});

export const updateInput = v.object({
  action: v.literal("update"),
  id: v.number(),
  hours: v.optional(v.number()),
  issueId: v.optional(v.number()),
  projectId: v.optional(v.number()),
  spentOn: v.optional(v.string()),
  activityId: v.optional(v.number()),
  comments: v.optional(v.string()),
});

export const deleteInput = v.object({
  action: v.literal("delete"),
  id: v.number(),
});

/** Every time-entry-tool argument shape, discriminated by `action`. */
export type TimeEntryToolInput =
  | v.InferOutput<typeof listInput>
  | v.InferOutput<typeof showInput>
  | v.InferOutput<typeof createInput>
  | v.InferOutput<typeof updateInput>
  | v.InferOutput<typeof deleteInput>;

/** Builds the time-entry-tool argument schema; `readonly` drops the writes (ADR-0001). */
export function timeEntryInputSchema(mode: Mode) {
  const read = [listInput, showInput] as const;
  const write = [createInput, updateInput, deleteInput] as const;
  return mode === "readonly"
    ? v.variant("action", [...read])
    : v.variant("action", [...read, ...write]);
}
