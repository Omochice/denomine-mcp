import { assert, assertEquals } from "jsr:@std/assert@1.0.18";
import { Result } from "@praha/byethrow";
import { WikiClient } from "./wiki_client.ts";

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
 * Exercises the real `@omochice/redmine`-backed wiki client end to end against a
 * live Redmine (see doc/verification.md). Skipped unless the endpoint and API
 * key are supplied. Requires the project's wiki module to be enabled.
 */
Deno.test({
  name: "WikiClient runs wiki-page CRUD against a live Redmine",
  ignore: endpoint === undefined || apiKey === undefined,
  sanitizeResources: false,
  fn: async (t) => {
    const client = new WikiClient({ endpoint: endpoint!, apiKey: apiKey! });
    const title = `DenomineMcp_${Date.now()}`;

    await t.step("create", async () => {
      const result = await client.create(projectId, {
        title,
        text: "created by the wiki integration test",
      });
      assert(Result.isSuccess(result), JSON.stringify(result));
    });

    await t.step("show returns the page", async () => {
      const result = await client.show(projectId, title);
      assert(Result.isSuccess(result), JSON.stringify(result));
      assertEquals((Result.unwrap(result) as { title: string }).title, title);
    });

    await t.step("update changes the text", async () => {
      const updated = await client.update(projectId, {
        title,
        text: "edited by the wiki integration test",
      });
      assert(Result.isSuccess(updated), JSON.stringify(updated));
      const shown = await client.show(projectId, title);
      assert(Result.isSuccess(shown));
      assertEquals(
        (Result.unwrap(shown) as { text: string }).text,
        "edited by the wiki integration test",
      );
    });

    await t.step("delete removes the page", async () => {
      const deleted = await client.delete(projectId, title);
      assert(Result.isSuccess(deleted), JSON.stringify(deleted));
      const shown = await client.show(projectId, title);
      assert(Result.isFailure(shown), "page should be gone after delete");
    });
  },
});
