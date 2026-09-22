import { expect } from "@std/expect";
import { toIssueDates } from "./issue-dates.ts";

Deno.test("an ISO date becomes the UTC day, not the local one", () => {
  expect(toIssueDates({ startDate: "2026-07-01" })).toStrictEqual({
    startDate: new Date("2026-07-01T00:00:00Z"),
  });
  expect(toIssueDates({ dueDate: "2026-07-31" })).toStrictEqual({
    dueDate: new Date("2026-07-31T00:00:00Z"),
  });
});

Deno.test("a date the caller omitted stays absent, never a set-to-undefined key", () => {
  const query = toIssueDates({ subject: "planned" });
  expect(query).toStrictEqual({ subject: "planned" });
  expect(Object.hasOwn(query, "startDate")).toBe(false);
  expect(Object.hasOwn(query, "dueDate")).toBe(false);
});

Deno.test("the attributes that are not dates are handed over untouched", () => {
  expect(toIssueDates({ statusId: 5, notes: "done", fixedVersionId: null }))
    .toStrictEqual({ statusId: 5, notes: "done", fixedVersionId: null });
});

Deno.test("a day its month does not have is refused, not rolled over", () => {
  expect(() => toIssueDates({ dueDate: "2026-02-30" })).toThrow();
  expect(() => toIssueDates({ startDate: "2026-02-30" })).toThrow();
});

Deno.test("a null date is handed over as null, so Redmine clears the field", () => {
  expect(toIssueDates({ startDate: null, dueDate: null })).toStrictEqual({
    startDate: null,
    dueDate: null,
  });
});

Deno.test("the dates of a new issue become UTC days alongside its other attributes", () => {
  expect(
    toIssueDates({
      projectId: 1,
      subject: "planned",
      startDate: "2026-07-01",
      dueDate: "2026-07-31",
    }),
  ).toStrictEqual({
    projectId: 1,
    subject: "planned",
    startDate: new Date("2026-07-01T00:00:00Z"),
    dueDate: new Date("2026-07-31T00:00:00Z"),
  });
});
