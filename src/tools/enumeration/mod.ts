import { dedent } from "@std/text/unstable-dedent";
import type { EnumerationPort } from "../../redmine/port.ts";
import type { ToolModule } from "../../mcp/tool.ts";
import { handleEnumeration } from "./handler.ts";
import { enumerationInputSchema, type EnumerationToolInput } from "./schema.ts";

/** Binds the enumeration schema and handler to a port as a {@link ToolModule}. */
export function enumerationTool(port: EnumerationPort): ToolModule {
  return {
    name: "redmine_enumerations",
    description: () =>
      dedent`
        Lists the Redmine enumerations that supply ids other tools require: time entry activities for \`activityId\`, issue priorities for \`priorityId\`, and document categories.
        Choose the listing with \`action\`.
      `,
    schema: (mode) => enumerationInputSchema(mode),
    handle: (input) => handleEnumeration(port, input as EnumerationToolInput),
  };
}
