import * as v from "@valibot/valibot";
import { toJsonSchema } from "@valibot/to-json-schema";
import { Result } from "@praha/byethrow";
import type { Mode } from "../tools/mode.ts";
import type { ToolResponse } from "../tools/response.ts";

/**
 * One MCP tool a resource contributes to the server (ADR-0001: one tool per
 * resource). The schema is mode-dependent so `readonly` can drop write actions;
 * `handle` receives arguments already validated against `schema(mode)`.
 */
export type ToolModule = {
  name: string;
  description(mode: Mode): string;
  schema(mode: Mode): v.GenericSchema;
  handle(input: unknown): Promise<ToolResponse>;
};

type JsonObjectSchema = {
  properties?: Record<string, unknown>;
  required?: string[];
  [keyword: string]: unknown;
};

type ActionBranch = JsonObjectSchema & {
  properties?: { action?: { const?: unknown } };
};

/**
 * The MCP `inputSchema` of a tool: one property per action, holding that
 * action's own arguments, of which a call sets exactly one.
 */
export type ActionKeyedSchema = {
  type: "object";
  properties: Record<string, unknown>;
  minProperties: 1;
  maxProperties: 1;
  additionalProperties: false;
};

/**
 * Re-keys a resource's discriminated-union schema by its `action` literal. The
 * Anthropic Messages API rejects an `inputSchema` with `oneOf`, `anyOf`, or
 * `allOf` at the top level, which is how `toJsonSchema` emits a variant;
 * keying by action keeps each action's required fields expressible without
 * that. An action spread over several branches is advertised as their
 * `anyOf`, which the API accepts below the top level.
 */
export function toObjectSchema(schema: v.GenericSchema): ActionKeyedSchema {
  const json = toJsonSchema(schema) as { oneOf?: ActionBranch[] };
  const byAction = new Map<string, JsonObjectSchema[]>();
  for (const branch of json.oneOf ?? []) {
    const action = branch.properties?.action?.const;
    if (typeof action !== "string") {
      continue;
    }
    byAction.set(action, [
      ...byAction.get(action) ?? [],
      withoutAction(branch),
    ]);
  }
  return {
    type: "object",
    properties: Object.fromEntries(
      [...byAction].map(([action, branches]) => [action, merge(branches)]),
    ),
    minProperties: 1,
    maxProperties: 1,
    additionalProperties: false,
  };
}

function withoutAction(branch: ActionBranch): JsonObjectSchema {
  const { properties, required, ...rest } = branch;
  const { action: _action, ...fields } = properties ?? {};
  const remaining = (required ?? []).filter((name) => name !== "action");
  if (remaining.length === 0) {
    return { ...rest, properties: fields };
  }
  return { ...rest, properties: fields, required: remaining };
}

function merge(branches: JsonObjectSchema[]): JsonObjectSchema {
  if (branches.length === 1) {
    return branches[0];
  }
  return { anyOf: branches };
}

/**
 * Turns call arguments in the advertised `{ <action>: { ...fields } }` shape
 * back into the `{ action, ...fields }` input the tool's schema validates.
 *
 * @param actions The advertised action names, quoted when the shape is wrong.
 * @returns The tagged input, or a message saying why the shape is wrong.
 */
export function fromActionKeyed(
  input: unknown,
  actions: readonly string[],
): Result.Result<Record<string, unknown> & { action: string }, string> {
  const keys = isPlainObject(input) ? Object.keys(input) : [];
  if (!isPlainObject(input) || keys.length !== 1) {
    return Result.fail(
      `expected an object with exactly one key naming the action, one of: ${
        actions.join(", ")
      }`,
    );
  }
  const action = keys[0];
  if (!actions.includes(action)) {
    return Result.fail(
      `unknown action \`${action}\`, one of: ${actions.join(", ")}`,
    );
  }
  const fields = input[action];
  if (!isPlainObject(fields)) {
    return Result.fail(
      `the arguments of \`${action}\` must be an object of its fields`,
    );
  }
  return Result.succeed({ ...fields, action });
}

/**
 * Describes a validation issue of a tagged input, naming the offending field
 * by its path in the advertised `{ <action>: { ...fields } }` shape.
 *
 * A union whose object forms failed on their fields is described by those
 * fields rather than by the list of forms.
 *
 * @returns One message per failed field, prefixed with its path when it has one.
 */
export function describeIssue(
  action: string,
  issue: v.BaseIssue<unknown>,
): string[] {
  const path = v.getDotPath(issue);
  if (path == null) {
    return [issue.message];
  }
  const nested = (issue.issues ?? []).flatMap((sub) => {
    const subPath = v.getDotPath(sub);
    return subPath == null ? [] : [`${subPath}: ${sub.message}`];
  });
  if (nested.length === 0) {
    return [`${action}.${path}: ${issue.message}`];
  }
  return [...new Set(nested)].map((message) => `${action}.${path}.${message}`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}
