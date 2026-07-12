/**
 * Canonicalizes an endpoint URL so one logical Redmine instance maps to exactly
 * one keyring account (ADR-0004).
 *
 * `URL` already lowercases the scheme and host; this additionally drops any
 * query, fragment, and a trailing slash, so `https://R.example.com/` and
 * `https://r.example.com` resolve to the same account. Throws on an unparseable
 * URL.
 *
 * @param raw The endpoint URL as supplied on the command line.
 * @returns The canonical form used as the keyring account and API base.
 */
export function canonicalizeEndpoint(raw: string): string {
  const url = new URL(raw);
  url.hash = "";
  url.search = "";
  const normalized = url.toString();
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}
