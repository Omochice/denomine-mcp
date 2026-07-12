import { Command } from "@cliffy/command";
import { Secret } from "@cliffy/prompt";
import { openKeyring } from "../keyring/mod.ts";
import { runLogin } from "./run.ts";

/**
 * Reads the API key without leaking it onto the argument list: a hidden prompt
 * when attached to a TTY, otherwise the whole of stdin so
 * `echo "$KEY" | denomine-mcp login ...` works in automation (ADR-0004).
 */
function readApiKey(): Promise<string> {
  if (Deno.stdin.isTerminal()) {
    return Secret.prompt("Redmine API key");
  }
  return new Response(Deno.stdin.readable).text();
}

/**
 * `login --endpoint <url>`: store the API key for an endpoint in the OS keyring.
 */
export const loginCommand = new Command()
  .description("Store the API key for an endpoint in the OS keyring.")
  .option("--endpoint <url:string>", "Redmine endpoint URL.", {
    required: true,
  })
  .action(async (options) => {
    const account = await runLogin(options.endpoint, openKeyring(), readApiKey);
    console.error(`Stored API key for ${account}.`);
  });
