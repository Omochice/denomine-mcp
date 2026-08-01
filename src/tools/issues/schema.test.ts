import { expect } from "jsr:@std/expect@1.0.20";
import * as v from "@valibot/valibot";
import { toObjectSchema } from "../../mcp/tool.ts";
import { issueInputSchema } from "./schema.ts";

Deno.test("list keeps fixedVersionId so a version filter is not silently dropped", () => {
  const parsed = v.parse(issueInputSchema("readonly"), {
    action: "list",
    fixedVersionId: 42,
  });
  expect(parsed).toStrictEqual({ action: "list", fixedVersionId: 42 });
});

Deno.test("show keeps the associations it was asked to include", () => {
  const parsed = v.parse(issueInputSchema("readonly"), {
    action: "show",
    id: 1,
    include: ["journals", "attachments"],
  });
  expect(parsed).toStrictEqual({
    action: "show",
    id: 1,
    include: ["journals", "attachments"],
  });
});

Deno.test("list keeps the associations it was asked to include", () => {
  const parsed = v.parse(issueInputSchema("readonly"), {
    action: "list",
    include: ["attachments"],
  });
  expect(parsed).toStrictEqual({ action: "list", include: ["attachments"] });
});

Deno.test("list rejects an association only show can fetch", () => {
  expect(
    !v.safeParse(issueInputSchema("readonly"), {
      action: "list",
      include: ["journals"],
    }).success,
  ).toBe(true);
});

Deno.test("show rejects an association Redmine does not have", () => {
  expect(
    !v.safeParse(issueInputSchema("readonly"), {
      action: "show",
      id: 1,
      include: ["comments"],
    }).success,
  ).toBe(true);
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
  expect(parsed).toStrictEqual({
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
  expect(parsed).toStrictEqual({
    action: "list",
    createdOn: { from: "2026-01-01", to: "2026-02-01" },
  });
});

Deno.test("a date field rejects anything but an ISO date", () => {
  expect(
    !v.safeParse(issueInputSchema("readonly"), {
      action: "list",
      createdOn: "2026/07/01",
    }).success,
  ).toBe(true);
});

Deno.test("the :date_past fields reject future-looking filters", () => {
  for (const createdOn of ["tomorrow", { daysFromNow: 3 }]) {
    expect(
      !v.safeParse(issueInputSchema("readonly"), { action: "list", createdOn })
        .success,
      `createdOn accepted ${JSON.stringify(createdOn)}, which Redmine 422s`,
    ).toBe(true);
  }
  expect(
    v.safeParse(issueInputSchema("readonly"), {
      action: "list",
      dueDate: "tomorrow",
    }).success,
  ).toBe(true);
});

type Branch = {
  type?: string;
  description?: string;
  properties?: { action?: { const?: unknown } };
};

function listProperties(): Record<string, { anyOf?: Branch[] }> {
  const json = toObjectSchema(issueInputSchema("readonly"));
  const list = (json.oneOf as Branch[])
    .find((branch) => branch.properties?.action?.const === "list");
  expect(list, "the list action should be advertised").toBeDefined();
  return (list as unknown as {
    properties: Record<string, { anyOf?: Branch[] }>;
  }).properties;
}

Deno.test("the date filters survive the JSON Schema the server advertises", () => {
  expect(listProperties().createdOn).toBeDefined();
});

Deno.test("every date filter form advertises what it means", () => {
  const properties = listProperties();
  let described = 0;
  for (
    const field of [
      "startDate",
      "dueDate",
      "createdOn",
      "updatedOn",
      "closedOn",
    ]
  ) {
    for (const form of properties[field].anyOf ?? []) {
      if (form.type !== "object") {
        continue;
      }
      described += 1;
      expect(
        form.description !== undefined,
        `${field} advertises a form with no description: ${
          JSON.stringify(form)
        }`,
      ).toBe(true);
    }
  }
  const pastForms = 5;
  const futureForms = 4;
  expect(described).toBe(5 * pastForms + 2 * futureForms);
});
