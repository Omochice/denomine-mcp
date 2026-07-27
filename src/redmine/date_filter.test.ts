import { assert, assertEquals } from "jsr:@std/assert@1.0.18";
import { toListOption } from "@omochice/redmine/issues/validator";
import * as v from "@valibot/valibot";
import { toListQuery } from "./date_filter.ts";

Deno.test("an ISO date becomes the UTC day, not the local one", () => {
  assertEquals(
    toListQuery({ createdOn: "2026-07-01" }),
    { createdOn: new Date("2026-07-01T00:00:00Z") },
  );
});

Deno.test("a named period passes through untouched", () => {
  assertEquals(toListQuery({ createdOn: "thisWeek" }), {
    createdOn: "thisWeek",
  });
  assertEquals(toListQuery({ dueDate: "nextWeek" }), { dueDate: "nextWeek" });
});

Deno.test("both ends of an absolute range become dates", () => {
  assertEquals(
    toListQuery({ updatedOn: { from: "2026-01-01", to: "2026-02-01" } }),
    {
      updatedOn: {
        from: new Date("2026-01-01T00:00:00Z"),
        to: new Date("2026-02-01T00:00:00Z"),
      },
    },
  );
});

Deno.test("a one-sided absolute range keeps only the bound it was given", () => {
  assertEquals(
    toListQuery({ startDate: { from: "2026-01-01" } }),
    { startDate: { from: new Date("2026-01-01T00:00:00Z") } },
  );
  assertEquals(
    toListQuery({ startDate: { to: "2026-01-01" } }),
    { startDate: { to: new Date("2026-01-01T00:00:00Z") } },
  );
});

Deno.test("relative bounds pass through untouched", () => {
  assertEquals(toListQuery({ createdOn: { daysAgo: 3 } }), {
    createdOn: { daysAgo: 3 },
  });
  assertEquals(
    toListQuery({ updatedOn: { from: { daysAgo: 7 }, to: "today" } }),
    { updatedOn: { from: { daysAgo: 7 }, to: "today" } },
  );
  assertEquals(toListQuery({ closedOn: { to: { daysAgo: 7 } } }), {
    closedOn: { to: { daysAgo: 7 } },
  });
  assertEquals(toListQuery({ dueDate: { from: { daysFromNow: 5 } } }), {
    dueDate: { from: { daysFromNow: 5 } },
  });
  assertEquals(
    toListQuery({ dueDate: { from: "today", to: { daysFromNow: 5 } } }),
    { dueDate: { from: "today", to: { daysFromNow: 5 } } },
  );
});

Deno.test("a filter the caller omitted stays absent, never a set-to-undefined key", () => {
  const query = toListQuery({ projectId: 1 });
  assertEquals(query, { projectId: 1 });
  assert(!Object.hasOwn(query, "createdOn"));
});

/**
 * The shapes above only pin what the library is handed. These assert what
 * Redmine finally receives, which is where a Date built from local calendar
 * fields would silently slip to the previous day.
 */
Deno.test("the converted filter reaches Redmine as the requested day", () => {
  assertEquals(
    v.parse(toListOption, toListQuery({ createdOn: "2026-07-01" })),
    { created_on: "=2026-07-01" },
  );
  assertEquals(
    v.parse(
      toListOption,
      toListQuery({ updatedOn: { from: "2026-01-01", to: "2026-02-01" } }),
    ),
    { updated_on: "><2026-01-01|2026-02-01" },
  );
  assertEquals(
    v.parse(toListOption, toListQuery({ createdOn: { from: { daysAgo: 7 } } })),
    { created_on: ">t-7" },
  );
});
