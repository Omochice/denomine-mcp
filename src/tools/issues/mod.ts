import type { IssuePort } from "../../redmine/port.ts";
import type { ToolModule } from "../../mcp/tool.ts";
import { handleIssue } from "./handler.ts";
import { issueInputSchema, type IssueToolInput } from "./schema.ts";

/**
 * Packages the issue schema and handler as a {@link ToolModule} bound to a port.
 * The server validates arguments against the same schema before calling
 * `handle`, so the cast to {@link IssueToolInput} is sound.
 */
export function issuesTool(port: IssuePort): ToolModule {
  return {
    name: "redmine_issues",
    description:
      "Create, read, update, and delete Redmine issues. Choose the operation with `action`.",
    schema: (mode) => issueInputSchema(mode),
    handle: (input) => handleIssue(port, input as IssueToolInput),
  };
}
