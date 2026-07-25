import { assertEquals } from "jsr:@std/assert@1.0.18";
import * as v from "@valibot/valibot";
import { issueInputSchema } from "./schema.ts";

Deno.test("list keeps fixedVersionId so a version filter is not silently dropped", () => {
  const parsed = v.parse(issueInputSchema("readonly"), {
    action: "list",
    fixedVersionId: 42,
  });
  assertEquals(parsed, { action: "list", fixedVersionId: 42 });
});
