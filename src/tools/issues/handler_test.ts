import { assert, assertEquals } from "jsr:@std/assert@1.0.18";
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
    assert(response.isError !== true);
  });

  await t.step("list returns the created issue", async () => {
    const response = await handleIssue(port, { action: "list" });
    const { issues } = JSON.parse(textOf(response)) as {
      issues: { id: number; subject: string }[];
    };
    assertEquals(issues.length, 1);
    assertEquals(issues[0].subject, "first");
  });

  await t.step("show returns the issue by id", async () => {
    const response = await handleIssue(port, { action: "show", id: 1 });
    const { issue } = JSON.parse(textOf(response)) as {
      issue: { subject: string };
    };
    assertEquals(issue.subject, "first");
  });

  await t.step("update changes the subject", async () => {
    const response = await handleIssue(port, {
      action: "update",
      id: 1,
      subject: "second",
    });
    assert(response.isError !== true);
    const shown = await handleIssue(port, { action: "show", id: 1 });
    const { issue } = JSON.parse(textOf(shown)) as {
      issue: { subject: string };
    };
    assertEquals(issue.subject, "second");
  });

  await t.step("delete removes the issue", async () => {
    const response = await handleIssue(port, { action: "delete", id: 1 });
    assert(response.isError !== true);
    const shown = await handleIssue(port, { action: "show", id: 1 });
    assertEquals(shown.isError, true);
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
  assertEquals(response.isError, true);
  const error = JSON.parse(textOf(response)) as { status: number };
  assertEquals(error.status, 422);
});
