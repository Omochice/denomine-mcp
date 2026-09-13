import * as v from "@valibot/valibot";
import type { Mode } from "../mode.ts";

const identifier = v.pipe(
  v.string(),
  v.regex(/^\S+$/, "must not contain whitespace"),
);

const projectId = v.pipe(
  v.union([v.number(), identifier]),
  v.description(
    "Numeric project id, or the project identifier from a Redmine URL (the <identifier> in /projects/<identifier>/wiki/...).",
  ),
);

const title = v.pipe(
  v.string(),
  v.regex(/\S/, "must not be blank"),
  v.description(
    "Wiki page title. When taken from a URL, percent-decode it first; Redmine stores spaces as underscores, so either form of a multi-word title works.",
  ),
);

export const listInput = v.object({
  action: v.literal("list"),
  projectId,
});

export const showInput = v.object({
  action: v.literal("show"),
  projectId,
  title,
  version: v.optional(v.number()),
});

export const createInput = v.object({
  action: v.literal("create"),
  projectId,
  title,
  text: v.string(),
  comments: v.optional(v.string()),
  parentTitle: v.optional(v.string()),
});

export const updateInput = v.object({
  action: v.literal("update"),
  projectId,
  title,
  text: v.string(),
  comments: v.optional(v.string()),
  version: v.optional(v.number()),
  parentTitle: v.optional(v.string()),
});

export const deleteInput = v.object({
  action: v.literal("delete"),
  projectId,
  title,
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
