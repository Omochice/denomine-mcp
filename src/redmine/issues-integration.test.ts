import { expect } from "@std/expect";
import { Result } from "@praha/byethrow";
import { Redmine } from "@omochice/redmine";
import { RedmineClient } from "./client.ts";
import { VersionClient } from "./version-client.ts";

/** Reads an env var, treating a denied `--allow-env` as simply absent so the
 * suite can run under `--allow-read` alone and this test is skipped. */
function env(name: string): string | undefined {
  try {
    return Deno.env.get(name);
  } catch {
    return undefined;
  }
}

const endpoint = env("DENOMINE_TEST_ENDPOINT");
const apiKey = env("DENOMINE_TEST_API_KEY");
const projectId = Number(env("DENOMINE_TEST_PROJECT_ID") ?? "1");

async function createVersion(
  versions: VersionClient,
  name: string,
  cleanup: AsyncDisposableStack,
): Promise<number> {
  const created = await versions.create(projectId, { name });
  expect(Result.isSuccess(created), JSON.stringify(created)).toBe(true);
  const listed = Result.unwrap(await versions.list(projectId)) as {
    id: number;
    name: string;
  }[];
  const id = listed.find((version) => version.name === name)!.id;
  cleanup.defer(async () => {
    await versions.delete(id);
  });
  return id;
}

/**
 * Exercises the real `@omochice/redmine`-backed client end to end against a live
 * Redmine (see doc/verification.md). Skipped unless the endpoint and API key are
 * supplied, so the suite stays runnable without a running instance.
 */
Deno.test({
  name: "RedmineClient runs issue CRUD against a live Redmine",
  ignore: endpoint == null || apiKey == null,
  // The library does not consume every response body, which trips Deno's
  // resource sanitizer as a false positive.
  sanitizeResources: false,
  fn: async (t) => {
    const client = new RedmineClient({ endpoint: endpoint!, apiKey: apiKey! });
    const subject = `denomine-mcp CRUD ${Date.now()}`;
    let id = 0;

    await t.step("create", async () => {
      const result = await client.create({
        projectId,
        trackerId: 1,
        statusId: 1,
        priorityId: 2,
        subject,
      });
      expect(Result.isSuccess(result), JSON.stringify(result)).toBe(true);
    });

    await t.step("list finds the created issue", async () => {
      const result = await client.list({ projectId });
      expect(Result.isSuccess(result)).toBe(true);
      const issues = Result.unwrap(result) as { id: number; subject: string }[];
      const found = issues.find((issue) => issue.subject === subject);
      expect(found, "created issue not found in list").toBeDefined();
      id = found!.id;
    });

    await t.step("list filtered by creation date finds it", async () => {
      const result = await client.list({ projectId, createdOn: "today" });
      expect(Result.isSuccess(result), JSON.stringify(result)).toBe(true);
      const issues = Result.unwrap(result) as { id: number }[];
      expect(
        issues.some((issue) => issue.id === id),
        "issue created moments ago not matched by createdOn: today",
      ).toBe(true);
    });

    await t.step("show returns the issue", async () => {
      const result = await client.show(id);
      expect(Result.isSuccess(result)).toBe(true);
      expect((Result.unwrap(result) as { subject: string }).subject).toBe(
        subject,
      );
    });

    await t.step("update changes the subject", async () => {
      const updated = await client.update(id, {
        subject: `${subject} (edited)`,
      });
      expect(Result.isSuccess(updated), JSON.stringify(updated)).toBe(true);
      const shown = await client.show(id);
      expect(Result.isSuccess(shown)).toBe(true);
      expect((Result.unwrap(shown) as { subject: string }).subject).toBe(
        `${subject} (edited)`,
      );
    });

    await t.step("delete removes the issue", async () => {
      const deleted = await client.delete(id);
      expect(Result.isSuccess(deleted), JSON.stringify(deleted)).toBe(true);
      const shown = await client.show(id);
      expect(Result.isFailure(shown), "issue should be gone after delete")
        .toBe(true);
    });
  },
});

