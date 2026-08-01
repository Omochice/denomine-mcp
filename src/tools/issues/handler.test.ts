import { expect } from "jsr:@std/expect@1.0.20";
import { FakeIssuePort } from "../../redmine/fake.ts";
import { handleIssue } from "./handler.ts";

function textOf(response: { content: { text: string }[] }): string {
  return response.content[0].text;
}

Deno.test("issue handler runs a full CRUD cycle against the port", async (t) => {
  const port = new FakeIssuePort();

  await t.step("create succeeds", async () => {
    const response = await handleIssue(port, {
      action: "create",
      projectId: 1,
      trackerId: 1,
      statusId: 1,
      priorityId: 2,
      subject: "first",
    });
    expect(response.isError).not.toBe(true);
  });

  await t.step("list returns the created issue", async () => {
    const response = await handleIssue(port, { action: "list" });
    const { issues } = JSON.parse(textOf(response)) as {
      issues: { id: number; subject: string }[];
    };
    expect(issues.length).toBe(1);
    expect(issues[0].subject).toBe("first");
  });

  await t.step("show returns the issue by id", async () => {
    const response = await handleIssue(port, { action: "show", id: 1 });
    const { issue } = JSON.parse(textOf(response)) as {
      issue: { subject: string };
    };
    expect(issue.subject).toBe("first");
  });

  await t.step("update changes the subject", async () => {
    const response = await handleIssue(port, {
      action: "update",
      id: 1,
      subject: "second",
    });
    expect(response.isError).not.toBe(true);
    const shown = await handleIssue(port, { action: "show", id: 1 });
    const { issue } = JSON.parse(textOf(shown)) as {
      issue: { subject: string };
    };
    expect(issue.subject).toBe("second");
  });

  await t.step(
    "show returns the notes only when asked to include them",
    async () => {
      await handleIssue(port, { action: "update", id: 1, notes: "a comment" });

      const plain = await handleIssue(port, { action: "show", id: 1 });
      expect(
        (JSON.parse(textOf(plain)) as { issue: { journals?: unknown } }).issue
          .journals,
      ).toBe(undefined);

      const withJournals = await handleIssue(port, {
        action: "show",
        id: 1,
        include: ["journals"],
      });
      const { issue } = JSON.parse(textOf(withJournals)) as {
        issue: { journals: { notes: string }[] };
      };
      expect(issue.journals.map((journal) => journal.notes)).toStrictEqual([
        "a comment",
      ]);
    },
  );

  await t.step("delete removes the issue", async () => {
    const response = await handleIssue(port, { action: "delete", id: 1 });
    expect(response.isError).not.toBe(true);
    const shown = await handleIssue(port, { action: "show", id: 1 });
    expect(shown.isError).toBe(true);
  });
});

Deno.test("issue handler surfaces a validation failure as isError", async () => {
  const port = new FakeIssuePort();
  const response = await handleIssue(port, {
    action: "create",
    projectId: 1,
    trackerId: 1,
    statusId: 1,
    priorityId: 2,
    subject: "   ",
  });
  expect(response.isError).toBe(true);
  const error = JSON.parse(textOf(response)) as { status: number };
  expect(error.status).toBe(422);
});
