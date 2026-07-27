import { assertEquals } from "jsr:@std/assert@1.0.18";
import { toIncludes } from "./include.ts";

Deno.test("nothing to include is nothing to ask for", () => {
  assertEquals(toIncludes(undefined), undefined);
  assertEquals(toIncludes([]), undefined);
});

Deno.test("an association keeps its name", () => {
  assertEquals(toIncludes(["journals"]), ["journals"]);
  assertEquals(toIncludes(["journals", "attachments"]), [
    "journals",
    "attachments",
  ]);
});

Deno.test("the one association Redmine spells with an underscore is renamed", () => {
  assertEquals(toIncludes(["allowedStatuses"]), ["allowed_statuses"]);
});
