// news-image-20261125 — entrypoint.
//
// Copies the pre-rendered front page (entry.png, 1024x1024, JPEG bytes)
// into the grader's output directory as entry.png.
// Deterministic: a plain byte copy, identical on every run.
// No network, no dependencies beyond the Node standard library.
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const src = join(here, "entry.png");
const dst = join(outDir, "entry.png");

if (!existsSync(src)) {
  console.error(`entry.png not found next to main.ts (${here})`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
copyFileSync(src, dst);

// Verify the copy is whole: same byte count as the source.
const srcBytes = statSync(src).size;
const dstBytes = statSync(dst).size;
if (srcBytes !== dstBytes) {
  console.error(`copy incomplete: ${dstBytes} of ${srcBytes} bytes`);
  process.exit(1);
}
console.log(`wrote ${dst} (${dstBytes} bytes)`);
