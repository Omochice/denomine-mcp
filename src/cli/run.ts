import { StdioServerTransport } from "npm:@modelcontextprotocol/sdk@1.29.0/server/stdio.js";
import { RedmineClient } from "../redmine/client.ts";
import { WikiClient } from "../redmine/wiki_client.ts";
import { VersionClient } from "../redmine/version_client.ts";
import type { RedmineContext } from "../redmine/port.ts";
import { buildServer } from "../mcp/server.ts";
import { issuesTool } from "../tools/issues/mod.ts";
import { wikiTool } from "../tools/wiki/mod.ts";
import { versionTool } from "../tools/version/mod.ts";
import type { Mode } from "../tools/mode.ts";
import type { Keyring } from "../keyring/port.ts";
import { canonicalizeEndpoint } from "./endpoint.ts";

/**
 * Stores the API key for an endpoint. Kept separate from the cliffy command so
 * it can be exercised with a fake keyring; the command supplies the real one and
 * the secret reader.
 *
 * @returns The canonical account the key was stored under.
 */
export async function runLogin(
  endpoint: string,
  keyring: Keyring,
  readSecret: () => Promise<string>,
): Promise<string> {
  const account = canonicalizeEndpoint(endpoint);
  const secret = (await readSecret()).trim();
  if (secret === "") {
    throw new Error("no API key was provided");
  }
  await keyring.set(account, secret);
  return account;
}

/** Removes the stored API key for an endpoint. */
export async function runLogout(
  endpoint: string,
  keyring: Keyring,
): Promise<string> {
  const account = canonicalizeEndpoint(endpoint);
  await keyring.delete(account);
  return account;
}

/** Returns the endpoints that have a stored API key, sorted for stable output. */
export async function runList(keyring: Keyring): Promise<string[]> {
  const endpoints = await keyring.list();
  return endpoints.sort();
}

/**
 * Resolves the connection context for an endpoint from the keyring, failing with
 * a directive to run `login` when no key is stored.
 */
export async function resolveContext(
  endpoint: string,
  keyring: Keyring,
): Promise<RedmineContext> {
  const account = canonicalizeEndpoint(endpoint);
  const apiKey = await keyring.get(account);
  if (apiKey === undefined) {
    throw new Error(
      `no stored API key for ${account}; run \`login --endpoint ${account}\` first`,
    );
  }
  return { endpoint: account, apiKey };
}

/** Runs the stdio MCP server for an endpoint, keyed by the stored API key. */
export async function runServe(
  options: { endpoint: string; readonly?: boolean },
  keyring: Keyring,
): Promise<void> {
  const context = await resolveContext(options.endpoint, keyring);
  const mode: Mode = options.readonly ? "readonly" : "full";
  const server = buildServer(
    [
      issuesTool(new RedmineClient(context)),
      wikiTool(new WikiClient(context)),
      versionTool(new VersionClient(context)),
    ],
    mode,
  );
  await server.connect(new StdioServerTransport());
}
