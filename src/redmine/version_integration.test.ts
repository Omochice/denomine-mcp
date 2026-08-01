import { expect } from "jsr:@std/expect@1.0.20";
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
      expect(Result.isSuccess(result), JSON.stringify(result)).toBe(true);
    });

    await t.step("list finds the created version", async () => {
      const result = await client.list(projectId);
      expect(Result.isSuccess(result)).toBe(true);
      const versions = Result.unwrap(result) as { id: number; name: string }[];
      const found = versions.find((version) => version.name === name);
      expect(found, "created version not found in list").toBeDefined();
      id = found!.id;
    });

    await t.step("show returns the version", async () => {
      const result = await client.show(id);
      expect(Result.isSuccess(result)).toBe(true);
      expect((Result.unwrap(result) as { name: string }).name).toBe(name);
    });

    await t.step("update changes the status", async () => {
      const updated = await client.update(id, { status: "closed" });
      expect(Result.isSuccess(updated), JSON.stringify(updated)).toBe(true);
      const shown = await client.show(id);
      expect(Result.isSuccess(shown)).toBe(true);
      expect((Result.unwrap(shown) as { status: string }).status).toBe(
        "closed",
      );
    });

    await t.step("delete removes the version", async () => {
      const deleted = await client.delete(id);
      expect(Result.isSuccess(deleted), JSON.stringify(deleted)).toBe(true);
      const shown = await client.show(id);
      expect(Result.isFailure(shown), "version should be gone after delete")
        .toBe(true);
    });
  },
});