Deno.test({
  name:
    "RedmineClient creates an issue inside a version against a live Redmine",
  ignore: endpoint == null || apiKey == null,
  sanitizeResources: false,
  fn: async () => {
    const context = { endpoint: endpoint!, apiKey: apiKey! };
    const client = new RedmineClient(context);
    const versions = new VersionClient(context);
    const name = `denomine-mcp ${Date.now()}`;
    await using cleanup = new AsyncDisposableStack();

    const fixedVersionId = await createVersion(versions, name, cleanup);

    const issuesInVersion = async () =>
      Result.unwrap(await client.list({ projectId, fixedVersionId })) as {
        id: number;
        subject: string;
      }[];
    cleanup.defer(async () => {
      for (const issue of await issuesInVersion()) {
        await client.delete(issue.id);
      }
    });

    const result = await client.create({
      projectId,
      trackerId: 1,
      statusId: 1,
      priorityId: 2,
      subject: name,
      fixedVersionId,
    });
    expect(Result.isSuccess(result), JSON.stringify(result)).toBe(true);

    expect((await issuesInVersion()).map((issue) => issue.subject))
      .toStrictEqual([name]);
  },
});

Deno.test({
  name: "RedmineClient moves an issue between versions against a live Redmine",
  ignore: endpoint == null || apiKey == null,
  sanitizeResources: false,
  fn: async (t) => {
    const context = { endpoint: endpoint!, apiKey: apiKey! };
    const client = new RedmineClient(context);
    const versions = new VersionClient(context);
    const name = `denomine-mcp ${Date.now()}`;
    await using cleanup = new AsyncDisposableStack();
    const from = await createVersion(versions, `${name} from`, cleanup);
    const to = await createVersion(versions, `${name} to`, cleanup);

    const created = await client.create({
      projectId,
      trackerId: 1,
      statusId: 1,
      priorityId: 2,
      subject: name,
      fixedVersionId: from,
    });
    expect(Result.isSuccess(created), JSON.stringify(created)).toBe(true);
    const inVersion = Result.unwrap(
      await client.list({ projectId, fixedVersionId: from }),
    ) as { id: number }[];
    const id = inVersion[0].id;
    cleanup.defer(async () => {
      await client.delete(id);
    });

    const shownVersion = async () => {
      const shown = await client.show(id);
      expect(Result.isSuccess(shown), JSON.stringify(shown)).toBe(true);
      return (Result.unwrap(shown) as { fixedVersion?: { id: number } })
        .fixedVersion?.id;
    };

    await t.step(
      "show reports the version the issue was created in",
      async () => {
        expect(await shownVersion()).toBe(from);
      },
    );

    await t.step("update moves the issue to another version", async () => {
      const updated = await client.update(id, { fixedVersionId: to });
      expect(Result.isSuccess(updated), JSON.stringify(updated)).toBe(true);
      expect(await shownVersion()).toBe(to);
    });

    await t.step(
      "update with null takes the issue out of its version",
      async () => {
        const updated = await client.update(id, { fixedVersionId: null });
        expect(Result.isSuccess(updated), JSON.stringify(updated)).toBe(true);
        expect(await shownVersion()).toBeUndefined();
      },
    );
  },
});

async function createIssue(
  client: RedmineClient,
  subject: string,
  cleanup: AsyncDisposableStack,
): Promise<number> {
  const created = await client.create({
    projectId,
    trackerId: 1,
    statusId: 1,
    priorityId: 2,
    subject,
  });
  expect(Result.isSuccess(created), JSON.stringify(created)).toBe(true);
  const listed = Result.unwrap(await client.list({ projectId })) as {
    id: number;
    subject: string;
  }[];
  const id = listed.find((issue) => issue.subject === subject)!.id;
  cleanup.defer(async () => {
    await client.delete(id);
  });
  return id;
}

