import { Server } from "npm:@modelcontextprotocol/sdk@1.29.0/server/index.js";
import {
  type CallToolRequest,
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "npm:@modelcontextprotocol/sdk@1.29.0/types.js";
import * as v from "@valibot/valibot";
import { toJsonSchema } from "@valibot/to-json-schema";
import type { IssuePort } from "../redmine/port.ts";
import { handleIssue, type ToolResponse } from "../tools/issues/handler.ts";
import { issueInputSchema, type Mode } from "../tools/issues/schema.ts";

const ISSUES_TOOL = "redmine_issues";

/**
 * Builds the MCP server exposing the Redmine issue tool over the given port.
 *
 * @param port The issue backend (real or fake).
 * @param mode `readonly` advertises only the read actions (ADR-0001).
 */
export function buildServer(port: IssuePort, mode: Mode): Server {
  const server = new Server(
    { name: "denomine-mcp", version: "0.0.0" },
    { capabilities: { tools: {} } },
  );
  const schema = issueInputSchema(mode);

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: [{
      name: ISSUES_TOOL,
      description:
        "Create, read, update, and delete Redmine issues. Choose the operation with `action`.",
      inputSchema: toObjectSchema(schema),
    }],
  }));

  server.setRequestHandler(
    CallToolRequestSchema,
    (request: CallToolRequest): Promise<ToolResponse> => {
      if (request.params.name !== ISSUES_TOOL) {
        return Promise.resolve(
          toolError(`unknown tool: ${request.params.name}`),
        );
      }
      const parsed = v.safeParse(schema, request.params.arguments ?? {});
      if (!parsed.success) {
        return Promise.resolve(
          toolError(
            `invalid arguments: ${
              parsed.issues.map((issue) => issue.message).join("; ")
            }`,
          ),
        );
      }
      return handleIssue(port, parsed.output);
    },
  );

  return server;
}

/**
 * Wraps the discriminated-union JSON Schema, which `toJsonSchema` emits as a
 * top-level `oneOf`, into the `type: "object"` schema MCP's `inputSchema`
 * requires. The advertised `action` enum is read back from the branches so it
 * cannot drift from the schema.
 */
function toObjectSchema(
  schema: Parameters<typeof toJsonSchema>[0],
): { type: "object"; properties: Record<string, unknown>; oneOf: unknown[] } {
  const json = toJsonSchema(schema) as {
    oneOf?: Array<{ properties?: { action?: { const?: unknown } } }>;
  };
  const branches = json.oneOf ?? [];
  const actions = branches
    .map((branch) => branch.properties?.action?.const)
    .filter((action): action is string => typeof action === "string");
  return {
    type: "object",
    properties: { action: { type: "string", enum: actions } },
    oneOf: branches,
  };
}

function toolError(message: string): ToolResponse {
  return { content: [{ type: "text", text: message }], isError: true };
}
