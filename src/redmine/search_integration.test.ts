import { assert } from "jsr:@std/assert@1.0.18";
import { Result } from "@praha/byethrow";
import { SearchClient } from "./search_client.ts";

function env(name: string): string | undefined {
  try {
    return Deno.env.get(name);
  } catch {
    return undefined;
  }
}

const endpoint = env("DENOMINE_TEST_ENDPOINT");
const apiKey = env("DENOMINE_TEST_API_KEY");
const query = env("DENOMINE_TEST_SEARCH_QUERY") ?? "a";

/**
 * Exercises the real `@omochice/redmine`-backed search client end to end against
 * a live Redmine (see doc/verification.md). Search is read-only, so it only
 * asserts the query resolves to an array; the corpus is whatever the instance
 * holds. Skipped unless the endpoint and API key are supplied.
 */
Deno.test({
  name: "SearchClient runs a search against a live Redmine",
  ignore: endpoint === undefined || apiKey === undefined,
  sanitizeResources: false,
  fn: async () => {
    const client = new SearchClient({ endpoint: endpoint!, apiKey: apiKey! });
    const result = await client.search({ q: query });
    assert(Result.isSuccess(result), JSON.stringify(result));
    assert(Array.isArray(Result.unwrap(result)));
  },
});
