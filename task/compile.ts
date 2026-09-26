import { dylibName } from "../src/keyring/ffi.ts";

function tripleToOs(triple: string): typeof Deno.build.os {
  if (triple.includes("windows")) {
    return "windows";
  }
  if (triple.includes("apple")) {
    return "darwin";
  }
  return "linux";
}

function optionValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

const target = optionValue(Deno.args, "--target");
const os = target == null ? Deno.build.os : tripleToOs(target);
const output = optionValue(Deno.args, "--output") == null
  ? ["--output", "denomine-mcp"]
  : [];

const licenses = await new Deno.Command("deno", {
  args: [
    "task",
    "license",
    ...(target == null ? [] : ["--target", target]),
  ],
  stdout: "inherit",
  stderr: "inherit",
}).output();
if (!licenses.success) {
  Deno.exit(licenses.code);
}

const { code } = await new Deno.Command("deno", {
  args: [
    "compile",
    "--bundle",
    "--allow-ffi",
    "--allow-read",
    "--allow-write",
    "--allow-net",
    "--allow-env",
    "--include",
    `ffi/target/release/${dylibName(os)}`,
    "--include",
    "third-party-licenses.json",
    ...output,
    ...Deno.args,
    "main.ts",
  ],
  stdout: "inherit",
  stderr: "inherit",
}).output();

Deno.exit(code);
