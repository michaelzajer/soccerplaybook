/* ============================================================
   CLI:  node tools/drill-from-text.mjs my-drill.txt
         node tools/drill-from-text.mjs my-drill.txt --name "Complex 3"

   The parser itself lives in js/drill-text.js so that the app and
   this tool can never drift apart. Spec: DRILL-NOTATION.md
   ============================================================ */
import fs from "node:fs";
import path from "node:path";
const here = path.dirname(new URL(import.meta.url).pathname);
// the file attaches itself to `window` when one exists, so hand it a stand-in
const scope = {};
new Function("window", fs.readFileSync(
  path.join(here, "..", "js", "drill-text.js"), "utf8"))(scope);
export const parseDrill = scope.parseDrillText;

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: node tools/drill-from-text.mjs <file.txt> [--name \"...\"]");
    process.exit(1);
  }
  const ni = process.argv.indexOf("--name");
  const drill = parseDrill(fs.readFileSync(file, "utf8"), ni > -1 ? process.argv[ni + 1] : null);
  console.log(JSON.stringify(drill, null, 1));
  console.error(`\n${drill.name}: ${drill.items.length} pieces, ${drill.strokes.length} lines`);
}
