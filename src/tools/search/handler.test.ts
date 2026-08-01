import { expect } from "jsr:@std/expect@1.0.20";
import { FakeSearchPort, type SearchDoc } from "../../redmine/fake.ts";
import { handleSearch } from "./handler.ts";

function textOf(response: { content: { text: string }[] }): string {
  return response.content[0].text;
}

const corpus: SearchDoc[] = [
  { id: 1, title: "login fails", type: "issue", url: "/issues/1" },
  { id: 2, title: "login guide", type: "wiki-page", url: "/wiki/login" },
  { id: 3, title: "logout works", type: "issue", url: "/issues/3" },
];

Deno.test("search handler returns every document matching the query", async () => {
  const port = new FakeSearchPort(corpus);
  const response = await handleSearch(port, { action: "search", q: "login" });
  const results = JSON.parse(textOf(response)) as { id: number }[];
  expect(results.map((result) => result.id)).toStrictEqual([1, 2]);
});

Deno.test("search handler restricts to the requested resource type", async () => {
  const port = new FakeSearchPort(corpus);
  const response = await handleSearch(port, {
    action: "search",
    q: "login",
    issues: true,
  });
  const results = JSON.parse(textOf(response)) as { id: number }[];
  expect(results.map((result) => result.id)).toStrictEqual([1]);
});

Deno.test("search handler surfaces a blank query as isError", async () => {
  const port = new FakeSearchPort(corpus);
  const response = await handleSearch(port, { action: "search", q: "   " });
  expect(response.isError).toBe(true);
});
