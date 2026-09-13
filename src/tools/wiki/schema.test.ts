import { expect } from "jsr:@std/expect@1.0.20";
import * as v from "@valibot/valibot";
import { wikiInputSchema } from "./schema.ts";

Deno.test("show rejects a blank project reference", () => {
  for (const projectId of ["", "   "]) {
    expect(
      v.safeParse(wikiInputSchema("readonly"), {
        action: "show",
        projectId,
        title: "Home",
      }).success,
      projectId,
    ).toBe(false);
  }
});

Deno.test("show rejects a blank title", () => {
  for (const title of ["", " \t "]) {
    expect(
      v.safeParse(wikiInputSchema("readonly"), {
        action: "show",
        projectId: "demo",
        title,
      }).success,
      title,
    ).toBe(false);
  }
});

Deno.test("show accepts either form of the project reference", () => {
  for (const projectId of [1, "demo"]) {
    expect(
      v.safeParse(wikiInputSchema("readonly"), {
        action: "show",
        projectId,
        title: "Home",
      }).success,
      `${projectId}`,
    ).toBe(true);
  }
});
