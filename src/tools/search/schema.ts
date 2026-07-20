import * as v from "@valibot/valibot";
import type { Mode } from "../mode.ts";

export const searchInput = v.object({
  action: v.literal("search"),
  q: v.string(),
  scope: v.optional(v.string()),
  allWords: v.optional(v.boolean()),
  titlesOnly: v.optional(v.boolean()),
  openIssues: v.optional(v.boolean()),
  issues: v.optional(v.boolean()),
  news: v.optional(v.boolean()),
  documents: v.optional(v.boolean()),
  changesets: v.optional(v.boolean()),
  wikiPages: v.optional(v.boolean()),
  messages: v.optional(v.boolean()),
  projects: v.optional(v.boolean()),
  attachments: v.optional(v.union([v.boolean(), v.string()])),
});

/** The search-tool argument shape. Search has the single action `search`. */
export type SearchToolInput = v.InferOutput<typeof searchInput>;

/**
 * Builds the search-tool argument schema. Search is read-only, so the schema is
 * the same in both modes; it is still wrapped in a single-branch `action`
 * variant so it advertises an `action` enum like every other tool (ADR-0001).
 */
export function searchInputSchema(_mode: Mode) {
  return v.variant("action", [searchInput]);
}
