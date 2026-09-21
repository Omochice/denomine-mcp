import * as v from "@valibot/valibot";

const identifier = v.pipe(
  v.string(),
  v.regex(/^\S+$/, "must not contain whitespace"),
);

/**
 * Argument schema for a project named in a Redmine URL path, where either the
 * numeric id or the identifier is accepted.
 */
export const projectRef = v.pipe(
  v.union([v.number(), identifier]),
  v.description(
    "Numeric project id, or the project identifier from a Redmine URL (the <identifier> in /projects/<identifier>/wiki/...).",
  ),
);
