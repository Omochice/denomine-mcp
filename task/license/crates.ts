import { isAlwaysKept } from "./files.ts";

/** An entry of `packages` in `cargo metadata` output. */
export type CargoPackage = {
  id: string;
  name: string;
  version: string;
  license: string | null;
  license_file: string | null;
  manifest_path: string;
};

/** The subset of `cargo metadata --format-version 1` output the generator reads. */
export type CargoMetadata = {
  packages: CargoPackage[];
  resolve: { nodes: { id: string }[] };
};

const OWN_CRATE = "keyring_ffi";
const MIT_FILE = /^licen[cs]e[-_.]mit([-._].*)?$/i;

/**
 * The crates resolved for the platform `metadata` was filtered to, without the
 * project's own crate.
 */
export function shippedCrates(metadata: CargoMetadata): CargoPackage[] {
  const resolved = new Set(metadata.resolve.nodes.map((node) => node.id));
  return metadata.packages.filter((crate) =>
    resolved.has(crate.id) && crate.name !== OWN_CRATE
  );
}

/**
 * Splits an SPDX expression into its top-level `OR` alternatives; an
 * expression without one comes back whole. The legacy `/` separator some
 * crates still declare counts as `OR`.
 */
export function orAlternatives(expression: string): string[] {
  let body = expression.trim();
  while (body.startsWith("(") && closingParen(body, 0) === body.length - 1) {
    body = body.slice(1, -1).trim();
  }
  const alternatives: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < body.length; index++) {
    const char = body[index];
    if (char === "(") {
      depth = depth + 1;
    } else if (char === ")") {
      depth = depth - 1;
    } else if (depth === 0) {
      const separator = orSeparatorLength(body, index);
      if (separator > 0) {
        alternatives.push(body.slice(start, index).trim());
        start = index + separator;
        index = start - 1;
      }
    }
  }
  alternatives.push(body.slice(start).trim());
  return alternatives;
}

function orSeparatorLength(body: string, index: number): number {
  if (body.startsWith(" OR ", index)) {
    return 4;
  }
  if (body[index] === "/") {
    return 1;
  }
  return 0;
}

function closingParen(text: string, open: number): number {
  let depth = 0;
  for (let index = open; index < text.length; index++) {
    if (text[index] === "(") {
      depth = depth + 1;
    } else if (text[index] === ")") {
      depth = depth - 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
}

/**
 * The license files of a crate to embed: only the MIT text when MIT is one of
 * the top-level alternatives (see ADR-0013), otherwise every file, and notice
 * files in either case.
 */
export function selectCrateLicenseFiles(
  expression: string | null,
  files: readonly string[],
): string[] {
  const mit = files.filter((file) => MIT_FILE.test(file));
  if (
    expression != null && orAlternatives(expression).includes("MIT") &&
    mit.length > 0
  ) {
    return [...new Set([...mit, ...files.filter(isAlwaysKept)])].sort();
  }
  return [...files].sort();
}
