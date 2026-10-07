import { expect } from "@std/expect";
import { Result } from "@praha/byethrow";
import { fromFileUrl } from "@std/path";
import { LocalFile } from "./local.ts";

const sample = fromFileUrl(new URL("./testdata/sample.txt", import.meta.url));

Deno.test("LocalFile opens a file with its name, size, and content", async () => {
  const opened = await new LocalFile().open(sample);
  expect(Result.isSuccess(opened)).toBe(true);
  const { body, ...metadata } = Result.unwrap(opened);
  expect(metadata).toStrictEqual({ filename: "sample.txt", size: 19 });
  expect(await new Response(body).text()).toBe("local file content\n");
});

Deno.test("LocalFile refuses to open a directory", async () => {
  const opened = await new LocalFile().open(
    fromFileUrl(new URL("./testdata", import.meta.url)),
  );
  expect(Result.isFailure(opened)).toBe(true);
});

Deno.test("LocalFile reports a path that does not exist", async () => {
  const opened = await new LocalFile().open(
    fromFileUrl(new URL("./testdata/missing.txt", import.meta.url)),
  );
  expect(Result.isFailure(opened)).toBe(true);
});
