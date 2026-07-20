import { assert, assertEquals } from "jsr:@std/assert@1.0.18";
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
      assert(Result.isSuccess(result), JSON.stringify(result));
    });

    await t.step("list finds the created issue", async () => {
      const result = await client.list({ projectId });
      assert(Result.isSuccess(result));
      const issues = Result.unwrap(result) as { id: number; subject: string }[];
      const found = issues.find((issue) => issue.subject === subject);
      assert(found !== undefined, "created issue not found in list");
      id = found.id;
    });

    await t.step("show returns the issue", async () => {
      const result = await client.show(id);
      assert(Result.isSuccess(result));
      assertEquals(
        (Result.unwrap(result) as { subject: string }).subject,
        subject,
      );
    });

    await t.step("update changes the subject", async () => {
      const updated = await client.update(id, {
        subject: `${subject} (edited)`,
      });
      assert(Result.isSuccess(updated), JSON.stringify(updated));
      const shown = await client.show(id);
      assert(Result.isSuccess(shown));
      assertEquals(
        (Result.unwrap(shown) as { subject: string }).subject,
        `${subject} (edited)`,
      );
    });

    await t.step("delete removes the issue", async () => {
      const deleted = await client.delete(id);
      assert(Result.isSuccess(deleted), JSON.stringify(deleted));
      const shown = await client.show(id);
      assert(Result.isFailure(shown), "issue should be gone after delete");
    });
  },
});
