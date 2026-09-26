const LOOSE: Record<string, string> = {
  "===": "==",
  "!==": "!=",
  "==": "==",
  "!=": "!=",
};

const STRICT: Record<string, string> = {
  "===": "===",
  "!==": "!==",
  "==": "===",
  "!=": "!==",
};

function isNull(node: Deno.lint.Node): boolean {
  return node.type === "Literal" && node.raw === "null";
}

function isUndefined(node: Deno.lint.Node): boolean {
  return node.type === "Identifier" && node.name === "undefined";
}

function isNullish(node: Deno.lint.Node): boolean {
  return isNull(node) || isUndefined(node);
}

function message(operator: string, nullish: Deno.lint.Node | undefined) {
  if (nullish == null) {
    return `Compare with \`${operator}\` instead.`;
  }
  return `Compare with \`${operator} null\` instead.`;
}

/**
 * A lint plugin whose `eqeqeq` rule requires `===` and `!==`, except that
 * nullish checks must be `== null` and `!= null`, so that `null` and
 * `undefined` are never told apart by accident. Code that does mean to tell
 * them apart says so with a `deno-lint-ignore` comment.
 *
 * Deno's built-in `eqeqeq` has no option to allow `== null`.
 */
const plugin: Deno.lint.Plugin = {
  name: "local",
  rules: {
    "eqeqeq": {
      create(context) {
        return {
          BinaryExpression(node) {
            const loose = LOOSE[node.operator];
            if (loose == null) {
              return;
            }
            const nullish = [node.left, node.right].find(isNullish);
            const operator = nullish == null ? STRICT[node.operator] : loose;
            const nullSpelled = nullish == null || isNull(nullish);
            if (operator === node.operator && nullSpelled) {
              return;
            }
            context.report({
              node,
              message: message(operator, nullish),
              fix(fixer) {
                const side = (operand: Deno.lint.Node) =>
                  operand === nullish
                    ? "null"
                    : context.sourceCode.getText(operand);
                return fixer.replaceText(
                  node,
                  `${side(node.left)} ${operator} ${side(node.right)}`,
                );
              },
            });
          },
        };
      },
    },
  },
};

export default plugin;
