import { Command } from "@cliffy/command";
import { serveCommand } from "./serve.ts";
import { loginCommand } from "./login.ts";
import { logoutCommand } from "./logout.ts";
import { listCommand } from "./list.ts";

/**
 * Assembles the root `denomine-mcp` command and its subcommands.
 *
 * The return type is left to inference because cliffy encodes each subcommand's
 * generics into the chained result, which a bare `Command` annotation rejects.
 *
 * @returns The configured root command, ready to `parse(Deno.args)`.
 */
export function cli() {
  return new Command()
    .name("denomine-mcp")
    .version("0.0.0")
    .description("MCP server for Redmine.")
    .action(function () {
      this.showHelp();
    })
    .command("serve", serveCommand)
    .command("login", loginCommand)
    .command("logout", logoutCommand)
    .command("list", listCommand);
}
