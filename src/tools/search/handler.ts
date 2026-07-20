import type { RedmineResult, SearchPort } from "../../redmine/port.ts";
import { type ToolResponse, toToolResponse } from "../response.ts";
import type { SearchToolInput } from "./schema.ts";

/**
 * Runs one search-tool call against the port and maps the outcome to an MCP
 * response (ADR-0002).
 */
export async function handleSearch(
  port: SearchPort,
  input: SearchToolInput,
): Promise<ToolResponse> {
  return toToolResponse(await dispatch(port, input));
}

function dispatch(
  port: SearchPort,
  input: SearchToolInput,
): Promise<RedmineResult<unknown>> {
  const { action: _action, ...query } = input;
  return port.search(query);
}
