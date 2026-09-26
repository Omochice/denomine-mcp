/** A platform in the vocabulary of the `os` and `cpu` fields of `package.json`. */
export type NpmPlatform = { os: string; cpu: string };

const CPU: Record<string, string> = { x86_64: "x64", aarch64: "arm64" };

function npmOs(triple: string): string | undefined {
  if (triple.includes("-apple-darwin")) {
    return "darwin";
  }
  if (triple.includes("-windows")) {
    return "win32";
  }
  if (triple.includes("-linux")) {
    return "linux";
  }
  return undefined;
}

/**
 * `triple` is a Rust target triple, the form `deno compile --target` takes.
 *
 * @throws {Error} When the triple names an OS or CPU that is not mapped.
 */
export function npmPlatform(triple: string): NpmPlatform {
  const cpu = CPU[triple.split("-")[0]];
  const os = npmOs(triple);
  if (cpu == null || os == null) {
    throw new Error(`unsupported target triple: ${triple}`);
  }
  return { os, cpu };
}
