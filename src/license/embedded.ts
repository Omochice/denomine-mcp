import type { Notice } from "./notice.ts";

/**
 * Where `task/license.ts` writes the notices and `deno compile --include`
 * embeds them. Resolved from this module, like the keyring cdylib in
 * `src/keyring/ffi.ts`, so it works both from source and inside the binary.
 */
export const noticesUrl: URL = new URL(
  "../../third-party-licenses.json",
  import.meta.url,
);

/**
 * Reads the generated third-party notices.
 *
 * @throws {Error} When the file has not been generated, naming the command that
 *   generates it.
 */
export async function readNotices(url: URL = noticesUrl): Promise<Notice[]> {
  let raw: string;
  try {
    raw = await Deno.readTextFile(url);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(
        `${url.pathname} does not exist; run \`deno task license\` to generate it`,
      );
    }
    throw error;
  }
  return JSON.parse(raw) as Notice[];
}
