import type { RedmineResult, WikiPort } from "../../redmine/port.ts";
import { type ToolResponse, toToolResponse } from "../response.ts";
import type { WikiToolInput } from "./schema.ts";

/**
 * Runs one wiki-tool call against the port and maps the outcome to an MCP
 * response (ADR-0002).
 */
export async function handleWiki(
  port: WikiPort,
  input: WikiToolInput,
): Promise<ToolResponse> {
  return toToolResponse(await dispatch(port, input));
}

function dispatch(
  port: WikiPort,
  input: WikiToolInput,
): Promise<RedmineResult<unknown>> {
  switch (input.action) {
    case "list":
      return port.list(input.projectId);
    case "show":
      return port.show(input.projectId, input.title, input.version);
    case "create": {
      const { action: _action, projectId, ...wiki } = input;
      return port.create(projectId, wiki);
    }
    case "update": {
      const { action: _action, projectId, ...wiki } = input;
      return port.update(projectId, wiki);
    }
    case "delete":
      return port.delete(input.projectId, input.title);
  }
}
