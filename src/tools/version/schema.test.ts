import { expect } from "@std/expect";
import * as v from "@valibot/valibot";
import { versionInputSchema } from "./schema.ts";

const schema = versionInputSchema("full");

function accepts(input: Record<string, unknown>): boolean {
  return v.safeParse(schema, input).success;
}

Deno.test("list and create accept either form of the project reference", () => {
  for (const projectId of [1, "demo", "1"]) {
    expect(accepts({ action: "list", projectId }), `list ${projectId}`).toBe(
      true,
    );
    expect(
      accepts({ action: "create", projectId, name: "v1.0" }),
      `create ${projectId}`,
    ).toBe(true);
  }
});

Deno.test("list rejects a project identifier holding whitespace", () => {
  for (const projectId of ["", "   ", " demo ", "de mo"]) {
    expect(accepts({ action: "list", projectId }), projectId).toBe(false);
  }
});
