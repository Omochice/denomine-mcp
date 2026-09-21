import { expect } from "jsr:@std/expect@1.0.20";
import { Result } from "@praha/byethrow";
import { WikiClient } from "./wiki-client.ts";
import type { ProjectRef } from "./port.ts";

/** Reads a variable, treating a blank one as absent the way a shell means it. */
function env(name: string): string | undefined {
  try {
    return Deno.env.get(name)?.trim() || undefined;
  } catch {
    return undefined;
  }
}

const endpoint = env("DENOMINE_TEST_ENDPOINT");
const apiKey = env("DENOMINE_TEST_API_KEY");
const projectId = Number(env("DENOMINE_TEST_PROJECT_ID") ?? "1");
const projectIdentifier = env("DENOMINE_TEST_PROJECT_IDENTIFIER");

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
      expect(Result.isSuccess(result), JSON.stringify(result)).toBe(true);
    });

    const expectShown = async (project: ProjectRef) => {
      const result = await client.show(project, title);
      expect(Result.isSuccess(result), JSON.stringify(result)).toBe(true);
      expect((Result.unwrap(result) as { title: string }).title).toBe(title);
    };

    await t.step("show returns the page", () => expectShown(projectId));

    await t.step({
      name: "show resolves the page through the project identifier",
      ignore: projectIdentifier === undefined,
      fn: () => expectShown(projectIdentifier!),
    });

    await t.step("update changes the text", async () => {
      const updated = await client.update(projectId, {
        title,
        text: "edited by the wiki integration test",
      });
      expect(Result.isSuccess(updated), JSON.stringify(updated)).toBe(true);
      const shown = await client.show(projectId, title);
      expect(Result.isSuccess(shown)).toBe(true);
      expect((Result.unwrap(shown) as { text: string }).text).toBe(
        "edited by the wiki integration test",
      );
    });

    await t.step("delete removes the page", async () => {
      const deleted = await client.delete(projectId, title);
      expect(Result.isSuccess(deleted), JSON.stringify(deleted)).toBe(true);
      const shown = await client.show(projectId, title);
      expect(Result.isFailure(shown), "page should be gone after delete")
        .toBe(true);
    });
  },
});
