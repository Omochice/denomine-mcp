import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  type CallToolRequest,
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as v from "@valibot/valibot";
import type { Mode } from "../tools/mode.ts";
import type { ToolResponse } from "../tools/response.ts";
import { Result } from "@praha/byethrow";
import { fromActionKeyed, toObjectSchema, type ToolModule } from "./tool.ts";
import { VERSION } from "../version.ts";

/**
 * Builds the MCP server exposing the given resource tools over stdio.
 *
 * @param tools The per-resource tool modules to advertise and dispatch.
 * @param mode `readonly` advertises only the read actions of each tool (ADR-0001).
 */
export function buildServer(tools: ToolModule[], mode: Mode): Server {
  const server = new Server(
    { name: "denomine-mcp", version: VERSION },
    { capabilities: { tools: {} } },
  );
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  const advertised = new Map(
    tools.map((tool) => [tool.name, toObjectSchema(tool.schema(mode))]),
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description(mode),
      inputSchema: advertised.get(tool.name),
    })),
  }));

  server.setRequestHandler(
    CallToolRequestSchema,
    (request: CallToolRequest): Promise<ToolResponse> => {
      const tool = byName.get(request.params.name);
      if (tool == null) {
        return Promise.resolve(
          toolError(`unknown tool: ${request.params.name}`),
        );
      }
      const tagged = fromActionKeyed(
        request.params.arguments ?? {},
        Object.keys(advertised.get(tool.name)?.properties ?? {}),
      );
      if (Result.isFailure(tagged)) {
        return Promise.resolve(toolError(`invalid arguments: ${tagged.error}`));
      }
      const parsed = v.safeParse(tool.schema(mode), tagged.value);
      if (!parsed.success) {
        return Promise.resolve(
          toolError(
            `invalid arguments: ${
              parsed.issues.map((issue) => issue.message).join("; ")
            }`,
          ),
        );
      }
      return tool.handle(parsed.output);
    },
  );

  return server;
}

function toolError(message: string): ToolResponse {
  return { content: [{ type: "text", text: message }], isError: true };
}
