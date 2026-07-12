import { Server } from "npm:@modelcontextprotocol/sdk@1.29.0/server/index.js";
import {
  type CallToolRequest,
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "npm:@modelcontextprotocol/sdk@1.29.0/types.js";
import * as v from "@valibot/valibot";
import type { Mode } from "../tools/mode.ts";
import type { ToolResponse } from "../tools/response.ts";
import { toObjectSchema, type ToolModule } from "./tool.ts";

/**
 * Builds the MCP server exposing the given resource tools over stdio.
 *
 * @param tools The per-resource tool modules to advertise and dispatch.
 * @param mode `readonly` advertises only the read actions of each tool (ADR-0001).
 */
export function buildServer(tools: ToolModule[], mode: Mode): Server {
  const server = new Server(
    { name: "denomine-mcp", version: "0.0.0" },
    { capabilities: { tools: {} } },
  );
  const byName = new Map(tools.map((tool) => [tool.name, tool]));

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: toObjectSchema(tool.schema(mode)),
    })),
  }));

  server.setRequestHandler(
    CallToolRequestSchema,
    (request: CallToolRequest): Promise<ToolResponse> => {
      const tool = byName.get(request.params.name);
      if (tool === undefined) {
        return Promise.resolve(
          toolError(`unknown tool: ${request.params.name}`),
        );
      }
      const parsed = v.safeParse(
        tool.schema(mode),
        request.params.arguments ?? {},
      );
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