Deno.test({
  name: "RedmineClient changes an issue's status against a live Redmine",
  ignore: endpoint == null || apiKey == null,
  sanitizeResources: false,
  fn: async () => {
    const client = new RedmineClient({ endpoint: endpoint!, apiKey: apiKey! });
    await using cleanup = new AsyncDisposableStack();
    const id = await createIssue(
      client,
      `denomine-mcp status ${Date.now()}`,
      cleanup,
    );
    const before = Result.unwrap(
      await client.show(id, ["allowedStatuses"]),
    ) as { status: { id: number }; allowedStatuses: { id: number }[] };
    const target = before.allowedStatuses
      .find((status) => status.id !== before.status.id);
    expect(target, "the workflow should allow another status").toBeDefined();

    const updated = await client.update(id, { statusId: target!.id });
    expect(Result.isSuccess(updated), JSON.stringify(updated)).toBe(true);

    const after = Result.unwrap(await client.show(id)) as {
      status: { id: number };
    };
    expect(after.status.id).toBe(target!.id);
  },
});

Deno.test({
  name:
    "RedmineClient sets an issue's start and due dates against a live Redmine",
  ignore: endpoint == null || apiKey == null,
  sanitizeResources: false,
  fn: async () => {
    const client = new RedmineClient({ endpoint: endpoint!, apiKey: apiKey! });
    await using cleanup = new AsyncDisposableStack();
    const id = await createIssue(
      client,
      `denomine-mcp dates ${Date.now()}`,
      cleanup,
    );
    const startDate = "2099-07-01";
    const dueDate = "2099-07-31";
    const updated = await client.update(id, { startDate, dueDate });
    expect(Result.isSuccess(updated), JSON.stringify(updated)).toBe(true);

    const shown = Result.unwrap(await client.show(id)) as {
      startDate: Date;
      dueDate: Date;
    };
    expect(shown.startDate.toISOString().slice(0, 10)).toBe(startDate);
    expect(shown.dueDate.toISOString().slice(0, 10)).toBe(dueDate);
  },
});

Deno.test({
  name:
    "RedmineClient clears an issue's start and due dates against a live Redmine",
  ignore: endpoint == null || apiKey == null,
  sanitizeResources: false,
  fn: async () => {
    const client = new RedmineClient({ endpoint: endpoint!, apiKey: apiKey! });
    await using cleanup = new AsyncDisposableStack();
    const id = await createIssue(
      client,
      `denomine-mcp clear ${Date.now()}`,
      cleanup,
    );
    const scheduled = await client.update(id, {
      startDate: "2099-07-01",
      dueDate: "2099-07-31",
    });
    expect(Result.isSuccess(scheduled), JSON.stringify(scheduled)).toBe(true);

    const cleared = await client.update(id, {
      startDate: null,
      dueDate: null,
    });
    expect(Result.isSuccess(cleared), JSON.stringify(cleared)).toBe(true);

    const shown = Result.unwrap(await client.show(id)) as {
      startDate?: Date;
      dueDate?: Date;
    };
    expect(shown.startDate).toBeUndefined();
    expect(shown.dueDate).toBeUndefined();
  },
});

Deno.test({
  name:
    "RedmineClient creates an issue with start and due dates against a live Redmine",
  ignore: endpoint == null || apiKey == null,
  sanitizeResources: false,
  fn: async () => {
    const client = new RedmineClient({ endpoint: endpoint!, apiKey: apiKey! });
    const subject = `denomine-mcp create dates ${Date.now()}`;
    const startDate = "2099-07-01";
    const dueDate = "2099-07-31";
    const findId = async () =>
      (Result.unwrap(await client.list({ projectId })) as {
        id: number;
        subject: string;
      }[]).find((issue) => issue.subject === subject)?.id;
    await using cleanup = new AsyncDisposableStack();
    cleanup.defer(async () => {
      const id = await findId();
      if (id != null) {
        await client.delete(id);
      }
    });

    const created = await client.create({
      projectId,
      trackerId: 1,
      statusId: 1,
      priorityId: 2,
      subject,
      startDate,
      dueDate,
    });
    expect(Result.isSuccess(created), JSON.stringify(created)).toBe(true);

    const id = await findId();
    expect(id, "created issue not found in list").toBeDefined();
    const shown = Result.unwrap(await client.show(id!)) as {
      startDate: Date;
      dueDate: Date;
    };
    expect(shown.startDate.toISOString().slice(0, 10)).toBe(startDate);
    expect(shown.dueDate.toISOString().slice(0, 10)).toBe(dueDate);
  },
});

