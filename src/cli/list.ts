import { Command } from "@cliffy/command";
import { openKeyring } from "../keyring/mod.ts";
import { runList } from "./run.ts";

/**
 * `list`: show the endpoints that currently have a stored API key in the OS
 * keyring. The endpoints go to stdout; the empty-state notice goes to stderr so
 * the two are separable when the output is consumed by another program.
 */
export const listCommand = new Command()
  .description("List endpoints that have a stored API key.")
  .action(async () => {
    const endpoints = await runList(openKeyring());
    if (endpoints.length === 0) {
      console.error("No stored credentials.");
      return;
    }
    for (const endpoint of endpoints) {
      console.log(endpoint);
    }
  });
