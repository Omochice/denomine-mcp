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
 * The version literal is rewritten by release-please on each release PR, which
 * is why it carries the marker comment and must stay a plain literal on one
 * line; the updater matches a semver-looking string on the annotated line and
 * would not find one built from constants.
 *
 * @returns The configured root command, ready to `parse(Deno.args)`.
 */
export function cli() {
  return new Command()
    .name("denomine-mcp")
    .version("0.0.0") // x-release-please-version
    .description("MCP server for Redmine.")
    .action(function () {
      this.showHelp();
    })
    .command("serve", serveCommand)
    .command("login", loginCommand)
    .command("logout", logoutCommand)
    .command("list", listCommand);
}