Deno.test({
  name: "RedmineClient moves an issue under a parent against a live Redmine",
  ignore: endpoint == null || apiKey == null,
  sanitizeResources: false,
  fn: async (t) => {
    const client = new RedmineClient({ endpoint: endpoint!, apiKey: apiKey! });
    const name = `denomine-mcp parent ${Date.now()}`;
    await using cleanup = new AsyncDisposableStack();
    const parent = await createIssue(client, `${name} parent`, cleanup);
    const child = await createIssue(client, `${name} child`, cleanup);

    const shownParent = async () =>
      (Result.unwrap(await client.show(child)) as { parent?: { id: number } })
        .parent?.id;

    await t.step("update attaches the issue to a parent", async () => {
      const updated = await client.update(child, { parentIssueId: parent });
      expect(Result.isSuccess(updated), JSON.stringify(updated)).toBe(true);
      expect(await shownParent()).toBe(parent);
    });

    await t.step("update with null detaches it again", async () => {
      const updated = await client.update(child, { parentIssueId: null });
      expect(Result.isSuccess(updated), JSON.stringify(updated)).toBe(true);
      expect(await shownParent()).toBeUndefined();
    });
  },
});

Deno.test({
  name: "RedmineClient assigns and unassigns an issue against a live Redmine",
  ignore: endpoint == null || apiKey == null,
  sanitizeResources: false,
  fn: async (t) => {
    const context = { endpoint: endpoint!, apiKey: apiKey! };
    const client = new RedmineClient(context);
    const redmine = new Redmine(context);
    const me = await redmine.myAccount.show();
    const roles = await Array.fromAsync(redmine.role.list());
    await using cleanup = new AsyncDisposableStack();
    await redmine.membership.create(projectId, {
      userId: me.id,
      roleIds: [roles[0].id],
    });
    const membership = (await Array.fromAsync(
      redmine.membership.list(projectId),
    )).find((m) => m.user?.id === me.id)!;
    cleanup.defer(() => redmine.membership.delete(membership.id));
    const id = await createIssue(
      client,
      `denomine-mcp assign ${Date.now()}`,
      cleanup,
    );

    const shownAssignee = async () =>
      (Result.unwrap(await client.show(id)) as {
        assignedTo?: { id: number };
      }).assignedTo?.id;

    await t.step("update assigns the issue to a project member", async () => {
      const updated = await client.update(id, { assignedToId: me.id });
      expect(Result.isSuccess(updated), JSON.stringify(updated)).toBe(true);
      expect(await shownAssignee()).toBe(me.id);
    });

    await t.step("update with null unassigns it", async () => {
      const updated = await client.update(id, { assignedToId: null });
      expect(Result.isSuccess(updated), JSON.stringify(updated)).toBe(true);
      expect(await shownAssignee()).toBeUndefined();
    });
  },
});

Deno.test({
  name: "RedmineClient files an issue under a category against a live Redmine",
  ignore: endpoint == null || apiKey == null,
  sanitizeResources: false,
  fn: async (t) => {
    const context = { endpoint: endpoint!, apiKey: apiKey! };
    const client = new RedmineClient(context);
    const redmine = new Redmine(context);
    const name = `denomine-mcp category ${Date.now()}`;
    await using cleanup = new AsyncDisposableStack();
    await redmine.issueCategory.create(projectId, { name });
    const category = (await Array.fromAsync(
      redmine.issueCategory.list(projectId),
    )).find((c) => c.name === name)!;
    cleanup.defer(() => redmine.issueCategory.delete(category.id));
    const id = await createIssue(client, name, cleanup);

    const shownCategory = async () =>
      (Result.unwrap(await client.show(id)) as { category?: { id: number } })
        .category?.id;

    await t.step("update files the issue under the category", async () => {
      const updated = await client.update(id, { categoryId: category.id });
      expect(Result.isSuccess(updated), JSON.stringify(updated)).toBe(true);
      expect(await shownCategory()).toBe(category.id);
    });

    await t.step("update with null removes the category", async () => {
      const updated = await client.update(id, { categoryId: null });
      expect(Result.isSuccess(updated), JSON.stringify(updated)).toBe(true);
      expect(await shownCategory()).toBeUndefined();
    });
  },
});

