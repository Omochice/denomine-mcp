import type { Notice } from "../src/license/notice.ts";
import { isLicenseFile } from "./license/files.ts";
import {
  type DenoInfo,
  graphErrors,
  jsrPackages,
  npmRoots,
} from "./license/graph.ts";
import { jsrLicensePaths } from "./license/jsr.ts";
import {
  type LockEntry,
  type NpmPackage,
  shippedNpmPackages,
} from "./license/npm.ts";
import {
  type CargoMetadata,
  type CargoPackage,
  selectCrateLicenseFiles,
  shippedCrates,
} from "./license/crates.ts";
import { npmPlatform } from "./license/target.ts";

const root = new URL("../", import.meta.url);
const output = new URL("third-party-licenses.json", root);

async function run(command: string, args: string[]): Promise<string> {
  const { code, stdout, stderr } = await new Deno.Command(command, {
    args,
    cwd: root,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (code !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed:\n${
        new TextDecoder().decode(stderr)
      }`,
    );
  }
  return new TextDecoder().decode(stdout);
}

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }
    throw error;
  }
}

async function readLicenseFiles(
  directory: string,
  names: readonly string[],
): Promise<Notice["texts"]> {
  return await Promise.all(names.map(async (file) => ({
    file,
    content: await Deno.readTextFile(`${directory}/${file}`),
  })));
}

async function listLicenseFiles(directory: string): Promise<string[]> {
  const names: string[] = [];
  for await (const entry of Deno.readDir(directory)) {
    if (entry.isFile && isLicenseFile(entry.name)) {
      names.push(entry.name);
    }
  }
  return names.sort();
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} answered ${response.status}`);
  }
  return await response.text();
}

async function jsrNotice(
  pkg: { name: string; version: string },
): Promise<Notice> {
  const base = `https://jsr.io/${pkg.name}/${pkg.version}`;
  const meta = JSON.parse(await fetchText(`${base}_meta.json`)) as {
    manifest: Record<string, unknown>;
  };
  const texts = await Promise.all(
    jsrLicensePaths(Object.keys(meta.manifest)).map(async (path) => ({
      file: path.slice(1),
      content: await fetchText(`${base}${path}`),
    })),
  );
  return { ...pkg, source: "jsr", texts };
}

async function npmNotice(pkg: NpmPackage): Promise<Notice> {
  // `deno info` reports where a package would be cached even when it is not,
  // which is the case for the platform package of a cross-compiled target.
  if (!await exists(pkg.localPath)) {
    await run("deno", [
      "cache",
      "--no-lock",
      "--no-config",
      `npm:${pkg.name}@${pkg.version}`,
    ]);
  }
  return {
    name: pkg.name,
    version: pkg.version,
    source: "npm",
    texts: await readLicenseFiles(
      pkg.localPath,
      await listLicenseFiles(pkg.localPath),
    ),
  };
}

async function crateNotice(crate: CargoPackage): Promise<Notice> {
  const directory = crate.manifest_path.replace(/[\\/]Cargo\.toml$/, "");
  const candidates = await listLicenseFiles(directory);
  if (crate.license_file != null) {
    candidates.push(crate.license_file);
  }
  return {
    name: crate.name,
    version: crate.version,
    source: "crates.io",
    texts: await readLicenseFiles(
      directory,
      selectCrateLicenseFiles(crate.license, [...new Set(candidates)]),
    ),
  };
}

function compareCodePoints(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function compareNotices(a: Notice, b: Notice): number {
  const key = (notice: Notice) =>
    [notice.source, notice.name, notice.version].join("\0");
  return compareCodePoints(key(a), key(b));
}

function optionValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

const target = optionValue(Deno.args, "--target") ?? Deno.build.target;

const info = JSON.parse(
  await run("deno", ["info", "--json", "main.ts"]),
) as DenoInfo;
const errors = graphErrors(info);
if (errors.length > 0) {
  throw new Error(`the module graph is incomplete:\n${errors.join("\n")}`);
}
const lock = JSON.parse(
  await Deno.readTextFile(new URL("deno.lock", root)),
) as { npm?: Record<string, LockEntry> };
const metadata = JSON.parse(
  await run("cargo", [
    "metadata",
    "--format-version",
    "1",
    "--manifest-path",
    "ffi/Cargo.toml",
    "--filter-platform",
    target,
  ]),
) as CargoMetadata;

const notices = (await Promise.all([
  ...jsrPackages(info).map(jsrNotice),
  ...shippedNpmPackages(
    npmRoots(info),
    info.npmPackages,
    lock.npm ?? {},
    npmPlatform(target),
  ).map(npmNotice),
  ...shippedCrates(metadata).map(crateNotice),
])).sort(compareNotices);

const missing = notices.filter((notice) => notice.texts.length === 0);
if (missing.length > 0) {
  throw new Error(
    `no license text found for:\n${
      missing.map((notice) =>
        `  ${notice.source} ${notice.name} ${notice.version}`
      ).join("\n")
    }`,
  );
}

await Deno.writeTextFile(output, `${JSON.stringify(notices, null, 2)}\n`);
console.error(
  `wrote ${notices.length} notices for ${target} to ${output.pathname}`,
);
