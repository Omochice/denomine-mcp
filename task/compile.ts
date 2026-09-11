import { dylibName } from "../src/keyring/ffi.ts";

function tripleToOs(triple: string): typeof Deno.build.os {
  if (triple.includes("windows")) return "windows";
  if (triple.includes("apple")) return "darwin";
  return "linux";
}

function optionValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

const target = optionValue(Deno.args, "--target");
const os = target === undefined ? Deno.build.os : tripleToOs(target);
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
