import { assert, assertEquals } from "jsr:@std/assert@1.0.18";
import { Result } from "@praha/byethrow";
import { VersionClient } from "./version_client.ts";

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
 * Exercises the real `@omochice/redmine`-backed version client end to end
 * against a live Redmine (see doc/verification.md). Skipped unless the endpoint
 * and API key are supplied.
 */
Deno.test({
  name: "VersionClient runs version CRUD against a live Redmine",
  ignore: endpoint === undefined || apiKey === undefined,
  sanitizeResources: false,
  fn: async (t) => {
    const client = new VersionClient({ endpoint: endpoint!, apiKey: apiKey! });
    const name = `denomine-mcp ${Date.now()}`;
    let id = 0;

    await t.step("create", async () => {
      const result = await client.create(projectId, {
        name,
        status: "open",
      });
      assert(Result.isSuccess(result), JSON.stringify(result));
    });

    await t.step("list finds the created version", async () => {
      const result = await client.list(projectId);
      assert(Result.isSuccess(result));
      const versions = Result.unwrap(result) as { id: number; name: string }[];
      const found = versions.find((version) => version.name === name);
      assert(found !== undefined, "created version not found in list");
      id = found.id;
    });

    await t.step("show returns the version", async () => {
      const result = await client.show(id);
      assert(Result.isSuccess(result));
      assertEquals((Result.unwrap(result) as { name: string }).name, name);
    });

    await t.step("update changes the status", async () => {
      const updated = await client.update(id, { status: "closed" });
      assert(Result.isSuccess(updated), JSON.stringify(updated));
      const shown = await client.show(id);
      assert(Result.isSuccess(shown));
      assertEquals(
        (Result.unwrap(shown) as { status: string }).status,
        "closed",
      );
    });

    await t.step("delete removes the version", async () => {
      const deleted = await client.delete(id);
      assert(Result.isSuccess(deleted), JSON.stringify(deleted));
      const shown = await client.show(id);
      assert(Result.isFailure(shown), "version should be gone after delete");
    });
  },
});
