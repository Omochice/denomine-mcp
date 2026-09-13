import type { TimeEntryPort } from "../../redmine/port.ts";
import type { ToolModule } from "../../mcp/tool.ts";
import { describeCrudTool } from "../describe.ts";
import { handleTimeEntry } from "./handler.ts";
import { timeEntryInputSchema, type TimeEntryToolInput } from "./schema.ts";

/** Binds the time-entry schema and handler to a port as a {@link ToolModule}. */
export function timeEntryTool(port: TimeEntryPort): ToolModule {
  return {
    name: "redmine_time_entries",
    description: (mode) => describeCrudTool("time entries", mode),
    schema: (mode) => timeEntryInputSchema(mode),
    handle: (input) => handleTimeEntry(port, input as TimeEntryToolInput),
  };
}
