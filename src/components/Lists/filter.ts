// The filter dialect used by ListView.filter, ItemQuery.filter and field
// validation rules. Deliberately small and OData-flavoured:
//
//   Status eq 'Active'
//   Priority ge 2 and not (Owner eq null)
//   contains(Title, 'invoice') or Title startswith 'INV'
//
// Operators: eq ne gt ge lt le contains startswith endswith
// Combinators: and or not, with parentheses.
// Literals: 'quoted string' (double '' to escape), number, true, false, null.
//
// Text comparisons are case-insensitive. Multi-value fields (arrays) match when
// any element matches, so `Tags eq 'urgent'` behaves like "has tag".

import type { FieldDefinition, FieldId, ListItem } from "../../types/lists";

export class FilterError extends Error {}

type CompareOp = "eq" | "ne" | "gt" | "ge" | "lt" | "le" | "contains" | "startswith" | "endswith";

const COMPARE_OPS: CompareOp[] = ["eq", "ne", "gt", "ge", "lt", "le", "contains", "startswith", "endswith"];
const FUNCTION_OPS: CompareOp[] = ["contains", "startswith", "endswith"];

type Literal = string | number | boolean | null;

type Node =
  | { kind: "and"; left: Node; right: Node }
  | { kind: "or"; left: Node; right: Node }
  | { kind: "not"; operand: Node }
  | { kind: "compare"; fieldId: FieldId; op: CompareOp; value: Literal };

/* ── Tokenizer ─────────────────────────────────────────────────────────── */

type Token =
  | { type: "ident"; value: string }
  | { type: "string"; value: string }
  | { type: "number"; value: number }
  | { type: "punct"; value: "(" | ")" | "," };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    if (ch === "(" || ch === ")" || ch === ",") {
      tokens.push({ type: "punct", value: ch });
      i += 1;
      continue;
    }

    if (ch === "'") {
      let value = "";
      i += 1;
      for (;;) {
        if (i >= input.length) throw new FilterError("Unterminated string literal");
        if (input[i] === "'") {
          if (input[i + 1] === "'") {
            value += "'";
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        value += input[i];
        i += 1;
      }
      tokens.push({ type: "string", value });
      continue;
    }

    const numberMatch = /^-?\d+(\.\d+)?/.exec(input.slice(i));
    if (numberMatch && (/\d/.test(ch) || (ch === "-" && /\d/.test(input[i + 1] ?? "")))) {
      tokens.push({ type: "number", value: Number(numberMatch[0]) });
      i += numberMatch[0].length;
      continue;
    }

    const identMatch = /^[A-Za-z_][A-Za-z0-9_]*/.exec(input.slice(i));
    if (identMatch) {
      tokens.push({ type: "ident", value: identMatch[0] });
      i += identMatch[0].length;
      continue;
    }

    throw new FilterError(`Unexpected character ${JSON.stringify(ch)} at position ${i}`);
  }

  return tokens;
}

/* ── Parser (recursive descent: or → and → not → primary) ──────────────── */

function parseTokens(tokens: Token[]): Node {
  let pos = 0;

  const peek = (): Token | undefined => tokens[pos];
  const isKeyword = (word: string): boolean => {
    const token = peek();
    return !!token && token.type === "ident" && token.value.toLowerCase() === word;
  };
  const expectPunct = (value: "(" | ")" | ",") => {
    const token = peek();
    if (!token || token.type !== "punct" || token.value !== value) {
      throw new FilterError(`Expected ${JSON.stringify(value)}`);
    }
    pos += 1;
  };

  const parseLiteral = (): Literal => {
    const token = peek();
    if (!token) throw new FilterError("Expected a value");
    pos += 1;

    if (token.type === "string") return token.value;
    if (token.type === "number") return token.value;
    if (token.type === "ident") {
      const lowered = token.value.toLowerCase();
      if (lowered === "true") return true;
      if (lowered === "false") return false;
      if (lowered === "null") return null;
      // A bare word is treated as text so `Status eq Active` still works.
      return token.value;
    }
    throw new FilterError("Expected a value");
  };

  const parseOr = (): Node => {
    let left = parseAnd();
    while (isKeyword("or")) {
      pos += 1;
      left = { kind: "or", left, right: parseAnd() };
    }
    return left;
  };

  const parseAnd = (): Node => {
    let left = parseNot();
    while (isKeyword("and")) {
      pos += 1;
      left = { kind: "and", left, right: parseNot() };
    }
    return left;
  };

  const parseNot = (): Node => {
    if (isKeyword("not")) {
      pos += 1;
      return { kind: "not", operand: parseNot() };
    }
    return parsePrimary();
  };

  const parsePrimary = (): Node => {
    const token = peek();
    if (!token) throw new FilterError("Unexpected end of expression");

    if (token.type === "punct" && token.value === "(") {
      pos += 1;
      const inner = parseOr();
      expectPunct(")");
      return inner;
    }

    if (token.type !== "ident") throw new FilterError("Expected a field name");

    // Function form: contains(Field, 'value')
    const lowered = token.value.toLowerCase() as CompareOp;
    const next = tokens[pos + 1];
    if (FUNCTION_OPS.includes(lowered) && next && next.type === "punct" && next.value === "(") {
      pos += 2;
      const fieldToken = peek();
      if (!fieldToken || fieldToken.type !== "ident") throw new FilterError(`Expected a field name inside ${lowered}()`);
      pos += 1;
      expectPunct(",");
      const value = parseLiteral();
      expectPunct(")");
      return { kind: "compare", fieldId: fieldToken.value, op: lowered, value };
    }

    // Infix form: Field op value
    pos += 1;
    const opToken = peek();
    if (!opToken || opToken.type !== "ident") throw new FilterError(`Expected an operator after ${token.value}`);
    const op = opToken.value.toLowerCase() as CompareOp;
    if (!COMPARE_OPS.includes(op)) throw new FilterError(`Unknown operator ${JSON.stringify(opToken.value)}`);
    pos += 1;

    return { kind: "compare", fieldId: token.value, op, value: parseLiteral() };
  };

  const node = parseOr();
  if (pos !== tokens.length) throw new FilterError("Unexpected trailing input");
  return node;
}

