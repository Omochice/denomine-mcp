import { RedmineResponseError } from "@omochice/redmine/error";
import type { RedmineError } from "./port.ts";

/**
 * Reduces an error thrown by `@omochice/redmine` to a {@link RedmineError}.
 *
 * The library throws {@link RedmineResponseError} on a non-ok response, having
 * already drained the body to a string. Redmine reports validation failures as
 * a JSON `errors` array in that body, which is read here; a missing or non-JSON
 * body (e.g. a 404) discloses the status alone. Any other error (e.g. a network
 * failure) carries no status, so it maps to status 0 with its message.
 */
export function toRedmineError(error: unknown): RedmineError {
  if (error instanceof RedmineResponseError) {
    return { status: error.status, errors: extractErrors(error.body) };
  }
  const message = error instanceof Error ? error.message : String(error);
  return { status: 0, errors: [message] };
}

/** Reads Redmine's `errors` array from a response body, or `[]` if absent. */
function extractErrors(body: string): string[] {
  try {
    const parsed = JSON.parse(body);
    if (parsed != null && Array.isArray(parsed.errors)) {
      return parsed.errors.map((e: unknown) => String(e));
    }
  } catch {
    // No JSON body to read; the status alone is disclosed.
  }
  return [];
}
