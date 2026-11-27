// Local check: node try.js <photo> … — prints what each photo reads as.
import fs from "node:fs";
import { readCard } from "./read.js";

for (const f of process.argv.slice(2)) {
  const r = await readCard(fs.readFileSync(f));
  console.log(`\n=== ${f}\nconfidence ${r.confidence} · turned ${r.turned}° · ${r.ms} ms\n${r.text}`);
}
process.exit(0);
