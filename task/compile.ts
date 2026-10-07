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

const buildInfo = "build-info.json";

async function git(...args: string[]): Promise<string | undefined> {
  const { success, stdout } = await new Deno.Command("git", {
    args,
    stdout: "piped",
    stderr: "null",
  }).output().catch(() => ({ success: false, stdout: new Uint8Array() }));
  return success ? new TextDecoder().decode(stdout).trim() : undefined;
}

// Outside a git checkout, such as a source archive, the binary is still built
// and reports no commit, as a run from source does.
async function writeBuildInfo(): Promise<boolean> {
  const commit = await git("rev-parse", "HEAD");
  const status = await git("status", "--porcelain");
  if (commit == null || status == null) {
    return false;
  }
  await Deno.writeTextFile(
    buildInfo,
    JSON.stringify({ commit, dirty: status !== "" }),
  );
  return true;
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

const hasBuildInfo = await writeBuildInfo();

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
    ...(hasBuildInfo ? ["--include", buildInfo] : []),
    ...output,
    ...Deno.args,
    "main.ts",
  ],
  stdout: "inherit",
  stderr: "inherit",
}).output();

// Left in place, the file would be read by a later run from source and report
// the commit of this build instead of the code actually running.
if (hasBuildInfo) {
  await Deno.remove(buildInfo);
}

Deno.exit(code);
