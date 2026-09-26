import type { NpmPackage } from "./npm.ts";

type Dependency = {
  code?: { specifier?: string; error?: string };
};

type Module = {
  specifier: string;
  kind?: string;
  error?: string;
  npmPackage?: string;
  dependencies?: Dependency[];
};

/** The subset of `deno info --json` output the generator reads. */
export type DenoInfo = {
  roots: string[];
  modules: Module[];
  redirects: Record<string, string>;
  npmPackages: Record<string, NpmPackage>;
};

/** A JSR package version, identified as in `https://jsr.io/@scope/name/<version>/`. */
export type JsrPackage = { name: string; version: string };

const JSR_MODULE = /^https:\/\/jsr\.io\/(@[^/]+\/[^/]+)\/([^/]+)\//;
const VERSION = /^\d+\.\d+\.\d+([-+].*)?$/;

/**
 * Lists the graph failures that would leave code out of the binary: failed
 * modules that are roots or are imported as code, and imports that did not
 * resolve at all.
 *
 * A failed module reached only through type imports is not reported, because
 * `deno compile` does not embed types; `@valibot/to-json-schema` has such an
 * import that points outside its own package and never resolves.
 */
export function graphErrors(info: DenoInfo): string[] {
  const resolve = (specifier: string) => info.redirects[specifier] ?? specifier;
  const code = new Set(info.roots.map(resolve));
  const errors: string[] = [];
  for (const module of info.modules) {
    for (const dependency of module.dependencies ?? []) {
      if (dependency.code?.specifier != null) {
        code.add(resolve(dependency.code.specifier));
      }
      if (dependency.code?.error != null) {
        errors.push(`${module.specifier}: ${dependency.code.error}`);
      }
    }
  }
  for (const module of info.modules) {
    if (module.error != null && code.has(module.specifier)) {
      errors.push(`${module.specifier}: ${module.error}`);
    }
  }
  return errors;
}

/**
 * The JSR package versions whose modules are in the graph.
 *
 * @throws {Error} When a loaded `jsr.io` module has no version segment, which
 *   would otherwise be listed as a package named after a directory.
 */
export function jsrPackages(info: DenoInfo): JsrPackage[] {
  const found = new Map<string, JsrPackage>();
  for (const module of info.modules) {
    if (module.error != null) {
      continue;
    }
    const match = JSR_MODULE.exec(module.specifier);
    if (match == null) {
      continue;
    }
    const [, name, version] = match;
    if (!VERSION.test(version)) {
      throw new Error(`no version in JSR module ${module.specifier}`);
    }
    found.set(`${name}@${version}`, { name, version });
  }
  return [...found.values()];
}

/** The `npmPackages` keys imported directly by the graph. */
export function npmRoots(info: DenoInfo): string[] {
  const roots = new Set<string>();
  for (const module of info.modules) {
    if (module.kind === "npm" && module.npmPackage != null) {
      roots.add(module.npmPackage);
    }
  }
  return [...roots];
}
