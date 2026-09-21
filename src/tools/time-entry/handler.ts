import type { RedmineResult, TimeEntryPort } from "../../redmine/port.ts";
import { type ToolResponse, toToolResponse } from "../response.ts";
import type { TimeEntryToolInput } from "./schema.ts";

/** Runs one time-entry-tool call against the port and maps it to an MCP response. */
export async function handleTimeEntry(
  port: TimeEntryPort,
  input: TimeEntryToolInput,
): Promise<ToolResponse> {
  return toToolResponse(await dispatch(port, input));
}

function dispatch(
  port: TimeEntryPort,
  input: TimeEntryToolInput,
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
