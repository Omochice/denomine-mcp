import { assert, assertEquals } from "jsr:@std/assert@1.0.18";
import * as v from "@valibot/valibot";
import { toObjectSchema } from "../../mcp/tool.ts";
import { issueInputSchema } from "./schema.ts";

Deno.test("list keeps fixedVersionId so a version filter is not silently dropped", () => {
  const parsed = v.parse(issueInputSchema("readonly"), {
    action: "list",
    fixedVersionId: 42,
  });
  assertEquals(parsed, { action: "list", fixedVersionId: 42 });
});

Deno.test("list keeps every date filter field", () => {
  const parsed = v.parse(issueInputSchema("readonly"), {
    action: "list",
    startDate: "2026-07-01",
    dueDate: { daysFromNow: 3 },
    createdOn: "thisWeek",
    updatedOn: { from: { daysAgo: 7 } },
    closedOn: { to: "2026-07-01" },
  });
  assertEquals(parsed, {
    action: "list",
    startDate: "2026-07-01",
    dueDate: { daysFromNow: 3 },
    createdOn: "thisWeek",
    updatedOn: { from: { daysAgo: 7 } },
    closedOn: { to: "2026-07-01" },
  });
});

Deno.test("a two-ended range keeps both bounds", () => {
  const parsed = v.parse(issueInputSchema("readonly"), {
    action: "list",
    createdOn: { from: "2026-01-01", to: "2026-02-01" },
  });
  assertEquals(parsed, {
    action: "list",
    createdOn: { from: "2026-01-01", to: "2026-02-01" },
  });
});

Deno.test("a date field rejects anything but an ISO date", () => {
  assert(
    !v.safeParse(issueInputSchema("readonly"), {
      action: "list",
      createdOn: "2026/07/01",
    }).success,
  );
});

Deno.test("the :date_past fields reject future-looking filters", () => {
  for (const createdOn of ["tomorrow", { daysFromNow: 3 }]) {
    assert(
      !v.safeParse(issueInputSchema("readonly"), { action: "list", createdOn })
        .success,
      `createdOn accepted ${JSON.stringify(createdOn)}, which Redmine 422s`,
    );
  }
  assert(
    v.safeParse(issueInputSchema("readonly"), {
      action: "list",
      dueDate: "tomorrow",
    }).success,
  );
});

Deno.test("the date filters survive the JSON Schema the server advertises", () => {
  const json = toObjectSchema(issueInputSchema("readonly"));
  const list = json.oneOf.find((branch) =>
    (branch as { properties?: { action?: { const?: unknown } } }).properties
      ?.action?.const === "list"
  ) as { properties: Record<string, unknown> };
  assert(list.properties.createdOn !== undefined);
});
