import type { RelationPort } from "../../redmine/port.ts";
import type { Mode } from "../mode.ts";
import type { ToolModule } from "../../mcp/tool.ts";
import { handleRelation } from "./handler.ts";
import { relationInputSchema, type RelationToolInput } from "./schema.ts";

/**
 * Describes the relation tool for the given mode. It does not use the shared
 * CRUD helper because Redmine has no relation update, so the write summary is
 * "Create, read, and delete" rather than the four-verb CRUD phrasing.
 */
function describe(mode: Mode): string {
  const summary = mode === "readonly"
    ? "List and show Redmine issue relations"
    : "Create, read, and delete Redmine issue relations";
  return `${summary}. Choose the operation with \`action\`.`;
}

/**
 * Packages the relation schema and handler as a {@link ToolModule} bound to a
 * port. The server validates arguments against the same schema before calling
 * `handle`, so the cast to {@link RelationToolInput} is sound.
 */
export function relationTool(port: RelationPort): ToolModule {
  return {
    name: "redmine_issue_relations",
    description: describe,
    schema: (mode) => relationInputSchema(mode),
    handle: (input) => handleRelation(port, input as RelationToolInput),
  };
}
