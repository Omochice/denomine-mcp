import * as v from "@valibot/valibot";
import type { Mode } from "../mode.ts";

const isoDate = v.pipe(v.string(), v.isoDate());

const datePeriod = v.picklist([
  "today",
  "yesterday",
  "thisWeek",
  "lastWeek",
  "lastTwoWeeks",
  "thisMonth",
  "lastMonth",
  "thisYear",
  "any",
  "none",
]);

const futureDatePeriod = v.picklist(["tomorrow", "nextWeek", "nextMonth"]);

// Redmine reads a relative bound as a whole number of days back or forward, and
// counts 0 as today; a negative or fractional count has no wire form.
const dayOffset = v.pipe(v.number(), v.integer(), v.minValue(0));

const daysAgo = v.strictObject({ daysAgo: dayOffset });
const daysFromNow = v.strictObject({ daysFromNow: dayOffset });

// A relative bound alone names one day, while the same bound inside `from` or
// `to` opens a span. Both read alike, so each form says which it is: a model
// reaching for `{ daysAgo: 7 }` to mean "the last week" would otherwise get the
// single day a week ago, with nothing to signal the mismatch.
const describe = <T extends v.GenericSchema>(schema: T, text: string) =>
  v.pipe(schema, v.description(text));

// strictObject, not object: object() strips unknown keys, so `{ from }` would
// also match `{ from, to }` and drop the upper bound, turning a range into an
// open-ended filter without an error.
const pastDateFilter = v.union([
  describe(isoDate, "That day."),
  datePeriod,
  describe(daysAgo, "The single day that many days ago."),
  describe(
    v.strictObject({ from: isoDate, to: v.optional(isoDate) }),
    "On or after `from`, and on or before `to` when it is given.",
  ),
  describe(
    v.strictObject({ from: v.optional(isoDate), to: isoDate }),
    "On or before `to`.",
  ),
  describe(
    v.strictObject({ from: daysAgo, to: v.optional(v.literal("today")) }),
    "The last n days: on or after the day n days ago.",
  ),
  describe(
    v.strictObject({ to: daysAgo }),
    "On or before the day n days ago.",
  ),
]);

// The forward-looking forms are added only here: Redmine types created_on,
// updated_on and closed_on as `:date_past` and answers 422 for them there.
const dateFilter = v.union([
  ...pastDateFilter.options,
  futureDatePeriod,
  describe(daysFromNow, "The single day that many days from now."),
  describe(
    v.strictObject({ from: daysFromNow }),
    "On or after the day n days from now.",
  ),
  describe(
    v.strictObject({ to: daysFromNow }),
    "On or before the day n days from now.",
  ),
  describe(
    v.strictObject({ from: v.literal("today"), to: daysFromNow }),
    "The next n days: today through the day n days from now.",
  ),
]);

export const listInput = v.object({
  action: v.literal("list"),
  include: v.optional(
    describe(
      v.array(v.picklist(["attachments", "relations"])),
      "Associations Redmine omits unless asked for. A listed issue carries only these two; `journals` are available through `show`.",
    ),
  ),
  projectId: v.optional(v.number()),
  trackerId: v.optional(v.number()),
  statusId: v.optional(
    v.union([v.number(), v.picklist(["open", "closed", "*"])]),
  ),
  fixedVersionId: v.optional(v.number()),
  assignedToId: v.optional(v.union([v.number(), v.literal("me")])),
  startDate: v.optional(dateFilter),
  dueDate: v.optional(dateFilter),
  createdOn: v.optional(pastDateFilter),
  updatedOn: v.optional(pastDateFilter),
  closedOn: v.optional(pastDateFilter),
  limit: v.optional(v.number()),
});

export const showInput = v.object({
  action: v.literal("show"),
  id: v.number(),
  include: v.optional(
    describe(
      v.array(
        v.picklist([
          "journals",
          "attachments",
          "relations",
          "children",
          "changesets",
          "watchers",
          "allowedStatuses",
        ]),
      ),
      "Associations Redmine omits unless asked for. `journals` are the comments and the field-change history.",
    ),
  ),
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
