import { Command } from "@cliffy/command";
import { readNotices } from "../license/embedded.ts";
import { formatNotices } from "../license/format.ts";

/**
 * `license`: satisfies the notice conditions of the third-party packages
 * embedded in this binary (see ADR-0013).
 */
export const licenseCommand = new Command()
  .description("Print the licenses of bundled third-party packages.")
  .action(async () => {
    console.log(formatNotices(await readNotices()));
  });
