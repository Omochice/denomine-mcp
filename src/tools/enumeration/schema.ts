import * as v from "@valibot/valibot";
import type { Mode } from "../mode.ts";

export const listTimeEntryActivitiesInput = v.object({
  action: v.literal("listTimeEntryActivities"),
});

export const listIssuePrioritiesInput = v.object({
  action: v.literal("listIssuePriorities"),
});

export const listDocumentCategoriesInput = v.object({
  action: v.literal("listDocumentCategories"),
});

/** Every enumeration-tool argument shape, discriminated by `action`. */
export type EnumerationToolInput =
  | v.InferOutput<typeof listTimeEntryActivitiesInput>
  | v.InferOutput<typeof listIssuePrioritiesInput>
  | v.InferOutput<typeof listDocumentCategoriesInput>;

/** Builds the enumeration-tool argument schema; every action is read-only. */
export function enumerationInputSchema(_mode: Mode) {
  return v.variant("action", [
    listTimeEntryActivitiesInput,
    listIssuePrioritiesInput,
    listDocumentCategoriesInput,
  ]);
}
