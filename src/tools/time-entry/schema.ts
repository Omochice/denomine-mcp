import * as v from "@valibot/valibot";
import { recordId } from "../record-id.ts";
import type { Mode } from "../mode.ts";

export const listInput = v.strictObject({
  action: v.literal("list"),
  projectId: v.optional(recordId),
  userId: v.optional(recordId),
  spentOn: v.optional(v.string()),
  from: v.optional(v.string()),
  to: v.optional(v.string()),
});

export const showInput = v.strictObject({
  action: v.literal("show"),
  id: recordId,
});

export const createInput = v.strictObject({
  action: v.literal("create"),
  hours: v.number(),
  issueId: v.optional(recordId),
  projectId: v.optional(recordId),
  spentOn: v.optional(v.string()),
  activityId: v.optional(recordId),
  comments: v.optional(v.string()),
});

export const updateInput = v.strictObject({
  action: v.literal("update"),
  id: recordId,
  hours: v.optional(v.number()),
  issueId: v.optional(recordId),
  projectId: v.optional(recordId),
  spentOn: v.optional(v.string()),
  activityId: v.optional(recordId),
  comments: v.optional(v.string()),
});

export const deleteInput = v.strictObject({
  action: v.literal("delete"),
  id: recordId,
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
