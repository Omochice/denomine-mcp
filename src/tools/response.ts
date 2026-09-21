import { Result } from "@praha/byethrow";

/** An MCP `tools/call` response: text content, flagged on failure. */
export type ToolResponse = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

/**
 * The only failure payload a tool hands back to the model (ADR-0002): a status
 * and the messages explaining it. A failure that has no HTTP status of its own
 * reports status 0, the convention the Redmine error mapping already uses.
 */
export type ToolFailure = {
  status: number;
  errors: string[];
};

/**
 * Maps a call result to an MCP response: a success returns the payload as JSON
 * text; a failure returns the {@link ToolFailure} payload with `isError` set
 * (ADR-0002).
 */
export function toToolResponse(
  result: Result.Result<unknown, ToolFailure>,
): ToolResponse {
  if (Result.isFailure(result)) {
    return {
      content: [{ type: "text", text: JSON.stringify(result.error) }],
      isError: true,
    };
  }
  const payload = result.value ?? { ok: true };
  return { content: [{ type: "text", text: JSON.stringify(payload) }] };
}
