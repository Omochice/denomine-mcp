import { expect } from "@std/expect";
import { formatNotices } from "./format.ts";

Deno.test("formatNotices prints each package header followed by its full texts", () => {
  const output = formatNotices([
    {
      name: "@cliffy/command",
      version: "1.3.1",
      source: "jsr",
      texts: [{ file: "LICENSE", content: "MIT License\nCopyright A\n" }],
    },
    {
      name: "typescript",
      version: "7.0.2",
      source: "npm",
      texts: [
        { file: "LICENSE", content: "Apache License" },
        { file: "NOTICE.txt", content: "Notices" },
      ],
    },
  ]);
  const rule = "=".repeat(80);
  expect(output).toBe(
    [
      rule,
      "@cliffy/command 1.3.1",
      rule,
      "--- LICENSE ---",
      "MIT License\nCopyright A",
      "",
      rule,
      "typescript 7.0.2",
      rule,
      "--- LICENSE ---",
      "Apache License",
      "--- NOTICE.txt ---",
      "Notices",
    ].join("\n"),
  );
});
