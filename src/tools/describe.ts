import type { Mode } from "./mode.ts";

/**
 * Builds a resource tool's description for the given mode. In `readonly` mode
 * the write verbs are dropped so the advertised description matches the pruned
 * schema (ADR-0001) instead of promising mutations the tool cannot perform.
 *
 * @param resource The plural resource noun, e.g. `"issues"` or `"wiki pages"`.
 */
export function describeCrudTool(resource: string, mode: Mode): string {
  const summary = mode === "readonly"
    ? `List and show Redmine ${resource}`
    : `Create, read, update, and delete Redmine ${resource}`;
  return `${summary}. Choose the operation with \`action\`.`;
}
