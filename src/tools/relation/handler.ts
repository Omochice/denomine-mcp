import type { RedmineResult, RelationPort } from "../../redmine/port.ts";
import { type ToolResponse, toToolResponse } from "../response.ts";
import type { RelationToolInput } from "./schema.ts";

/**
 * Runs one relation-tool call against the port and maps the outcome to an MCP
 * response (ADR-0002).
 */
export async function handleRelation(
  port: RelationPort,
  input: RelationToolInput,
): Promise<ToolResponse> {
  return toToolResponse(await dispatch(port, input));
}

function dispatch(
  port: RelationPort,
  input: RelationToolInput,
): Promise<RedmineResult<unknown>> {
  switch (input.action) {
    case "list":
      return port.list(input.issueId);
    case "show":
      return port.show(input.id);
    case "create": {
      const { action: _action, issueId, ...attrs } = input;
      return port.create(issueId, attrs);
    }
    case "delete":
      return port.delete(input.id);
  }
}
