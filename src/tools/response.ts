import { Result } from "@praha/byethrow";
import type { RedmineResult } from "../redmine/port.ts";

/** An MCP `tools/call` response: text content, flagged on failure. */
export type ToolResponse = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

/**
 * Maps a Redmine call result to an MCP response: a success returns the payload
 * as JSON text; a failure returns the status and Redmine's validation messages
 * with `isError` set (ADR-0002).
 */
export function toToolResponse(result: RedmineResult<unknown>): ToolResponse {
  if (Result.isFailure(result)) {
    return {
      content: [{ type: "text", text: JSON.stringify(result.error) }],
      isError: true,
    };
  }
  const payload = result.value ?? { ok: true };
  return { content: [{ type: "text", text: JSON.stringify(payload) }] };
}
