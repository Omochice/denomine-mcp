import { dedent } from "@std/text/unstable-dedent";
import type { IssuePort } from "../../redmine/port.ts";
import type { Mode } from "../mode.ts";
import type { ToolModule } from "../../mcp/tool.ts";
import { describeCrudTool } from "../describe.ts";
import { handleIssue } from "./handler.ts";
import { issueInputSchema, type IssueToolInput } from "./schema.ts";

/**
 * Describes the issue tool for the given mode. The comment-editing actions are
 * mentioned only in `full` mode, where the schema offers them (ADR-0001).
 */
function describe(mode: Mode): string {
  const base = dedent`
    ${describeCrudTool("issues", mode)}
    \`show\` returns the bare issue; pass \`include: ["journals"]\` to get its comments and field-change history, and add \`attachments\`, \`relations\`, \`children\`, \`changesets\`, \`watchers\`, or \`allowedStatuses\` as needed.
    \`list\` accepts only \`attachments\` and \`relations\`.
  `;
  if (mode === "readonly") {
    return base;
  }
  return dedent`
    ${base}
    \`updateNote\` edits the text or privacy of an existing comment, and \`deleteNote\` erases its text; both take the journal id that \`show\` lists.
  `;
}

/**
 * Packages the issue schema and handler as a {@link ToolModule} bound to a port.
 * The server validates arguments against the same schema before calling
 * `handle`, so the cast to {@link IssueToolInput} is sound.
 */
export function issuesTool(port: IssuePort): ToolModule {
  return {
    name: "redmine_issues",
    description: describe,
    schema: (mode) => issueInputSchema(mode),
    handle: (input) => handleIssue(port, input as IssueToolInput),
  };
}
