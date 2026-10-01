import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const envFile = resolve(here, "../src/env.d.ts");

let source = readFileSync(envFile, "utf8");

// packages/env has no sibling main module, so the generated relative imports
// (`./src/server`) would not resolve from here — inline them away.
source = source.replace(/\tinterface GlobalProps \{[\s\S]*?\n\t\}\n/, "");

source = source.replace(
  /DurableObjectNamespace<import\([^)]*\)\.\w+>/g,
  "DurableObjectNamespace"
);

writeFileSync(envFile, source);
