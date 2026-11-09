// Builds CSS variables from the Tokens Studio export (tokens.json).
// Tokens Studio stores several token sets in one file; this merges them so
// references like {ink.950} resolve, then Style Dictionary writes the CSS.
import StyleDictionary from "style-dictionary";
import { readFileSync, mkdirSync } from "node:fs";

const SETS = ["Primitives/Value", "Color/Dark", "Typography/Value", "Spacing/Value", "Radius/Value", "Sizing/Value"];

const source = JSON.parse(readFileSync("tokens.json", "utf8"));

function merge(target, src) {
  for (const [key, value] of Object.entries(src)) {
    if (key.startsWith("$")) continue;
    if (value && typeof value === "object" && !("$value" in value)) {
      target[key] = target[key] ?? {};
      merge(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

const tokens = {};
for (const set of SETS) {
  if (!source[set]) throw new Error(`Set "${set}" not found in tokens.json`);
  merge(tokens, source[set]);
}


// Figma exports font weights as names and sizes as bare numbers.
// CSS needs numeric weights and px units, so convert them here.
const WEIGHTS = { regular: 400, medium: 500, semibold: 600 };
const DIMENSION_ROOTS = new Set(["space", "radius", "size"]);

function fixLeaves(node, path = []) {
  if (!node || typeof node !== "object") return;
  if ("$value" in node) {
    const [root, group, name] = path;
    const value = node.$value;
    if (root === "type" && group === "weight" && WEIGHTS[name] !== undefined) {
      node.$type = "fontWeight";
      node.$value = WEIGHTS[name];
    } else if (root === "type" && group === "size" && typeof value === "number") {
      node.$type = "dimension";
      node.$value = `${value}px`;
    } else if (DIMENSION_ROOTS.has(root) && typeof value === "number") {
      node.$type = "dimension";
      node.$value = `${value}px`;
    }
    return;
  }
  for (const [key, child] of Object.entries(node)) fixLeaves(child, [...path, key]);
}

fixLeaves(tokens);

mkdirSync("styles", { recursive: true });
writeTokensFile(tokens);

async function writeTokensFile(tokenObject) {
  const sd = new StyleDictionary({
    tokens: tokenObject,
    platforms: {
      css: {
        transformGroup: "css",
        buildPath: "styles/",
        files: [
          {
            destination: "tokens.css",
            format: "css/variables",
            options: { outputReferences: true, selector: ":root" },
          },
        ],
      },
    },
  });
  await sd.buildAllPlatforms();
  console.log("Wrote styles/tokens.css");
}
