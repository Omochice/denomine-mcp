import { expect } from "jsr:@std/expect@1.0.20";
import { Result } from "@praha/byethrow";
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
): Promise<number> {
  const created = await versions.create(projectId, { name });
  expect(Result.isSuccess(created), JSON.stringify(created)).toBe(true);
  const listed = Result.unwrap(await versions.list(projectId)) as {
    id: number;
    name: string;
  }[];
  return listed.find((version) => version.name === name)!.id;
}

/**
 * Exercises the real `@omochice/redmine`-backed client end to end against a live
 * Redmine (see doc/verification.md). Skipped unless the endpoint and API key are
 * supplied, so the suite stays runnable without a running instance.
 */
Deno.test({
  name: "RedmineClient runs issue CRUD against a live Redmine",
  ignore: endpoint === undefined || apiKey === undefined,
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
  ignore: endpoint === undefined || apiKey === undefined,
  sanitizeResources: false,
  fn: async () => {
    const context = { endpoint: endpoint!, apiKey: apiKey! };
    const client = new RedmineClient(context);
    const versions = new VersionClient(context);
    const name = `denomine-mcp ${Date.now()}`;

    const fixedVersionId = await createVersion(versions, name);

    const issuesInVersion = async () =>
      Result.unwrap(await client.list({ projectId, fixedVersionId })) as {
        id: number;
        subject: string;
      }[];

    try {
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
    } finally {
      for (const issue of await issuesInVersion()) {
        await client.delete(issue.id);
      }
      await versions.delete(fixedVersionId);
    }
  },
});
