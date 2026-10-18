// Generic scanner inputs adapted from immutable consumer tests; see docs/provenance.md.
export const branches = (n, value = "x") =>
  Array.from(
    { length: n },
    (_, i) => `if (${value} === ${i}) return ${i};\n`,
  ).join("");
export const heavy = (name, n, tail = "return 0;") =>
  `export function ${name}(x: number) {\n${branches(n)}${tail}\n}\n`;
export const handler = (n) =>
  `handler: (x: number) => {\n${branches(n)}return 0;\n},\n`;
export const owned = (name, n) => `export const ${name} = {\n${handler(n)}};\n`;
export const bare = (n) => `register({\n${handler(n)}});\n`;
export const accessor = (kind, n) =>
  `${kind} x(${kind === "set" ? "v: number" : ""}) {\n${branches(n, "this.n")}return 0;\n}\n`;
export const service = (getN, setN) =>
  `export class Svc {\nn = 0;\n${accessor("get", getN)}${accessor("set", setN)}}\n`;
export const lines = (n) =>
  Array.from({ length: n }, (_, i) => `// line ${i}\n`).join("");
