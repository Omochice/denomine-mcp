import type { EnumerationPort, RedmineResult } from "../../redmine/port.ts";
import { type ToolResponse, toToolResponse } from "../response.ts";
import type { EnumerationToolInput } from "./schema.ts";

/** Runs one enumeration-tool call against the port and maps it to an MCP response. */
export async function handleEnumeration(
  port: EnumerationPort,
  input: EnumerationToolInput,
): Promise<ToolResponse> {
  return toToolResponse(await dispatch(port, input));
}

function dispatch(
  port: EnumerationPort,
  input: EnumerationToolInput,
): Promise<RedmineResult<unknown>> {
  switch (input.action) {
    case "listTimeEntryActivities":
      return port.listTimeEntryActivities();
    case "listIssuePriorities":
      return port.listIssuePriorities();
    case "listDocumentCategories":
      return port.listDocumentCategories();
  }
}
