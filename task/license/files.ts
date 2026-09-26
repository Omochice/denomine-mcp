const LICENSE_FILE = /^(licen[cs]e|copying|unlicense|notice)([-._].*)?$/i;
const ALWAYS_KEPT = /^notice([-._].*)?$|third[-_]party/i;

/** Whether a top-level file name looks like a license, copying, or notice file. */
export function isLicenseFile(name: string): boolean {
  return LICENSE_FILE.test(name);
}

/**
 * Whether a license file must be reproduced whichever license is chosen:
 * Apache-2.0 requires `NOTICE` contents, and a `LICENSE-THIRD-PARTY` file
 * covers vendored code that the package's own license does not.
 */
export function isAlwaysKept(name: string): boolean {
  return ALWAYS_KEPT.test(name);
}
