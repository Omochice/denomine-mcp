import type { RedmineError } from "./port.ts";

/**
 * Reduces a failed {@link Response} to a {@link RedmineError}, reading Redmine's
 * `errors` array when present. The body is often absent (e.g. a 404), so a
 * missing or non-JSON body yields the status alone rather than an exception.
 */
export async function toRedmineError(
  response: Response,
): Promise<RedmineError> {
  let errors: string[] = [];
  try {
    const body = await response.clone().json();
    if (body != null && Array.isArray(body.errors)) {
      errors = body.errors.map((e: unknown) => String(e));
    }
  } catch {
    // No JSON body to read; the status alone is disclosed.
  }
  return { status: response.status, errors };
}

/**
 * Extracts a {@link RedmineError} from an error thrown by `@omochice/redmine`.
 *
 * The library raises its failure with the originating {@link Response} as the
 * error's `cause`, and does not consume that response's body on failure, so the
 * Redmine `errors` array is still readable here.
 */
export async function errorFromCause(error: Error): Promise<RedmineError> {
  const cause = (error as { cause?: unknown }).cause;
  if (cause instanceof Response) {
    return await toRedmineError(cause);
  }
  return { status: 0, errors: [error.message] };
}
