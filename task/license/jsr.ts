import { isLicenseFile } from "./files.ts";

/**
 * The top-level license and notice files among the paths of a JSR package
 * version's `_meta.json` manifest.
 */
export function jsrLicensePaths(paths: Iterable<string>): string[] {
  return [...paths].filter((path) => {
    const match = /^\/([^/]+)$/.exec(path);
    return match != null && isLicenseFile(match[1]);
  }).sort();
}
