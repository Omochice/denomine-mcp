import { expect } from "jsr:@std/expect@1.0.20";
import { RedmineResponseError } from "@omochice/redmine/error";
import { toRedmineError } from "./error.ts";

Deno.test("toRedmineError extracts the status and Redmine errors array", () => {
  const error = new RedmineResponseError(
    422,
    "Unprocessable Entity",
    JSON.stringify({
      errors: ["Subject cannot be blank", "Tracker is invalid"],
    }),
  );
  expect(toRedmineError(error)).toStrictEqual({
    status: 422,
    errors: ["Subject cannot be blank", "Tracker is invalid"],
  });
});

Deno.test("toRedmineError yields status only when the body has no errors array", async (t) => {
  await t.step("empty body (e.g. 404)", () => {
    const error = new RedmineResponseError(404, "Not Found", "");
    expect(toRedmineError(error)).toStrictEqual({ status: 404, errors: [] });
  });

  await t.step("non-JSON body", () => {
    const error = new RedmineResponseError(
      500,
      "Internal Server Error",
      "<html>nope</html>",
    );
    expect(toRedmineError(error)).toStrictEqual({ status: 500, errors: [] });
  });

  await t.step("JSON body without an errors array", () => {
    const error = new RedmineResponseError(
      403,
      "Forbidden",
      JSON.stringify({ message: "denied" }),
    );
    expect(toRedmineError(error)).toStrictEqual({ status: 403, errors: [] });
  });
});

Deno.test("toRedmineError discloses only status and errors, never other fields", () => {
  const error = new RedmineResponseError(
    422,
    "Unprocessable Entity",
    JSON.stringify({ errors: ["bad"] }),
  );
  const result = toRedmineError(error);
  expect(Object.keys(result).sort()).toStrictEqual(["errors", "status"]);
});

Deno.test("toRedmineError falls back to the message for a non-response error", () => {
  expect(toRedmineError(new Error("connection refused"))).toStrictEqual({
    status: 0,
    errors: ["connection refused"],
  });
});

Deno.test("toRedmineError stringifies a thrown non-Error value", () => {
  expect(toRedmineError("boom")).toStrictEqual({ status: 0, errors: ["boom"] });
});
