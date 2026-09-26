import type { Notice } from "./notice.ts";
import { fromRoot } from "../../root.ts";

/**
 * Where `task/license.ts` writes the notices and `deno compile --include`
 * embeds them.
 */
export const noticesUrl: URL = fromRoot("third-party-licenses.json");

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
