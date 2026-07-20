import type { SearchPort } from "../../redmine/port.ts";
import type { ToolModule } from "../../mcp/tool.ts";
import { handleSearch } from "./handler.ts";
import { searchInputSchema, type SearchToolInput } from "./schema.ts";

/**
 * Packages the search schema and handler as a {@link ToolModule} bound to a
 * port. Search is read-only and mode-independent, so it carries its own
 * description rather than the shared CRUD one; the server validates arguments
 * against the same schema before calling `handle`, so the cast to
 * {@link SearchToolInput} is sound.
 */
export function searchTool(port: SearchPort): ToolModule {
  return {
    name: "redmine_search",
    description: () =>
      "Full-text search across Redmine issues, wiki pages, news, documents, " +
      "changesets, messages, and projects. Requires `q`; narrow with `scope` " +
      "and the per-resource flags. Set `action` to `search`.",
    schema: (mode) => searchInputSchema(mode),
    handle: (input) => handleSearch(port, input as SearchToolInput),
  };
}
