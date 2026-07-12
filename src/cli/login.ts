import { Command } from "@cliffy/command";
import { notImplemented } from "./not-implemented.ts";

/**
 * `login --endpoint <url>`: store the API key for an endpoint in the OS keyring.
 * The key is read from a hidden prompt, falling back to stdin when not a TTY, so
 * it never appears on the argument list.
 */
export const loginCommand = new Command()
  .description("Store the API key for an endpoint in the OS keyring.")
  .option("--endpoint <url:string>", "Redmine endpoint URL.", {
    required: true,
  })
  .action(() => notImplemented("login"));
