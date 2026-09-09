import { dedent } from "@std/text/unstable-dedent";
import type { IssuePort } from "../../redmine/port.ts";
import type { ToolModule } from "../../mcp/tool.ts";
import { describeCrudTool } from "../describe.ts";
import { handleIssue } from "./handler.ts";
import { issueInputSchema, type IssueToolInput } from "./schema.ts";

/**
 * Packages the issue schema and handler as a {@link ToolModule} bound to a port.
 * The server validates arguments against the same schema before calling
 * `handle`, so the cast to {@link IssueToolInput} is sound.
 *
 * The description spells out `include` on top of the shared CRUD summary
 * because Redmine returns a bare issue by default: a model that reads only the
 * tool list would otherwise conclude that comments and history are
 * unavailable, when they merely have to be asked for.
 */
export function issuesTool(port: IssuePort): ToolModule {
  return {
    name: "redmine_issues",
    description: (mode) =>
      dedent`
        ${describeCrudTool("issues", mode)}
        \`show\` returns the bare issue; pass \`include: ["journals"]\` to get
        its comments and field-change history, and add \`attachments\`,
        \`relations\`, \`children\`, \`changesets\`, \`watchers\`, or
        \`allowedStatuses\` as needed. \`list\` accepts only \`attachments\`
        and \`relations\`.
      `,
    schema: (mode) => issueInputSchema(mode),
    handle: (input) => handleIssue(port, input as IssueToolInput),
  };
}
