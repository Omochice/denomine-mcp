import { assert, assertEquals } from "jsr:@std/assert@1.0.18";
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
      assert(result.ok, JSON.stringify(result));
    });

    await t.step("list finds the created version", async () => {
      const result = await client.list(projectId);
      assert(result.ok);
      const versions = result.value as { id: number; name: string }[];
      const found = versions.find((version) => version.name === name);
      assert(found !== undefined, "created version not found in list");
      id = found.id;
    });

    await t.step("show returns the version", async () => {
      const result = await client.show(id);
      assert(result.ok);
      assertEquals((result.value as { name: string }).name, name);
    });

    await t.step("update changes the status", async () => {
      const updated = await client.update(id, { status: "closed" });
      assert(updated.ok, JSON.stringify(updated));
      const shown = await client.show(id);
      assert(shown.ok);
      assertEquals((shown.value as { status: string }).status, "closed");
    });

    await t.step("delete removes the version", async () => {
      const deleted = await client.delete(id);
      assert(deleted.ok, JSON.stringify(deleted));
      const shown = await client.show(id);
      assert(!shown.ok, "version should be gone after delete");
    });
  },
});
