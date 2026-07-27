import type { IssuePort, RedmineResult } from "../../redmine/port.ts";
import { type ToolResponse, toToolResponse } from "../response.ts";
import type { IssueToolInput } from "./schema.ts";

/**
 * Runs one issue-tool call against the port and maps the outcome to an MCP
 * response (ADR-0002).
 */
export async function handleIssue(
  port: IssuePort,
  input: IssueToolInput,
): Promise<ToolResponse> {
  return toToolResponse(await dispatch(port, input));
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
      return port.show(input.id, input.include);
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
