// The `compile:bin` task cannot name the keyring cdylib inline: Cargo emits a
// different file per platform and the task shell has no way to branch on the
// host, so a fixed `--include` path could only ever be right on one OS. This
// script reuses the loader's own file-name rule so the two cannot drift, and
// CI builds through it as well so a broken task is caught before release.
//
// Every argument is forwarded to `deno compile`. `--target` is also read here
// because the cdylib must match the target, not the host, and `--output`
// defaults to `denomine-mcp` when the caller does not name one.
import { dylibName } from "../src/keyring/ffi.ts";

/**
 * Map a Rust target triple onto the `Deno.build.os` vocabulary.
 *
 * Only the vendor and OS segments matter for the cdylib name, and only the
 * three platforms CI builds for are distinguished; anything else is treated
 * as Unix, which is also what the loader assumes.
 */
function osOfTriple(triple: string): typeof Deno.build.os {
  if (triple.includes("windows")) return "windows";
  if (triple.includes("apple")) return "darwin";
  return "linux";
}

function optionValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

const target = optionValue(Deno.args, "--target");
const os = target === undefined ? Deno.build.os : osOfTriple(target);
const output = optionValue(Deno.args, "--output") === undefined
  ? ["--output", "denomine-mcp"]
  : [];

const { code } = await new Deno.Command("deno", {
  args: [
    "compile",
    "--allow-ffi",
    "--allow-read",
    "--allow-write",
    "--allow-net",
    "--allow-env",
    "--include",
    `ffi/target/release/${dylibName(os)}`,
    ...output,
    ...Deno.args,
    "main.ts",
  ],
  stdout: "inherit",
  stderr: "inherit",
}).output();

Deno.exit(code);
