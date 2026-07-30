// TODO(you): implement a propositional-logic truth-table prover.
//
// Operators (ASCII, high→low precedence): ! (not) > & (and) > | (or) > -> (implies) > <-> (iff).
// Variables: single lowercase letters a–z. Parentheses allowed.
//
// You must implement all four exported functions so the acceptance suite passes.

export type Ast = unknown; // define your own node shape internally

// Parse an expression string into an AST. Throws on malformed input.
export function parse(expr: string): Ast {
  throw new Error("not implemented");
}

// Evaluate a parsed AST under a variable assignment.
export function evaluate(ast: Ast, env: Record<string, boolean>): boolean {
  void ast; void env;
  return false; // TODO
}

// Enumerate all 2^n assignments for the variables in expr and classify.
export function classify(expr: string): "tautology" | "contradiction" | "contingent" {
  void expr;
  return "contingent"; // TODO
}

// True iff a and b produce the same output on every assignment over their combined variables.
export function equivalent(a: string, b: string): boolean {
  void a; void b;
  return false; // TODO
}
