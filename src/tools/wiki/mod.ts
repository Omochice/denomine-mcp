import type { WikiPort } from "../../redmine/port.ts";
import type { ToolModule } from "../../mcp/tool.ts";
import { handleWiki } from "./handler.ts";
import { wikiInputSchema, type WikiToolInput } from "./schema.ts";

/**
 * Packages the wiki schema and handler as a {@link ToolModule} bound to a port.
 * The server validates arguments against the same schema before calling
 * `handle`, so the cast to {@link WikiToolInput} is sound.
 */
export function wikiTool(port: WikiPort): ToolModule {
  return {
    name: "redmine_wiki_pages",
    description:
      "Create, read, update, and delete Redmine wiki pages. Choose the operation with `action`.",
    schema: (mode) => wikiInputSchema(mode),
    handle: (input) => handleWiki(port, input as WikiToolInput),
  };
}
