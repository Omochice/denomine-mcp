import { expect } from "@std/expect";
import plugin from "./eqeqeq.ts";

function fixed(source: string): string[] {
  return Deno.lint.runPlugin(plugin, "sample.ts", source).map((diagnostic) => {
    let output = source;
    const edits = [...(diagnostic.fix ?? [])].sort((a, b) =>
      b.range[0] - a.range[0]
    );
    for (const edit of edits) {
      output = output.slice(0, edit.range[0]) + (edit.text ?? "") +
        output.slice(edit.range[1]);
    }
    return output;
  });
}

Deno.test("eqeqeq rewrites strict comparisons with null or undefined to == null", () => {
  expect(fixed("a === null;")).toStrictEqual(["a == null;"]);
  expect(fixed("a !== undefined;")).toStrictEqual(["a != null;"]);
  expect(fixed("undefined === a;")).toStrictEqual(["null == a;"]);
});

Deno.test("eqeqeq rewrites a loose comparison with undefined", () => {
  expect(fixed("a == undefined;")).toStrictEqual(["a == null;"]);
});

Deno.test("eqeqeq rewrites a loose comparison with anything but null to a strict one", () => {
  expect(fixed("a == 0;")).toStrictEqual(["a === 0;"]);
  expect(fixed('"x" != b;')).toStrictEqual(['"x" !== b;']);
});

Deno.test("eqeqeq accepts == null and strict comparisons with other values", () => {
  expect(fixed("a == null; b != null; c === 0; d !== e;")).toStrictEqual([]);
});
