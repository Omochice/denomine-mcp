import type { VersionPort } from "../../redmine/port.ts";
import type { ToolModule } from "../../mcp/tool.ts";
import { describeCrudTool } from "../describe.ts";
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
    description: (mode) =>
      describeCrudTool("project versions (milestones)", mode),
    schema: (mode) => versionInputSchema(mode),
    handle: (input) => handleVersion(port, input as VersionToolInput),
  };
}
