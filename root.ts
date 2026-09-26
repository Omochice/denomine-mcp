/**
 * Resolves a path relative to the repository root, where `deno compile
 * --include` places embedded files.
 *
 * This module has to stay at the root. `deno compile --bundle` merges every
 * module into one file at the root of the embedded file system, so a module in
 * `src/` that climbs with `../../` from its own `import.meta.url` escapes it,
 * whereas a root module resolves the same way from source, from a plain
 * compile, and from a bundle. `Deno.mainModule` would also survive bundling,
 * but under `deno test` it names the test file instead.
 */
export function fromRoot(path: string): URL {
  return new URL(path, import.meta.url);
}