Deno.test({
  name:
    "RedmineClient changes an issue's tracker and priority against a live Redmine",
  ignore: endpoint == null || apiKey == null,
  sanitizeResources: false,
  fn: async (t) => {
    const context = { endpoint: endpoint!, apiKey: apiKey! };
    const client = new RedmineClient(context);
    const redmine = new Redmine(context);
    await using cleanup = new AsyncDisposableStack();
    const id = await createIssue(
      client,
      `denomine-mcp tracker ${Date.now()}`,
      cleanup,
    );

    const shown = async () =>
      Result.unwrap(await client.show(id)) as {
        tracker: { id: number };
        priority: { id: number };
        status: { id: number };
      };

    const before = await shown();
    const tracker = (await Array.fromAsync(redmine.tracker.list()))
      .find((candidate) => candidate.id !== before.tracker.id)!;
    const priority =
      (await Array.fromAsync(redmine.enumeration.listIssuePriorities()))
        .find((candidate) => candidate.id !== before.priority.id)!;

    await t.step("update moves the issue to another tracker", async () => {
      const updated = await client.update(id, { trackerId: tracker.id });
      expect(Result.isSuccess(updated), JSON.stringify(updated)).toBe(true);
      expect((await shown()).tracker.id).toBe(tracker.id);
    });

    await t.step("update changes the priority", async () => {
      const updated = await client.update(id, { priorityId: priority.id });
      expect(Result.isSuccess(updated), JSON.stringify(updated)).toBe(true);
      expect((await shown()).priority.id).toBe(priority.id);
    });
  },
});

Deno.test({
  name: "RedmineClient edits and erases a comment against a live Redmine",
  ignore: endpoint == null || apiKey == null,
  sanitizeResources: false,
  fn: async (t) => {
    const client = new RedmineClient({ endpoint: endpoint!, apiKey: apiKey! });
    await using cleanup = new AsyncDisposableStack();
    const id = await createIssue(
      client,
      `denomine-mcp note ${Date.now()}`,
      cleanup,
    );

    const journals = async () =>
      (Result.unwrap(await client.show(id, ["journals"])) as {
        journals: { id: number; notes: string; privateNotes: boolean }[];
      }).journals;

    const added = await client.update(id, { notes: "first draft" });
    expect(Result.isSuccess(added), JSON.stringify(added)).toBe(true);
    const [{ id: journalId }] = await journals();

    await t.step("updateNote replaces the text", async () => {
      const updated = await client.updateNote(journalId, { notes: "final" });
      expect(Result.isSuccess(updated), JSON.stringify(updated)).toBe(true);
      expect((await journals()).find((j) => j.id === journalId)?.notes)
        .toBe("final");
    });

    await t.step("updateNote makes the comment private", async () => {
      const updated = await client.updateNote(journalId, {
        privateNotes: true,
      });
      expect(Result.isSuccess(updated), JSON.stringify(updated)).toBe(true);
      const journal = (await journals()).find((j) => j.id === journalId);
      expect(journal?.privateNotes).toBe(true);
      expect(journal?.notes).toBe("final");
    });

    await t.step("deleteNote removes the comment from show", async () => {
      const deleted = await client.deleteNote(journalId);
      expect(Result.isSuccess(deleted), JSON.stringify(deleted)).toBe(true);
      expect((await journals()).some((j) => j.id === journalId)).toBe(false);
    });
  },
});
