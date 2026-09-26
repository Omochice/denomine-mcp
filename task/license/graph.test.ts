import { expect } from "@std/expect";
import { type DenoInfo, graphErrors, jsrPackages, npmRoots } from "./graph.ts";

function info(modules: DenoInfo["modules"]): DenoInfo {
  return {
    roots: ["file:///main.ts"],
    modules,
    redirects: {
      "jsr:@a/b@1.0.0": "https://jsr.io/@a/b/1.0.0/mod.ts",
    },
    npmPackages: {},
  };
}

Deno.test("graphErrors reports a failed module imported as code", () => {
  const graph = info([
    {
      specifier: "file:///main.ts",
      dependencies: [{ code: { specifier: "jsr:@a/b@1.0.0" } }],
    },
    { specifier: "https://jsr.io/@a/b/1.0.0/mod.ts", error: "not found" },
  ]);
  expect(graphErrors(graph)).toStrictEqual([
    "https://jsr.io/@a/b/1.0.0/mod.ts: not found",
  ]);
});

Deno.test("graphErrors ignores a failed module reached only through a type import", () => {
  const graph = info([
    { specifier: "file:///main.ts", dependencies: [{}] },
    { specifier: "https://jsr.io/@valibot/library/src/index.ts", error: "404" },
  ]);
  expect(graphErrors(graph)).toStrictEqual([]);
});

Deno.test("graphErrors reports an import that did not resolve", () => {
  const graph = info([
    {
      specifier: "file:///main.ts",
      dependencies: [{ code: { error: "unknown package" } }],
    },
  ]);
  expect(graphErrors(graph)).toStrictEqual([
    "file:///main.ts: unknown package",
  ]);
});

Deno.test("jsrPackages groups modules by package version and skips failed ones", () => {
  const graph = info([
    { specifier: "https://jsr.io/@std/text/1.0.19/mod.ts" },
    { specifier: "https://jsr.io/@std/text/1.0.19/closest_string.ts" },
    { specifier: "https://jsr.io/@std/io/0.225.3/types.ts" },
    { specifier: "https://jsr.io/@valibot/library/src/index.ts", error: "404" },
    { specifier: "https://deno.land/x/other/mod.ts" },
  ]);
  expect(jsrPackages(graph)).toStrictEqual([
    { name: "@std/text", version: "1.0.19" },
    { name: "@std/io", version: "0.225.3" },
  ]);
});

Deno.test("jsrPackages rejects a loaded module without a version segment", () => {
  const graph = info([{ specifier: "https://jsr.io/@a/b/src/index.ts" }]);
  expect(() => jsrPackages(graph)).toThrow("@a/b/src/index.ts");
});

Deno.test("npmRoots lists each directly imported npm package once", () => {
  const graph = info([
    { specifier: "npm:/x@1.0.0/a.js", kind: "npm", npmPackage: "x@1.0.0" },
    { specifier: "npm:/x@1.0.0/b.js", kind: "npm", npmPackage: "x@1.0.0" },
    { specifier: "file:///main.ts", kind: "esm" },
  ]);
  expect(npmRoots(graph)).toStrictEqual(["x@1.0.0"]);
});
