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

Deno.test("readonly mode keeps show and download, because neither writes to Redmine", () => {
  expect(v.safeParse(schema, { action: "show", id: 1 }).success).toBe(true);
  expect(accepts({})).toBe(true);
});

Deno.test("readonly mode drops attach, which adds an attachment to an issue", () => {
  const attach = { action: "attach", path: "/tmp/a.txt", issueId: 1 };
  expect(v.safeParse(schema, attach).success).toBe(false);
  expect(v.safeParse(attachmentInputSchema("full"), attach).success).toBe(
    true,
  );
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

Deno.test("attach requires a source path that is not blank", () => {
  for (const path of [undefined, "", " \t "]) {
    expect(
      v.safeParse(attachmentInputSchema("full"), {
        action: "attach",
        path,
        issueId: 1,
      }).success,
      `${path}`,
    ).toBe(false);
  }
});

Deno.test("attach requires the issue to attach to", () => {
  expect(
    v.safeParse(attachmentInputSchema("full"), {
      action: "attach",
      path: "/tmp/a.txt",
    }).success,
  ).toBe(false);
});

Deno.test("attach keeps the filename, description, and comment", () => {
  const input = {
    action: "attach",
    path: "/tmp/a.txt",
    issueId: 1,
    filename: "b.txt",
    description: "server log",
    notes: "attached the log",
  };
  expect(v.parse(attachmentInputSchema("full"), input)).toStrictEqual(input);
});
