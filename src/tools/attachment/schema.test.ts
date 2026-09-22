import { expect } from "@std/expect";
import * as v from "@valibot/valibot";
import { attachmentInputSchema, defaultMaxSize } from "./schema.ts";

const schema = attachmentInputSchema("readonly");

function accepts(overrides: Record<string, unknown>): boolean {
  return v.safeParse(schema, {
    action: "download",
    id: 1,
    path: "/tmp/a.txt",
    maxSize: 1024,
    ...overrides,
  }).success;
}

Deno.test("readonly mode keeps both actions, because neither writes to Redmine", () => {
  expect(v.safeParse(schema, { action: "show", id: 1 }).success).toBe(true);
  expect(accepts({})).toBe(true);
});

Deno.test("download requires a destination path", () => {
  expect(
    v.safeParse(schema, { action: "download", id: 1, maxSize: 1024 }).success,
  ).toBe(false);
});

Deno.test("download rejects a blank destination path", () => {
  for (const path of ["", " \t "]) {
    expect(accepts({ path }), path).toBe(false);
  }
});

Deno.test("download falls back to the default byte limit", () => {
  const parsed = v.safeParse(schema, {
    action: "download",
    id: 1,
    path: "/tmp/a.txt",
  });
  expect(parsed.success).toBe(true);
  expect((parsed.output as { maxSize: number }).maxSize).toBe(defaultMaxSize);
});

Deno.test("download rejects a byte limit that bounds nothing", () => {
  for (const maxSize of [0, -1, 1.5]) {
    expect(accepts({ maxSize }), `${maxSize}`).toBe(false);
  }
});
