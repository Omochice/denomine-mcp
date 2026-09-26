import { expect } from "@std/expect";
import { readNotices } from "./embedded.ts";

Deno.test("readNotices names the generating task when the file is missing", async () => {
  await expect(
    readNotices(new URL("./does-not-exist.json", import.meta.url)),
  ).rejects.toThrow("deno task license");
});
