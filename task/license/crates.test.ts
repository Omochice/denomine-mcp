import { expect } from "@std/expect";
import {
  orAlternatives,
  selectCrateLicenseFiles,
  shippedCrates,
} from "./crates.ts";

Deno.test("orAlternatives splits only top-level OR", () => {
  expect(orAlternatives("MIT OR Apache-2.0")).toStrictEqual([
    "MIT",
    "Apache-2.0",
  ]);
  expect(orAlternatives("Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT"))
    .toStrictEqual(["Apache-2.0 WITH LLVM-exception", "Apache-2.0", "MIT"]);
  expect(orAlternatives("(MIT OR Apache-2.0) AND Unicode-3.0"))
    .toStrictEqual(["(MIT OR Apache-2.0) AND Unicode-3.0"]);
  expect(orAlternatives("(MIT OR Apache-2.0)")).toStrictEqual([
    "MIT",
    "Apache-2.0",
  ]);
  expect(orAlternatives("MIT/Apache-2.0")).toStrictEqual(["MIT", "Apache-2.0"]);
});

Deno.test("selectCrateLicenseFiles keeps only the MIT text when MIT is an alternative", () => {
  expect(
    selectCrateLicenseFiles("Apache-2.0 OR MIT", [
      "LICENSE-APACHE",
      "LICENSE-MIT",
    ]),
  ).toStrictEqual(["LICENSE-MIT"]);
});

Deno.test("selectCrateLicenseFiles keeps notice and third-party files beside the MIT text", () => {
  expect(
    selectCrateLicenseFiles("MIT OR Apache-2.0", [
      "LICENSE-APACHE",
      "LICENSE-MIT",
      "LICENSE-THIRD-PARTY",
      "NOTICE",
    ]),
  ).toStrictEqual(["LICENSE-MIT", "LICENSE-THIRD-PARTY", "NOTICE"]);
});

Deno.test("selectCrateLicenseFiles keeps every file when MIT is not a top-level alternative", () => {
  expect(
    selectCrateLicenseFiles("(MIT OR Apache-2.0) AND Unicode-3.0", [
      "LICENSE-UNICODE",
      "LICENSE-MIT",
      "LICENSE-APACHE",
    ]),
  ).toStrictEqual(["LICENSE-APACHE", "LICENSE-MIT", "LICENSE-UNICODE"]);
});

Deno.test("selectCrateLicenseFiles keeps every file when there is no LICENSE-MIT", () => {
  expect(selectCrateLicenseFiles("MIT OR Apache-2.0", ["LICENSE"]))
    .toStrictEqual(["LICENSE"]);
  expect(selectCrateLicenseFiles(null, ["COPYRIGHT.txt"]))
    .toStrictEqual(["COPYRIGHT.txt"]);
});

Deno.test("shippedCrates keeps resolved crates other than keyring_ffi", () => {
  const crate = (id: string, name: string) => ({
    id,
    name,
    version: "1.0.0",
    license: "MIT",
    license_file: null,
    manifest_path: `/src/${name}/Cargo.toml`,
  });
  const metadata = {
    packages: [
      crate("own", "keyring_ffi"),
      crate("used", "libc"),
      crate("other-platform", "windows-sys"),
    ],
    resolve: { nodes: [{ id: "own" }, { id: "used" }] },
  };
  expect(shippedCrates(metadata).map((found) => found.name)).toStrictEqual([
    "libc",
  ]);
});
