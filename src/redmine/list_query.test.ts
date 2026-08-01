import { expect } from "jsr:@std/expect@1.0.20";
import { toListOption } from "@omochice/redmine/issues/validator";
import * as v from "@valibot/valibot";
import { toListQuery } from "./list_query.ts";

Deno.test("an ISO date becomes the UTC day, not the local one", () => {
  expect(toListQuery({ createdOn: "2026-07-01" })).toStrictEqual({
    createdOn: new Date("2026-07-01T00:00:00Z"),
  });
});

Deno.test("a named period passes through untouched", () => {
  expect(toListQuery({ createdOn: "thisWeek" })).toStrictEqual({
    createdOn: "thisWeek",
  });
  expect(toListQuery({ dueDate: "nextWeek" })).toStrictEqual({
    dueDate: "nextWeek",
  });
});

Deno.test("both ends of an absolute range become dates", () => {
  expect(toListQuery({ updatedOn: { from: "2026-01-01", to: "2026-02-01" } }))
    .toStrictEqual({
      updatedOn: {
        from: new Date("2026-01-01T00:00:00Z"),
        to: new Date("2026-02-01T00:00:00Z"),
      },
    });
});

Deno.test("a one-sided absolute range keeps only the bound it was given", () => {
  expect(toListQuery({ startDate: { from: "2026-01-01" } })).toStrictEqual({
    startDate: { from: new Date("2026-01-01T00:00:00Z") },
  });
  expect(toListQuery({ startDate: { to: "2026-01-01" } })).toStrictEqual({
    startDate: { to: new Date("2026-01-01T00:00:00Z") },
  });
});

Deno.test("relative bounds pass through untouched", () => {
  expect(toListQuery({ createdOn: { daysAgo: 3 } })).toStrictEqual({
    createdOn: { daysAgo: 3 },
  });
  expect(toListQuery({ updatedOn: { from: { daysAgo: 7 }, to: "today" } }))
    .toStrictEqual({ updatedOn: { from: { daysAgo: 7 }, to: "today" } });
  expect(toListQuery({ closedOn: { to: { daysAgo: 7 } } })).toStrictEqual({
    closedOn: { to: { daysAgo: 7 } },
  });
  expect(toListQuery({ dueDate: { from: { daysFromNow: 5 } } })).toStrictEqual({
    dueDate: { from: { daysFromNow: 5 } },
  });
  expect(toListQuery({ dueDate: { from: "today", to: { daysFromNow: 5 } } }))
    .toStrictEqual({ dueDate: { from: "today", to: { daysFromNow: 5 } } });
});

Deno.test("the associations to list are handed over as Redmine names them", () => {
  expect(toListQuery({ projectId: 1, include: ["attachments", "relations"] }))
    .toStrictEqual({ projectId: 1, include: ["attachments", "relations"] });
});

Deno.test("an empty include list leaves the parameter off", () => {
  const query = toListQuery({ projectId: 1, include: [] });
  expect(query).toStrictEqual({ projectId: 1 });
  expect(Object.hasOwn(query, "include")).toBe(false);
});

Deno.test("a filter the caller omitted stays absent, never a set-to-undefined key", () => {
  const query = toListQuery({ projectId: 1 });
  expect(query).toStrictEqual({ projectId: 1 });
  expect(Object.hasOwn(query, "createdOn")).toBe(false);
});

Deno.test("a day its month does not have is refused, not rolled over", () => {
  expect(() => toListQuery({ createdOn: "2026-02-30" })).toThrow();
  expect(() => toListQuery({ startDate: { from: "2026-02-30" } })).toThrow();
});

/**
 * The shapes above only pin what the library is handed. These assert what
 * Redmine finally receives, which is where a Date built from local calendar
 * fields would silently slip to the previous day.
 */
Deno.test("the converted filter reaches Redmine as the requested day", () => {
  expect(v.parse(toListOption, toListQuery({ createdOn: "2026-07-01" })))
    .toStrictEqual({ created_on: "=2026-07-01" });
  expect(
    v.parse(
      toListOption,
      toListQuery({ updatedOn: { from: "2026-01-01", to: "2026-02-01" } }),
    ),
  ).toStrictEqual({ updated_on: "><2026-01-01|2026-02-01" });
  expect(
    v.parse(toListOption, toListQuery({ createdOn: { from: { daysAgo: 7 } } })),
  ).toStrictEqual({ created_on: ">t-7" });
});
