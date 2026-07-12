import { Command } from "@cliffy/command";
import { notImplemented } from "./not-implemented.ts";

/**
 * `serve --endpoint <url> [--readonly]`: run the stdio MCP server for a Redmine
 * endpoint. The API key is read from the OS keyring, never passed as an argument.
 */
export const serveCommand = new Command()
  .description("Run the stdio MCP server for a Redmine endpoint.")
  .option("--endpoint <url:string>", "Redmine endpoint URL.", {
    required: true,
  })
  .option(
    "--readonly",
    "Expose only read actions; create, update, and delete are pruned.",
  )
  .action(() => notImplemented("serve"));
