import { expect } from "@std/expect";
import { readBuildInfo } from "./info.ts";

Deno.test("readBuildInfo returns the commit a compiled binary was built from", async () => {
  expect(
    await readBuildInfo(new URL("./testdata/build-info.json", import.meta.url)),
  ).toStrictEqual({
    commit: "0123456789abcdef0123456789abcdef01234567",
    dirty: false,
  });
});

Deno.test("readBuildInfo reports no build info when running from source", async () => {
  expect(
    await readBuildInfo(new URL("./does-not-exist.json", import.meta.url)),
  ).toBeUndefined();
});
