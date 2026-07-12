import * as v from "@valibot/valibot";
import { toJsonSchema } from "@valibot/to-json-schema";
import type { Mode } from "../tools/mode.ts";
import type { ToolResponse } from "../tools/response.ts";

/**
 * One MCP tool a resource contributes to the server (ADR-0001: one tool per
 * resource). The schema is mode-dependent so `readonly` can drop write actions;
 * `handle` receives arguments already validated against `schema(mode)`.
 */
export type ToolModule = {
  name: string;
  description: string;
  schema(mode: Mode): v.GenericSchema;
  handle(input: unknown): Promise<ToolResponse>;
};

/**
 * Wraps a resource's discriminated-union schema, which `toJsonSchema` emits as a
 * top-level `oneOf`, into the `type: "object"` schema MCP's `inputSchema`
 * requires. The advertised `action` enum is read back from the branches so it
 * cannot drift from the schema.
 */
export function toObjectSchema(
  schema: v.GenericSchema,
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