const parseCache = new Map<string, Node>();

export function parseFilter(expression: string): Node {
  const trimmed = expression.trim();
  const cached = parseCache.get(trimmed);
  if (cached) return cached;

  const node = parseTokens(tokenize(trimmed));
  parseCache.set(trimmed, node);
  return node;
}

/** Validate a filter without running it. Returns null when valid. */
export function validateFilter(expression: string): string | null {
  if (!expression.trim()) return null;
  try {
    parseFilter(expression);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid filter";
  }
}

/* ── Evaluation ────────────────────────────────────────────────────────── */

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

/** -1 / 0 / 1, or null when the pair isn't meaningfully ordered. */
function compareScalar(left: unknown, right: unknown): number | null {
  if (left === null || left === undefined || right === null || right === undefined) return null;
  if (typeof left === "number" && typeof right === "number") return left < right ? -1 : left > right ? 1 : 0;
  if (typeof left === "boolean" && typeof right === "boolean") return left === right ? 0 : left ? 1 : -1;

  // Dates are stored ISO, which sorts correctly as text.
  const a = normalizeText(left).toLowerCase();
  const b = normalizeText(right).toLowerCase();
  return a < b ? -1 : a > b ? 1 : 0;
}

function matchesScalar(actual: unknown, op: CompareOp, expected: Literal): boolean {
  switch (op) {
    case "eq":
    case "ne": {
      const bothEmpty = (actual === null || actual === undefined || actual === "") && expected === null;
      const equal = bothEmpty || compareScalar(actual, expected) === 0;
      return op === "eq" ? equal : !equal;
    }
    case "contains":
      return normalizeText(actual).toLowerCase().includes(normalizeText(expected).toLowerCase());
    case "startswith":
      return normalizeText(actual).toLowerCase().startsWith(normalizeText(expected).toLowerCase());
    case "endswith":
      return normalizeText(actual).toLowerCase().endsWith(normalizeText(expected).toLowerCase());
    default: {
      const ordering = compareScalar(actual, expected);
      if (ordering === null) return false;
      if (op === "gt") return ordering > 0;
      if (op === "ge") return ordering >= 0;
      if (op === "lt") return ordering < 0;
      return ordering <= 0;
    }
  }
}

function evaluateNode(node: Node, item: ListItem): boolean {
  if (node.kind === "and") return evaluateNode(node.left, item) && evaluateNode(node.right, item);
  if (node.kind === "or") return evaluateNode(node.left, item) || evaluateNode(node.right, item);
  if (node.kind === "not") return !evaluateNode(node.operand, item);

  const actual = node.fieldId === "Id" ? item.id : item.values[node.fieldId];

  if (Array.isArray(actual)) {
    // `ne` over a multi-value field means "no element matches".
    if (node.op === "ne") return !actual.some((entry) => matchesScalar(entry, "eq", node.value));
    if (!actual.length) return matchesScalar(null, node.op, node.value);
    return actual.some((entry) => matchesScalar(entry, node.op, node.value));
  }

  return matchesScalar(actual, node.op, node.value);
}

/** Throws FilterError when the expression doesn't parse. */
export function evaluateFilter(expression: string, item: ListItem): boolean {
  if (!expression.trim()) return true;
  return evaluateNode(parseFilter(expression), item);
}

/* ── Sorting ───────────────────────────────────────────────────────────── */

function sortKey(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

/** Ordering comparator for a single field. Empty values sort last. */
export function compareItemsByField(
  a: ListItem,
  b: ListItem,
  fieldId: FieldId,
  direction: "asc" | "desc",
  field?: FieldDefinition,
): number {
  const left = sortKey(fieldId === "Id" ? a.id : a.values[fieldId]);
  const right = sortKey(fieldId === "Id" ? b.id : b.values[fieldId]);

  const leftEmpty = left === null || left === undefined || left === "";
  const rightEmpty = right === null || right === undefined || right === "";
  if (leftEmpty && rightEmpty) return 0;
  if (leftEmpty) return 1;
  if (rightEmpty) return -1;

  let ordering: number;
  if (field?.type === "number") {
    ordering = (Number(left) || 0) - (Number(right) || 0);
  } else {
    ordering = compareScalar(left, right) ?? 0;
  }

  return direction === "desc" ? -ordering : ordering;
}
