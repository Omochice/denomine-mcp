import type { RedmineResult, VersionPort } from "../../redmine/port.ts";
import { type ToolResponse, toToolResponse } from "../response.ts";
import type { VersionToolInput } from "./schema.ts";

/**
 * Runs one version-tool call against the port and maps the outcome to an MCP
 * response (ADR-0002).
 */
export async function handleVersion(
  port: VersionPort,
  input: VersionToolInput,
): Promise<ToolResponse> {
  return toToolResponse(await dispatch(port, input));
}

function dispatch(
  port: VersionPort,
  input: VersionToolInput,
): Promise<RedmineResult<unknown>> {
  switch (input.action) {
    case "list":
      return port.list(input.projectId);
    case "show":
      return port.show(input.id);
    case "create": {
      const { action: _action, projectId, ...attrs } = input;
      return port.create(projectId, attrs);
    }
    case "update": {
      const { action: _action, id, ...attrs } = input;
      return port.update(id, attrs);
    }
    case "delete":
      return port.delete(input.id);
  }
}
