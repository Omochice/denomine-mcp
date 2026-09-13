import { expect } from "jsr:@std/expect@1.0.20";
import { FakeTimeEntryPort } from "../../redmine/fake.ts";
import { handleTimeEntry } from "./handler.ts";

function textOf(response: { content: { text: string }[] }): string {
  return response.content[0].text;
}

Deno.test("time entry handler runs a full CRUD cycle against the port", async (t) => {
  const port = new FakeTimeEntryPort();

  await t.step("create succeeds", async () => {
    const response = await handleTimeEntry(port, {
      action: "create",
      hours: 1.5,
      projectId: 1,
      activityId: 9,
      spentOn: "2026-08-01",
      comments: "wrote the port",
    });
    expect(response.isError).not.toBe(true);
  });

  await t.step("list returns the created entry", async () => {
    const response = await handleTimeEntry(port, {
      action: "list",
      projectId: 1,
    });
    const { timeEntries } = JSON.parse(textOf(response)) as {
      timeEntries: { id: number; hours: number }[];
    };
    expect(timeEntries.map((entry) => entry.hours)).toStrictEqual([1.5]);
  });

  await t.step("list filters out another project", async () => {
    const response = await handleTimeEntry(port, {
      action: "list",
      projectId: 2,
    });
    const { timeEntries } = JSON.parse(textOf(response)) as {
      timeEntries: unknown[];
    };
    expect(timeEntries).toStrictEqual([]);
  });

  await t.step("show returns the entry by id", async () => {
    const response = await handleTimeEntry(port, { action: "show", id: 1 });
    const { timeEntry } = JSON.parse(textOf(response)) as {
      timeEntry: { comments: string };
    };
    expect(timeEntry.comments).toBe("wrote the port");
  });

  await t.step("update changes the hours", async () => {
    const response = await handleTimeEntry(port, {
      action: "update",
      id: 1,
      hours: 2,
    });
    expect(response.isError).not.toBe(true);
    const shown = await handleTimeEntry(port, { action: "show", id: 1 });
    const { timeEntry } = JSON.parse(textOf(shown)) as {
      timeEntry: { hours: number };
    };
    expect(timeEntry.hours).toBe(2);
  });

  await t.step("delete removes the entry", async () => {
    const response = await handleTimeEntry(port, { action: "delete", id: 1 });
    expect(response.isError).not.toBe(true);
    const shown = await handleTimeEntry(port, { action: "show", id: 1 });
    expect(shown.isError).toBe(true);
  });
});

Deno.test("time entry handler lists only the requested user's entries", async () => {
  const mine = new FakeTimeEntryPort(7);
  await handleTimeEntry(mine, { action: "create", hours: 1, projectId: 1 });
  const response = await handleTimeEntry(mine, { action: "list", userId: 8 });
  const { timeEntries } = JSON.parse(textOf(response)) as {
    timeEntries: unknown[];
  };
  expect(timeEntries).toStrictEqual([]);
});

Deno.test("time entry handler surfaces a validation failure as isError", async () => {
  const port = new FakeTimeEntryPort();
  const response = await handleTimeEntry(port, {
    action: "create",
    hours: 0,
    projectId: 1,
  });
  expect(response.isError).toBe(true);
});
