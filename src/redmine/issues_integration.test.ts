import { expect } from "jsr:@std/expect@1.0.20";
import { Result } from "@praha/byethrow";
import { RedmineClient } from "./client.ts";

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
