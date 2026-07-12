import type { VersionPort } from "../../redmine/port.ts";
import type { ToolModule } from "../../mcp/tool.ts";
import { handleVersion } from "./handler.ts";
import { versionInputSchema, type VersionToolInput } from "./schema.ts";

/**
 * Packages the version schema and handler as a {@link ToolModule} bound to a
 * port. The server validates arguments against the same schema before calling
 * `handle`, so the cast to {@link VersionToolInput} is sound.
 */
export function versionTool(port: VersionPort): ToolModule {
  return {
    name: "redmine_versions",
    description:
      "Create, read, update, and delete Redmine project versions (milestones). Choose the operation with `action`.",
    schema: (mode) => versionInputSchema(mode),
    handle: (input) => handleVersion(port, input as VersionToolInput),
  };
}
