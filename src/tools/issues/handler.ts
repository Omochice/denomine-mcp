import type { IssuePort, RedmineResult } from "../../redmine/port.ts";
import type { IssueToolInput } from "./schema.ts";

/** An MCP `tools/call` response: text content, flagged on failure. */
export type ToolResponse = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

/**
 * Runs one issue-tool call against the port and maps the outcome to an MCP
 * response. A success returns the payload as JSON text; a failure returns the
 * status and Redmine's validation messages with `isError` set (ADR-0002).
 */
export async function handleIssue(
  port: IssuePort,
  input: IssueToolInput,
): Promise<ToolResponse> {
  const result = await dispatch(port, input);
  if (!result.ok) {
    return {
      content: [{ type: "text", text: JSON.stringify(result.error) }],
      isError: true,
    };
  }
  const payload = result.value ?? { ok: true };
  return { content: [{ type: "text", text: JSON.stringify(payload) }] };
}

function dispatch(
  port: IssuePort,
  input: IssueToolInput,
): Promise<RedmineResult<unknown>> {
  switch (input.action) {
    case "list": {
      const { action: _action, ...query } = input;
      return port.list(query);
    }
    case "show":
      return port.show(input.id);
    case "create": {
      const { action: _action, ...attrs } = input;
      return port.create(attrs);
    }
    case "update": {
      const { action: _action, id, ...attrs } = input;
      return port.update(id, attrs);
    }
    case "delete":
      return port.delete(input.id);
  }
}
