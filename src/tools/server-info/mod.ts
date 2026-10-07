import { dedent } from "@std/text/unstable-dedent";
import { Result } from "@praha/byethrow";
import { type BuildInfo, readBuildInfo } from "../../build/info.ts";
import type { ToolModule } from "../../mcp/tool.ts";
import { toToolResponse } from "../response.ts";
import { VERSION } from "../../version.ts";
import { serverInfoInputSchema } from "./schema.ts";

/**
 * Packages a tool that reports this server's version and the commit it was
 * built from, so a model can include them in a bug report.
 *
 * @param read Reads the build info; the embedded file by default.
 */
export function serverInfoTool(
  read: () => Promise<BuildInfo | undefined> = readBuildInfo,
): ToolModule {
  return {
    name: "denomine_mcp_info",
    description: () =>
      dedent`
        Report this denomine-mcp server's own release version and the git commit it was built from, for bug reports and debugging.
        This describes the MCP server itself, not a Redmine version; use \`redmine_versions\` for those.
        \`build\` is null when the server runs from source instead of a compiled binary, and \`dirty\` says whether the build had uncommitted changes.
        Pass the arguments under the single key \`show\`: \`{"show": {}}\`.
      `,
    schema: () => serverInfoInputSchema(),
    handle: async () =>
      toToolResponse(
        Result.succeed({ version: VERSION, build: await read() ?? null }),
      ),
  };
}
