import { Command } from "@cliffy/command";
import { openKeyring } from "../keyring/mod.ts";
import { runLogout } from "./run.ts";

/**
 * `logout --endpoint <url>`: delete the stored API key for an endpoint from the
 * OS keyring.
 */
export const logoutCommand = new Command()
  .description("Delete the stored API key for an endpoint from the OS keyring.")
  .option("--endpoint <url:string>", "Redmine endpoint URL.", {
    required: true,
  })
  .action(async (options) => {
    const account = await runLogout(options.endpoint, openKeyring());
    console.error(`Removed API key for ${account}.`);
  });
