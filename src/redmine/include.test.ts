import { expect } from "@std/expect";
import { toIncludes } from "./include.ts";

Deno.test("nothing to include is nothing to ask for", () => {
  expect(toIncludes(undefined)).toBe(undefined);
  expect(toIncludes([])).toBe(undefined);
});

Deno.test("an association keeps its name", () => {
  expect(toIncludes(["journals"])).toStrictEqual(["journals"]);
  expect(toIncludes(["journals", "attachments"])).toStrictEqual([
    "journals",
    "attachments",
  ]);
});

Deno.test("the one association Redmine spells with an underscore is renamed", () => {
  expect(toIncludes(["allowedStatuses"])).toStrictEqual(["allowed_statuses"]);
});
