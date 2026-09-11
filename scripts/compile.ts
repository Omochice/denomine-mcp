// The `compile` task cannot name the keyring cdylib inline: Cargo emits a
// different file per platform and the task shell has no way to branch on the
// host, so a fixed `--include` path could only ever be right on one OS. CI
// avoids the problem with a per-target matrix; this script is the local
// equivalent, reusing the loader's own file-name rule so both stay in step.
import { dylibName } from "../src/keyring/ffi.ts";

const { code } = await new Deno.Command("deno", {
  args: [
    "compile",
    "--allow-ffi",
    "--allow-read",
    "--allow-write",
    "--allow-net",
    "--allow-env",
    "--include",
    `ffi/target/release/${dylibName()}`,
    "--output",
    "denomine-mcp",
    "main.ts",
  ],
  stdout: "inherit",
  stderr: "inherit",
}).output();

Deno.exit(code);
