import { cli } from "./src/cli/mod.ts";

if (import.meta.main) {
  await cli().parse(Deno.args);
}
