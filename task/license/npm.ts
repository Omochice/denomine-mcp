import type { NpmPlatform } from "./target.ts";

/** An entry of `npmPackages` in `deno info --json` output. */
export type NpmPackage = {
  name: string;
  version: string;
  dependencies: string[];
  localPath: string;
};

/** The platform constraints `deno.lock` records for an npm package. */
export type LockEntry = { os?: string[]; cpu?: string[] };

function allows(constraint: string[] | undefined, value: string): boolean {
  if (constraint == null || constraint.length === 0) {
    return true;
  }
  if (constraint.includes(`!${value}`)) {
    return false;
  }
  const allowed = constraint.filter((entry) => !entry.startsWith("!"));
  return allowed.length === 0 || allowed.includes(value);
}

/** Whether npm would install a package with these constraints on `platform`. */
export function installsOn(
  entry: LockEntry | undefined,
  platform: NpmPlatform,
): boolean {
  return allows(entry?.os, platform.os) && allows(entry?.cpu, platform.cpu);
}

/**
 * Every package reachable from the root keys, once per name and version.
 *
 * Packages the lock restricts to another platform are skipped along with what
 * they depend on, because `deno compile` embeds only the platform package that
 * matches its target, such as one `@typescript/typescript-<os>-<cpu>`.
 *
 * @throws {Error} When a key is missing from `packages`.
 */
export function shippedNpmPackages(
  roots: readonly string[],
  packages: Record<string, NpmPackage>,
  lock: Record<string, LockEntry>,
  platform: NpmPlatform,
): NpmPackage[] {
  const visited = new Set<string>();
  const shipped = new Map<string, NpmPackage>();
  const pending = [...roots];
  for (let key = pending.pop(); key != null; key = pending.pop()) {
    if (visited.has(key)) {
      continue;
    }
    visited.add(key);
    if (!installsOn(lock[key], platform)) {
      continue;
    }
    const found = packages[key];
    if (found == null) {
      throw new Error(`npm package ${key} is not in the module graph`);
    }
    shipped.set(`${found.name}@${found.version}`, found);
    pending.push(...found.dependencies);
  }
  return [...shipped.values()];
}
