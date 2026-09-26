import { expect } from "@std/expect";
import { jsrLicensePaths } from "./jsr.ts";

Deno.test("jsrLicensePaths picks top-level license files from a manifest", () => {
  expect(
    jsrLicensePaths([
      "/mod.ts",
      "/LICENSE",
      "/NOTICE.md",
      "/src/LICENSE",
      "/README.md",
    ]),
  ).toStrictEqual(["/LICENSE", "/NOTICE.md"]);
});
