import { expect } from "@std/expect";
import { installsOn, shippedNpmPackages } from "./npm.ts";
import type { NpmPackage } from "./npm.ts";

const darwinArm64 = { os: "darwin", cpu: "arm64" };

function pkg(name: string, version: string, dependencies: string[] = []) {
  return {
    name,
    version,
    dependencies,
    localPath: `/cache/${name}/${version}`,
  };
}

function names(packages: NpmPackage[]): string[] {
  return packages.map((found) => `${found.name}@${found.version}`).sort();
}

Deno.test("shippedNpmPackages follows dependencies transitively from the roots", () => {
  const packages = {
    "a@1.0.0": pkg("a", "1.0.0", ["b@2.0.0"]),
    "b@2.0.0": pkg("b", "2.0.0", ["c@3.0.0"]),
    "c@3.0.0": pkg("c", "3.0.0"),
    "unused@1.0.0": pkg("unused", "1.0.0"),
  };
  expect(names(shippedNpmPackages(["a@1.0.0"], packages, {}, darwinArm64)))
    .toStrictEqual(["a@1.0.0", "b@2.0.0", "c@3.0.0"]);
});

Deno.test("shippedNpmPackages lists a package once across peer-suffixed keys and cycles", () => {
  const packages = {
    "a@1.0.0_zod@4.0.0": pkg("a", "1.0.0", ["zod@4.0.0", "a@1.0.0"]),
    "a@1.0.0": pkg("a", "1.0.0", ["a@1.0.0_zod@4.0.0"]),
    "zod@4.0.0": pkg("zod", "4.0.0"),
  };
  expect(
    names(shippedNpmPackages(["a@1.0.0_zod@4.0.0"], packages, {}, darwinArm64)),
  ).toStrictEqual(["a@1.0.0", "zod@4.0.0"]);
});

Deno.test("shippedNpmPackages keeps only the platform package matching the target", () => {
  const packages = {
    "ts@7.0.2": pkg("ts", "7.0.2", [
      "ts-darwin-arm64@7.0.2",
      "ts-linux-x64@7.0.2",
    ]),
    "ts-darwin-arm64@7.0.2": pkg("ts-darwin-arm64", "7.0.2"),
    "ts-linux-x64@7.0.2": pkg("ts-linux-x64", "7.0.2", ["only-linux@1.0.0"]),
    "only-linux@1.0.0": pkg("only-linux", "1.0.0"),
  };
  const lock = {
    "ts-darwin-arm64@7.0.2": { os: ["darwin"], cpu: ["arm64"] },
    "ts-linux-x64@7.0.2": { os: ["linux"], cpu: ["x64"] },
  };
  expect(names(shippedNpmPackages(["ts@7.0.2"], packages, lock, darwinArm64)))
    .toStrictEqual(["ts-darwin-arm64@7.0.2", "ts@7.0.2"]);
});

Deno.test("shippedNpmPackages rejects a key absent from the graph", () => {
  expect(() => shippedNpmPackages(["ghost@1.0.0"], {}, {}, darwinArm64))
    .toThrow("ghost@1.0.0");
});

Deno.test("installsOn honours negated os and cpu entries", () => {
  expect(installsOn({ os: ["!win32"] }, darwinArm64)).toBe(true);
  expect(installsOn({ os: ["!darwin"] }, darwinArm64)).toBe(false);
  expect(installsOn({ cpu: ["x64"] }, darwinArm64)).toBe(false);
  expect(installsOn(undefined, darwinArm64)).toBe(true);
});
