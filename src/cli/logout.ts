import { Command } from "@cliffy/command";
import { notImplemented } from "./not-implemented.ts";

/**
 * `logout --endpoint <url>`: delete the stored API key for an endpoint from the
 * OS keyring.
 */
export const logoutCommand = new Command()
  .description("Delete the stored API key for an endpoint from the OS keyring.")
  .option("--endpoint <url:string>", "Redmine endpoint URL.", {
    required: true,
  })
  .action(() => notImplemented("logout"));
