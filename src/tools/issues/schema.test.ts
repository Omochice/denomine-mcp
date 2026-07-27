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

Deno.test("show keeps the associations it was asked to include", () => {
  const parsed = v.parse(issueInputSchema("readonly"), {
    action: "show",
    id: 1,
    include: ["journals", "attachments"],
  });
  assertEquals(parsed, {
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
  assertEquals(parsed, { action: "list", include: ["attachments"] });
});

Deno.test("list rejects an association only show can fetch", () => {
  assert(
    !v.safeParse(issueInputSchema("readonly"), {
      action: "list",
      include: ["journals"],
    }).success,
  );
});

Deno.test("show rejects an association Redmine does not have", () => {
  assert(
    !v.safeParse(issueInputSchema("readonly"), {
      action: "show",
      id: 1,
      include: ["comments"],
    }).success,
  );
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

type Branch = {
  type?: string;
  description?: string;
  properties?: { action?: { const?: unknown } };
};

function listProperties(): Record<string, { anyOf?: Branch[] }> {
  const json = toObjectSchema(issueInputSchema("readonly"));
  const list = (json.oneOf as Branch[])
    .find((branch) => branch.properties?.action?.const === "list");
  assert(list !== undefined, "the list action should be advertised");
  return (list as unknown as {
    properties: Record<string, { anyOf?: Branch[] }>;
  }).properties;
}

Deno.test("the date filters survive the JSON Schema the server advertises", () => {
  assert(listProperties().createdOn !== undefined);
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
      assert(
        form.description !== undefined,
        `${field} advertises a form with no description: ${
          JSON.stringify(form)
        }`,
      );
    }
  }
  const pastForms = 5;
  const futureForms = 4;
  assertEquals(described, 5 * pastForms + 2 * futureForms);
});
