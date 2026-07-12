import { Command } from "@cliffy/command";
import { notImplemented } from "./not-implemented.ts";

/**
 * `list`: show the endpoints that currently have a stored API key in the OS
 * keyring.
 */
export const listCommand = new Command()
  .description("List endpoints that have a stored API key.")
  .action(() => notImplemented("list"));
