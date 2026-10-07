import { expect } from "@std/expect";
import { Result } from "@praha/byethrow";
import { fromFileUrl } from "@std/path";
import { LocalFile } from "./local.ts";

const sample = fromFileUrl(new URL("./testdata/sample.txt", import.meta.url));

Deno.test("LocalFile opens a file with its name, size, and content", async () => {
  const opened = await new LocalFile().open(sample);
  expect(Result.isSuccess(opened)).toBe(true);
  await using content = Result.unwrap(opened);
  expect(content.filename).toBe("sample.txt");
  expect(content.size).toBe(19);
  expect(await new Response(content.body).text()).toBe("local file content\n");
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

Deno.test("LocalFile closes a file that is disposed without being read", async () => {
  const opened = await new LocalFile().open(sample);
  expect(Result.isSuccess(opened)).toBe(true);
  const content = Result.unwrap(opened);
  await content[Symbol.asyncDispose]();
  expect(await content.body.getReader().read()).toStrictEqual({
    done: true,
    value: undefined,
  });
});
