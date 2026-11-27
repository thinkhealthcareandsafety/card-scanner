// The reading itself (owner, 27 Nov: "an application whose sole purpose is to scan"). A photo in, its words out.
//  - The photo is cleaned first: turned as the phone took it, made at most 2400 px, grey, contrast stretched, sharpened.
//  - Read with Tesseract's best English model (lang/), page mode "auto", which also reads lines running sideways.
//  - Read upright first; if that reads poorly, turned a quarter each way, and the best single reading is kept
//    (never two readings stitched together: that's what mixed garbage into the labels before).
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { createWorker, PSM } from "tesseract.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const GOOD = 72; // a reading this sure is kept without trying the photo turned

let worker = null;
async function reader() {
  if (!worker) {
    worker = createWorker("eng", 1, { langPath: path.join(here, "lang"), gzip: false, cachePath: "/tmp", cacheMethod: "none" })
      .then(async (w) => { await w.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: "1" }); return w; })
      .catch((e) => { worker = null; throw e; });
  }
  return worker;
}

/** The photo turned and sized; "clean" also stretches the contrast and sharpens (helps faint print, can lose light lines). */
async function prepare(bytes, deg, clean) {
  let img = sharp(bytes).rotate().rotate(deg).resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: false }).grayscale();
  if (clean) img = img.normalize().sharpen({ sigma: 1 });
  return img.png().toBuffer();
}

/** One reading: its lines with how sure Tesseract is of each. */
async function readOnce(w, png) {
  const { data } = await w.recognize(png, {}, { blocks: true, text: true });
  const lines = [];
  for (const b of data.blocks ?? []) for (const p of b.paragraphs ?? []) for (const l of p.lines ?? []) {
    const text = l.text.replace(/\s+/g, " ").trim();
    if (text) lines.push({ text, sure: l.confidence, y: l.bbox.y0, x: l.bbox.x0, h: l.bbox.y1 - l.bbox.y0 });
  }
  return { lines, sure: data.confidence };
}
const key = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, "");
const realWords = (lines) => lines.reduce((n, l) => n + (l.text.match(/[A-Za-z0-9@.]{3,}/g) ?? []).length, 0);

/**
 * The words on a card photo: { text, lines, confidence (0–100), turned (degrees), ms }.
 * Each way up is read twice (plain and cleaned): all of the plain reading, plus the lines only the cleaned one found
 * (when fairly sure of them). The way up that reads most is kept.
 */
export async function readCard(bytes) {
  const started = Date.now();
  const w = await reader();
  let best = null;
  for (const deg of [0, 90, 270]) {
    const [plain, clean] = [await readOnce(w, await prepare(bytes, deg, false)), await readOnce(w, await prepare(bytes, deg, true))];
    // Everything the plain reading found, in its order; then what only the cleaned one found, when fairly sure of it.
    const lines = [...plain.lines];
    for (const l of clean.lines) {
      const k = key(l.text);
      if (l.sure < 55 || k.length < 4) continue;
      if (!lines.some((x) => { const kx = key(x.text); return kx.length >= 4 && (kx.includes(k) || k.includes(kx)); })) { lines.push(l); continue; }
      // A line the plain reading has too, but with words it missed (a logo word read beside the email): those words alone.
      const seen = new Set(lines.flatMap((x) => x.text.split(/[^A-Za-z0-9]+/)).map(key));
      const extra = (l.text.match(/[A-Za-z][A-Za-z&]{2,}/g) ?? []).filter((w) => !seen.has(key(w)));
      if (extra.length) lines.push({ ...l, text: extra.join(" ") });
    }
    const sure = Math.max(plain.sure, clean.sure), words = realWords(lines);
    const score = sure * 0.5 + Math.min(words, 40) * 2;
    if (!best || score > best.score) best = { lines, sure, turned: deg, score };
    if (deg === 0 && sure >= GOOD && words >= 8) break;
  }
  const lines = best.lines.map((l) => ({ text: l.text, sure: Math.round(l.sure), size: l.h }));
  return { text: lines.map((l) => l.text).join("\n"), lines, confidence: Math.round(best.sure), turned: best.turned, ms: Date.now() - started };
}
