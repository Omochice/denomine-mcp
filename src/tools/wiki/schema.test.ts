import { expect } from "@std/expect";
import * as v from "@valibot/valibot";
import { wikiInputSchema } from "./schema.ts";

const schema = wikiInputSchema("readonly");

function accepts(overrides: Record<string, unknown>): boolean {
  return v.safeParse(schema, {
    action: "show",
    projectId: "demo",
    title: "Home",
    ...overrides,
  }).success;
}

Deno.test("show rejects a project identifier holding whitespace", () => {
  for (const projectId of ["", "   ", " demo ", "de mo"]) {
    expect(accepts({ projectId }), projectId).toBe(false);
  }
});

Deno.test("show rejects a blank title", () => {
  for (const title of ["", " \t "]) {
    expect(accepts({ title }), title).toBe(false);
  }
});

Deno.test("show accepts either form of the project reference", () => {
  for (const projectId of [1, "demo", "1"]) {
    expect(accepts({ projectId }), `${projectId}`).toBe(true);
  }
});
