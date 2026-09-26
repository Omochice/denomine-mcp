import { expect } from "@std/expect";
import { npmPlatform } from "./target.ts";

Deno.test("npmPlatform maps the distributed targets to npm platform names", () => {
  expect(npmPlatform("aarch64-apple-darwin")).toStrictEqual({
    os: "darwin",
    cpu: "arm64",
  });
  expect(npmPlatform("x86_64-unknown-linux-gnu")).toStrictEqual({
    os: "linux",
    cpu: "x64",
  });
  expect(npmPlatform("x86_64-pc-windows-msvc")).toStrictEqual({
    os: "win32",
    cpu: "x64",
  });
});

Deno.test("npmPlatform rejects an unmapped triple", () => {
  expect(() => npmPlatform("riscv64gc-unknown-linux-gnu")).toThrow();
});
