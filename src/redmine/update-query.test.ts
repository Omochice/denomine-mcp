import { expect } from "@std/expect";
import { toUpdateQuery } from "./update-query.ts";

Deno.test("an ISO date becomes the UTC day, not the local one", () => {
  expect(toUpdateQuery({ startDate: "2026-07-01" })).toStrictEqual({
    startDate: new Date("2026-07-01T00:00:00Z"),
  });
  expect(toUpdateQuery({ dueDate: "2026-07-31" })).toStrictEqual({
    dueDate: new Date("2026-07-31T00:00:00Z"),
  });
});

Deno.test("a date the caller omitted stays absent, never a set-to-undefined key", () => {
  const query = toUpdateQuery({ subject: "planned" });
  expect(query).toStrictEqual({ subject: "planned" });
  expect(Object.hasOwn(query, "startDate")).toBe(false);
  expect(Object.hasOwn(query, "dueDate")).toBe(false);
});

Deno.test("the attributes that are not dates are handed over untouched", () => {
  expect(toUpdateQuery({ statusId: 5, notes: "done", fixedVersionId: null }))
    .toStrictEqual({ statusId: 5, notes: "done", fixedVersionId: null });
});

Deno.test("a day its month does not have is refused, not rolled over", () => {
  expect(() => toUpdateQuery({ dueDate: "2026-02-30" })).toThrow();
  expect(() => toUpdateQuery({ startDate: "2026-02-30" })).toThrow();
});
