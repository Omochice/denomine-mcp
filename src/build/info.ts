import { fromRoot } from "../../root.ts";

/** The commit a compiled binary was built from. */
export type BuildInfo = {
  commit: string;
  /** Whether the working tree had uncommitted changes at build time. */
  dirty: boolean;
};

/**
 * Where `task/compile.ts` writes the build info and `deno compile --include`
 * embeds it.
 */
export const buildInfoUrl: URL = fromRoot("build-info.json");

/**
 * Reads the build info embedded in a compiled binary.
 *
 * @returns The build info, or `undefined` when running from source, where none
 *   is generated.
 */
export async function readBuildInfo(
  url: URL = buildInfoUrl,
): Promise<BuildInfo | undefined> {
  let raw: string;
  try {
    raw = await Deno.readTextFile(url);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return undefined;
    }
    throw error;
  }
  return JSON.parse(raw) as BuildInfo;
}
